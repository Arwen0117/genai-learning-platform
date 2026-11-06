import { imageSize } from "image-size";

import type { Translator } from "@/i18n/translate";
import { MAX_IMAGES, imageFileSchema, imageMediaType } from "@/lib/course-file";
import type { ExtractedImage } from "@/lib/ppt-image-extractor";

/**
 * Dropped images → `ExtractedImage`, the shape the vision channel already
 * speaks for PPTX slide media.
 *
 * Server-only: `image-size` reads the headers straight from the bytes. Every
 * failure is a warning, never an error, so one bad file cannot lose the batch.
 */

export type UploadedImageResult =
  | { ok: true; image: ExtractedImage }
  | { ok: false; warning: string };

/**
 * `slideNumbers: [0]` marks "uploaded directly", which the prompt composition
 * uses to avoid calling a dropped image a slide.
 */
export async function readUploadedImage(
  file: File,
  t: Translator,
): Promise<UploadedImageResult> {
  const parsed = imageFileSchema.safeParse({ name: file.name, size: file.size });
  const mediaType = imageMediaType(file.name);

  if (!parsed.success || mediaType === null) {
    const tooLarge =
      !parsed.success && parsed.error.issues[0]?.message === "tooLarge";

    return {
      ok: false,
      warning: tooLarge
        ? t("server.generate.file.imageTooLarge", { name: file.name })
        : t("server.generate.file.imageUnsupported", { name: file.name }),
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch (error: unknown) {
    console.error("[upload-images] failed to read an uploaded image", error);
    return {
      ok: false,
      warning: t("server.generate.file.imageUnreadable", { name: file.name }),
    };
  }

  let width = 0;
  let height = 0;
  try {
    const dimensions = imageSize(bytes);
    width = dimensions.width ?? 0;
    height = dimensions.height ?? 0;
  } catch {
    // Unreadable headers are reported below; the rest of the batch continues.
  }

  if (width <= 0 || height <= 0) {
    return {
      ok: false,
      warning: t("server.generate.file.imageUnreadable", { name: file.name }),
    };
  }

  return {
    ok: true,
    image: {
      mediaPath: file.name,
      slideNumbers: [0],
      bytes,
      mediaType,
      size: file.size,
      width,
      height,
    },
  };
}

export type UploadedImages = {
  images: ExtractedImage[];
  warnings: string[];
};

/** Reads at most `MAX_IMAGES`; the overflow becomes one warning. */
export async function readUploadedImages(
  files: File[],
  t: Translator,
): Promise<UploadedImages> {
  const warnings: string[] = [];

  if (files.length > MAX_IMAGES) {
    warnings.push(t("server.generate.file.imagesLimit", { count: MAX_IMAGES }));
  }

  const images: ExtractedImage[] = [];

  for (const file of files.slice(0, MAX_IMAGES)) {
    const read = await readUploadedImage(file, t);
    if (read.ok) {
      images.push(read.image);
    } else {
      warnings.push(read.warning);
    }
  }

  return { images, warnings };
}

/** Prompt lines for described images; slide 0 is a direct upload, not a slide. */
export function figureLines(
  descriptions: Array<{ slideNumber: number; text: string }>,
): string[] {
  return [
    "Figures from the uploaded material (described by a vision model):",
    ...descriptions.map((entry) =>
      entry.slideNumber === 0
        ? `- Uploaded image: ${entry.text}`
        : `- Slide ${entry.slideNumber}: ${entry.text}`,
    ),
  ];
}

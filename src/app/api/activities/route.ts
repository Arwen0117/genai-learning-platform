import { z } from "zod";
import { JsonRequestError, readJsonPost } from "@/lib/json-request";
import { activitySubmissionSchema } from "@/lib/blocks/activity-result";
import { submitActivity } from "@/server/activities";

const bodySchema = z.object({
  lessonId: z.string().min(1).max(200),
  blockId: z.string().min(1).max(200),
  submission: activitySubmissionSchema,
});
export async function POST(request: Request): Promise<Response> {
  try {
    const body = bodySchema.parse(await readJsonPost(request, 250_000));
    // Never accept preview/ownership flags from this learner transport.
    const result = await submitActivity(
      body.lessonId,
      body.blockId,
      body.submission,
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return Response.json(
      {
        ok: false,
        error:
          cause instanceof JsonRequestError
            ? cause.message
            : "Invalid activity submission.",
      },
      {
        status: cause instanceof JsonRequestError ? cause.status : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

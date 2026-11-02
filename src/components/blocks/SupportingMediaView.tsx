"use client";

import { Play } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SupportingMedia } from "@/lib/blocks/schema";
import { isLearnerVisibleSupportingMedia } from "@/lib/supporting-media";
import {
  CHALLENGE_MAX_ANIMATION_SECONDS,
  effectiveAnimationPlaybackSeconds,
} from "@/lib/supporting-media-duration";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/**
 * Shared Supporting media renderer for Challenges and Simulation nodes.
 *
 * Animations respect a context max duration. With reduced motion, animation
 * media shows a static first frame until the learner presses Play.
 */
export function SupportingMediaView({
  media,
  maxDurationSeconds = CHALLENGE_MAX_ANIMATION_SECONDS,
  autoPlay = false,
  onDismiss,
}: {
  media: SupportingMedia | undefined;
  maxDurationSeconds?: number;
  /** When true and motion is allowed, start the animation without a click. */
  autoPlay?: boolean;
  /** Optional dismiss/skip control so media never gates the decision graph. */
  onDismiss?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [userStarted, setUserStarted] = useState(false);
  const [mediaUrl, setMediaUrl] = useState(media?.url);
  // Reset Play gate when the media source changes (render-time adjust, not an effect).
  if (media?.url !== mediaUrl) {
    setMediaUrl(media?.url);
    setUserStarted(false);
  }
  const allowAutoPlay = autoPlay && !reducedMotion;
  const waitingForExplicitPlay = reducedMotion && !userStarted;

  if (!isLearnerVisibleSupportingMedia(media)) return null;

  if (media.kind === "image") {
    return (
      <div className="mb-4 space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- media URLs are instructor-approved content */}
        <img
          alt={media.decorative ? "" : media.altText}
          className="max-h-64 w-full rounded-lg object-contain"
          src={media.url}
        />
        {onDismiss === undefined ? null : (
          <Button onClick={onDismiss} size="sm" type="button" variant="ghost">
            Skip
          </Button>
        )}
      </div>
    );
  }

  const playbackCap = effectiveAnimationPlaybackSeconds(
    media.durationSeconds,
    maxDurationSeconds,
  );

  function clampPlayback(video: HTMLVideoElement): void {
    if (video.currentTime > playbackCap) {
      video.currentTime = playbackCap;
    }
    if (video.currentTime >= playbackCap) {
      video.pause();
      video.currentTime = playbackCap;
    }
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <video
          aria-label={media.decorative ? undefined : media.altText}
          autoPlay={allowAutoPlay || undefined}
          className="max-h-64 w-full rounded-lg"
          controls={!waitingForExplicitPlay}
          muted
          onSeeking={(event) => {
            clampPlayback(event.currentTarget);
          }}
          onTimeUpdate={(event) => {
            clampPlayback(event.currentTarget);
          }}
          playsInline
          preload="metadata"
          ref={videoRef}
          src={media.url}
        />
        {waitingForExplicitPlay ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/35">
            <Button
              onClick={() => {
                const video = videoRef.current;
                if (video === null) return;
                setUserStarted(true);
                void video.play();
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              <Play aria-hidden="true" />
              Play
            </Button>
          </div>
        ) : null}
      </div>
      {onDismiss === undefined ? null : (
        <Button onClick={onDismiss} size="sm" type="button" variant="ghost">
          Skip
        </Button>
      )}
    </div>
  );
}

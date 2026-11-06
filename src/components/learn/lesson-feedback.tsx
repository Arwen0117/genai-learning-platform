"use client";

import { ChevronDown, MessageSquareWarning } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/client";
import {
  FEEDBACK_REASONS,
  FEEDBACK_REASON_KEYS,
  MAX_FEEDBACK_NOTE_CHARS,
  type FeedbackReason,
} from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { submitLessonFeedback } from "@/server/feedback";

/**
 * "Something wrong with this lesson?" — collapsed by default, one row per
 * learner per lesson.
 *
 * The verdict already stored for this learner is passed in by the page, so a
 * reload shows the previous choice instead of an empty form. Submitting never
 * navigates: the widget keeps the form and swaps in a short confirmation, and
 * editing anything hides it again.
 */

type LessonFeedbackProps = {
  lessonId: string;
  /** The verdict this learner already left, when one exists. */
  initial: { reason: FeedbackReason; note: string } | null;
};

export function LessonFeedback({ lessonId, initial }: LessonFeedbackProps) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(initial !== null);
  const [reason, setReason] = useState<FeedbackReason | null>(
    initial?.reason ?? null,
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(initial !== null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (reason === null || isSaving) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await submitLessonFeedback({ lessonId, reason, note });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(true);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error ? cause.message : t("feedback.error"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        type="button"
      >
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageSquareWarning aria-hidden="true" className="size-3.5" />
          {reason === null || !saved
            ? t("feedback.title")
            : t("feedback.summary", { reason: t(FEEDBACK_REASON_KEYS[reason]) })}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            isOpen ? "rotate-180" : "",
          )}
        />
      </button>

      {isOpen ? (
        <form
          className="space-y-3 pt-3"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div
            aria-label={t("feedback.reason.label")}
            className="flex flex-wrap gap-1.5"
            role="group"
          >
            {FEEDBACK_REASONS.map((candidate) => (
              <Button
                aria-pressed={reason === candidate}
                disabled={isSaving}
                key={candidate}
                onClick={() => {
                  setReason(candidate);
                  setSaved(false);
                  setError(null);
                }}
                size="sm"
                type="button"
                variant={reason === candidate ? "default" : "outline"}
              >
                {t(FEEDBACK_REASON_KEYS[candidate])}
              </Button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="sr-only" htmlFor={`lesson-feedback-note-${lessonId}`}>
              {t("feedback.note.label")}
            </label>
            <Textarea
              className="min-h-16"
              disabled={isSaving}
              id={`lesson-feedback-note-${lessonId}`}
              maxLength={MAX_FEEDBACK_NOTE_CHARS}
              onChange={(event) => {
                setNote(event.target.value);
                setSaved(false);
              }}
              placeholder={t("feedback.note.placeholder")}
              rows={2}
              value={note}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {t("feedback.note.hint")}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {t("feedback.note.counter", {
                  count: note.length,
                  max: MAX_FEEDBACK_NOTE_CHARS,
                })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={reason === null || isSaving} size="sm" type="submit">
              {isSaving ? t("feedback.saving") : t("feedback.submit")}
            </Button>
            {saved ? (
              <p className="text-xs text-emerald-700" role="status">
                {t("feedback.thanks")}
              </p>
            ) : null}
          </div>

          {error === null ? null : (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : null}
    </div>
  );
}

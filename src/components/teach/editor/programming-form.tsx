"use client";

import { useId } from "react";
import { useI18n } from "@/i18n/client";
import { Textarea } from "@/components/ui/textarea";
import { KnowledgeEditor } from "@/components/blocks/programming-game/KnowledgeEditor";
import { GAME_MESSAGES } from "@/components/blocks/programming-game/messages";
import {
  createProgrammingPayload,
  type ProgrammingPayload,
} from "@/lib/programming-game/config";
import { ACTIONS } from "@/lib/programming-game/engine";
import {
  getTemplate,
  TEMPLATES,
  validateTemplateAllowed,
  type TemplateId,
} from "@/lib/programming-game/levels";

export function LegacyProgrammingForm({
  payload,
  onChange,
  onPreset,
}: {
  payload: ProgrammingPayload;
  onChange: (payload: ProgrammingPayload) => void;
  onPreset: (payload: ProgrammingPayload, title: string) => void;
}) {
  const { locale } = useI18n();
  const fieldId = useId();
  const m = GAME_MESSAGES[locale];
  let valid = true;
  try {
    validateTemplateAllowed(payload.templateId, payload.allowed);
  } catch {
    valid = false;
  }
  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span>{m.choose}</span>
        <select
          className="h-9 w-full rounded-md border bg-background px-2"
          value={payload.templateId}
          onChange={(e) => {
            const id = e.target.value as TemplateId;
            onPreset(
              createProgrammingPayload(id, locale),
              getTemplate(id).title[locale],
            );
          }}
        >
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title[locale]}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{m.presetNote}</p>
      <div className="space-y-1 text-sm">
        <label className="block" htmlFor={`${fieldId}-task`}>
          {m.taskLabel}
        </label>
        <Textarea
          id={`${fieldId}-task`}
          value={payload.task}
          maxLength={4000}
          rows={3}
          onChange={(e) => onChange({ ...payload, task: e.target.value })}
        />
      </div>
      <fieldset className="space-y-2 rounded-lg border p-3">
        <legend className="px-1 text-sm">{m.allowedLabel}</legend>
        <div className="flex flex-wrap gap-3">
          {[...ACTIONS, "repeat" as const].map((op) => (
            <label key={op} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={payload.allowed.includes(op)}
                onChange={(e) =>
                  onChange({
                    ...payload,
                    allowed: e.target.checked
                      ? [...payload.allowed, op]
                      : payload.allowed.filter((a) => a !== op),
                  })
                }
              />
              {op === "repeat" ? m.repeat : m.actions[op]}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{m.allowedNote}</p>
        {!valid ? (
          <p role="alert" className="text-sm text-destructive">
            {m.allowedInvalid}
          </p>
        ) : null}
      </fieldset>
      <div className="space-y-1 text-sm">
        <label className="block" htmlFor={`${fieldId}-hints`}>
          {m.hintsLabel}
        </label>
        <Textarea
          id={`${fieldId}-hints`}
          rows={3}
          value={payload.hints.join("\n")}
          maxLength={24000}
          onChange={(e) =>
            onChange({ ...payload, hints: e.target.value.split("\n") })
          }
        />
      </div>
      <KnowledgeEditor
        mode="course"
        cards={payload.knowledge}
        locale={locale}
        onChange={(knowledge) => onChange({ ...payload, knowledge })}
      />
    </div>
  );
}

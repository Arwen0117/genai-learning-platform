"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  KNOWLEDGE_LIMITS,
  parseKnowledge,
  type KnowledgeCard,
} from "@/lib/programming-game/knowledge";
import type { TemplateId } from "@/lib/programming-game/levels";
import { GAME_MESSAGES } from "./messages";

type Props = {
  cards: KnowledgeCard[];
  onChange: (cards: KnowledgeCard[]) => void;
  teacherId?: string;
  templateId?: TemplateId;
  mode?: "workshop" | "course" | "embedded";
  locale: "en" | "zh";
};

/** Shared fields: workshop browser drafts or course-owned payload editing. */
export function KnowledgeEditor({
  cards,
  onChange,
  teacherId = "",
  templateId = "first-route",
  mode = "workshop",
  locale,
}: Props) {
  const m = GAME_MESSAGES[locale];
  const fieldId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const storageKey = `programming-game:knowledge:v1:${encodeURIComponent(teacherId)}:${templateId}:${locale}`;
  function edit(next: KnowledgeCard[]) {
    setNotice(null);
    onChange(next);
  }
  function save() {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(parseKnowledge(cards)),
      );
      setNotice(m.knowledgeSaved);
    } catch {
      setNotice(m.knowledgeStorageError);
    }
  }
  function load() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === null) {
        setNotice(m.knowledgeNoDraft);
        return;
      }
      onChange(parseKnowledge(JSON.parse(saved)));
      setNotice(m.knowledgeLoaded);
    } catch {
      setNotice(m.knowledgeStorageError);
    }
  }
  return (
    <section
      className="space-y-4 rounded-xl border bg-muted/20 p-4"
      aria-label={m.knowledgeEditor}
    >
      <h2 className="text-lg font-semibold">{m.knowledgeEditor}</h2>
      <p className="text-sm text-muted-foreground">
        {mode === "course" ? m.knowledgeCourseNote : m.knowledgeDraftNote}
      </p>
      {cards.map((card, index) => (
        <fieldset
          key={index}
          className="min-w-0 space-y-3 rounded-lg border bg-background p-3"
        >
          <legend className="px-1 text-sm">
            {m.knowledgeCard} {index + 1}
          </legend>
          <div className="space-y-1 text-sm">
            <label className="block" htmlFor={`${fieldId}-title-${index}`}>
              {m.knowledgeTitle}
            </label>
            <Input
              id={`${fieldId}-title-${index}`}
              value={card.title}
              maxLength={KNOWLEDGE_LIMITS.title}
              onChange={(e) =>
                edit(
                  cards.map((c, i) =>
                    i === index ? { ...c, title: e.target.value } : c,
                  ),
                )
              }
            />
          </div>
          <div className="space-y-1 text-sm">
            <label className="block" htmlFor={`${fieldId}-body-${index}`}>
              {m.knowledgeBody}
            </label>
            <textarea
              id={`${fieldId}-body-${index}`}
              value={card.body}
              rows={6}
              maxLength={KNOWLEDGE_LIMITS.body}
              className="w-full resize-y rounded-md border bg-background p-2 text-sm"
              onChange={(e) =>
                edit(
                  cards.map((c, i) =>
                    i === index ? { ...c, body: e.target.value } : c,
                  ),
                )
              }
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`${m.knowledgeRemove} ${index + 1}`}
            onClick={() => edit(cards.filter((_, i) => i !== index))}
          >
            {m.knowledgeRemove}
          </Button>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={cards.length >= KNOWLEDGE_LIMITS.cards}
          onClick={() => edit([...cards, { title: "", body: "" }])}
        >
          {m.knowledgeAdd}
        </Button>
        {mode === "workshop" ? (
          <>
            <Button type="button" onClick={save}>
              {m.knowledgeSave}
            </Button>
            <Button type="button" variant="outline" onClick={load}>
              {m.knowledgeLoad}
            </Button>
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{m.knowledgeLimits}</p>
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import {
  getTemplate,
  TEMPLATES,
  type TemplateId,
} from "@/lib/programming-game/levels";
import { ProgrammingGame } from "./ProgrammingGame";
import { GAME_MESSAGES } from "./messages";
import { KnowledgeEditor } from "./KnowledgeEditor";
import {
  getDefaultKnowledge,
  type KnowledgeCard,
} from "@/lib/programming-game/knowledge";

export function ProgrammingGameLab({ teacherId }: { teacherId: string }) {
  const { locale } = useI18n();
  const m = GAME_MESSAGES[locale];
  const [id, setId] = useState<TemplateId>("first-route");
  const template = getTemplate(id);
  const [drafts, setDrafts] = useState<Record<string, KnowledgeCard[]>>({});
  const draftKey = `${id}:${locale}`;
  const knowledge = drafts[draftKey] ?? getDefaultKnowledge(id, locale);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{m.labTitle}</h1>
        <p className="rounded-lg border bg-muted/30 p-3 text-sm">{m.labNote}</p>
      </header>
      <label className="flex flex-wrap items-center gap-3 text-sm">
        {m.choose}
        <select
          className="h-9 max-w-full rounded-lg border bg-background px-2"
          value={id}
          onChange={(event) => setId(event.target.value as TemplateId)}
        >
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title[locale]}
            </option>
          ))}
        </select>
      </label>
      <ProgrammingGame
        level={template.level}
        title={template.title[locale]}
        task={template.task[locale]}
        locale={locale}
        knowledge={knowledge}
      />
      <KnowledgeEditor
        key={draftKey}
        cards={knowledge}
        onChange={(cards) =>
          setDrafts((previous) => ({ ...previous, [draftKey]: cards }))
        }
        teacherId={teacherId}
        templateId={id}
        locale={locale}
      />
    </div>
  );
}

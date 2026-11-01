"use client";
import { useI18n } from "@/i18n/client";
import { ParallelGameLab } from "./ParallelGameLab";
import { WORKSHOP_MESSAGES } from "./workshop-messages";
export function ProgrammingGameLab({ teacherId }: { teacherId: string }) {
  const { locale } = useI18n(); const w = WORKSHOP_MESSAGES[locale];
  return <div className="min-w-0 space-y-6"><header className="space-y-2"><h1 className="text-2xl font-semibold">{w.title}</h1><p className="text-sm text-muted-foreground">{w.note}</p></header><ParallelGameLab key={locale} locale={locale} teacherId={teacherId} /></div>;
}

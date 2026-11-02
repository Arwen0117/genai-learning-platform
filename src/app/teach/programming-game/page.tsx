import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/i18n/server";
import { ROBOT_COURSE_TOPIC } from "@/lib/programming-game/robot-course";
import { ROBOT_MESSAGES } from "@/components/robot-course/messages";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { ProgrammingGameLab } from "@/components/blocks/programming-game/ProgrammingGameLab";

async function TeacherWorkshop() {
  // Match the existing /teach pattern: session randomness stays outside prerendering.
  await connection();
  const session = await auth();
  if (!session?.user)
    redirect("/login?callbackUrl=%2Fteach%2Fprogramming-game");
  if (session.user.role !== "INSTRUCTOR" && session.user.role !== "ADMIN")
    redirect("/");
  const { locale } = await getI18n(), w = ROBOT_MESSAGES[locale];
  const courses = await prisma.course.findMany({ where: { createdById: session.user.id, topic: ROBOT_COURSE_TOPIC, slug: { startsWith: "robot-game-" } }, select: { id: true, title: true, status: true }, orderBy: { updatedAt: "desc" } });
  return <div className="space-y-5"><h1 className="text-2xl font-semibold">{w.title}</h1><Link className="inline-block rounded border p-3" href="/teach/programming-game/new">{w.create}</Link>
    <ul className="space-y-2">{courses.map((c) => <li className="flex flex-wrap justify-between gap-3 rounded border p-3" key={c.id}><Link className="underline" href={`/teach/programming-game/${c.id}`}>{c.title}</Link><span>{c.status === "DRAFT" ? w.draft : c.status === "PUBLISHED" ? w.published : w.archived}</span><Link className="underline" href={`/play/programming/${c.id}?preview=1`}>{w.preview}</Link></li>)}</ul>
    <details><summary>{locale === "zh" ? "本机试玩（不发布课程）" : "Local sandbox (does not publish a course)"}</summary><ProgrammingGameLab teacherId={session.user.id} /></details></div>;
}

/** Dedicated game-course hub with a retained local sandbox. */
export default function ProgrammingGameWorkshopPage() {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-8">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <TeacherWorkshop />
      </Suspense>
    </main>
  );
}

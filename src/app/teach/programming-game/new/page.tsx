import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { createRobotCourseDraft } from "@/lib/programming-game/robot-course";
import { RobotCourseEditor } from "@/components/robot-course/RobotCourseEditor";
async function Content() {
  await connection(); const user = (await auth())?.user;
  if (!user) redirect("/login?callbackUrl=%2Fteach%2Fprogramming-game%2Fnew");
  if (user.role !== "INSTRUCTOR" && user.role !== "ADMIN") redirect("/");
  const { locale } = await getI18n();
  return <RobotCourseEditor initial={createRobotCourseDraft(locale, randomUUID)} />;
}
export default function Page() { return <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6"><Suspense fallback={<p>Loading…</p>}><Content /></Suspense></main>; }

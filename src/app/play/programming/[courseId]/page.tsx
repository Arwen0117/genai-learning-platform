import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { loadRobotGame } from "@/lib/programming-game/robot-course-access";
import { RobotCourseScreen } from "@/components/robot-course/RobotCourseScreen";
async function Content({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ preview?: string; level?: string }> }) {
  await connection(); const { courseId } = await params, q = await searchParams;
  if (!(await auth())?.user) redirect(`/login?callbackUrl=${encodeURIComponent(`/play/programming/${courseId}`)}`);
  const game = await loadRobotGame(courseId, q.preview === "1"); if (!game) notFound();
  return <RobotCourseScreen key={JSON.stringify(game.levels.map((l) => l.payload))} title={game.title} levels={game.levels} preview={q.preview === "1"} initialLessonId={q.level} />;
}
export default function Page(props: { params: Promise<{ courseId: string }>; searchParams: Promise<{ preview?: string; level?: string }> }) { return <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6"><Suspense fallback={<p>Loading…</p>}><Content {...props} /></Suspense></main>; }

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { loadRobotCourseDraft } from "@/server/robot-courses";
import { RobotCourseEditor } from "@/components/robot-course/RobotCourseEditor";
async function Content({ params }: { params: Promise<{ courseId: string }> }) {
  await connection(); if (!(await auth())?.user) redirect("/login");
  const { courseId } = await params, result = await loadRobotCourseDraft(courseId);
  if (!result) notFound();
  return <RobotCourseEditor courseId={result.courseId} initial={result.draft} />;
}
export default function Page(props: { params: Promise<{ courseId: string }> }) { return <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6"><Suspense fallback={<p>Loading…</p>}><Content {...props} /></Suspense></main>; }

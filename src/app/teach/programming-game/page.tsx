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
  return <ProgrammingGameLab />;
}

/** Development workshop with real server-side authorization and no writes.
 * Kept separate from course activities until official submission integration.
 */
export default function ProgrammingGameWorkshopPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense fallback={<p role="status">Loading…</p>}>
        <TeacherWorkshop />
      </Suspense>
    </main>
  );
}

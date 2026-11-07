import { z } from "zod";
import { readJsonPost, JsonRequestError } from "@/lib/json-request";
import { saveRobotCourse } from "@/server/robot-courses";
const bodySchema = z.object({ courseId: z.string().min(1).max(200).nullable(), draft: z.unknown(), removedLessonIds: z.array(z.string().uuid()).max(20).optional() }).strict();
export async function POST(request: Request) {
  try { const p = bodySchema.parse(await readJsonPost(request, 2000000)); return Response.json(await saveRobotCourse(p.courseId, p.draft, p.removedLessonIds), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return Response.json({ ok: false, error: "Invalid game course request." }, { status: e instanceof JsonRequestError ? e.status : 400 }); }
}

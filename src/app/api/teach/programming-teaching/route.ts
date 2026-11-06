import { JsonRequestError, readJsonPost } from "@/lib/json-request";
import { generateProgrammingTeaching } from "@/server/programming-teaching";
export async function POST(request: Request) {
  try { return Response.json(await generateProgrammingTeaching(await readJsonPost(request, 250000)), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return Response.json({ ok: false, error: "Invalid teaching note request." }, { status: e instanceof JsonRequestError ? e.status : 400 }); }
}

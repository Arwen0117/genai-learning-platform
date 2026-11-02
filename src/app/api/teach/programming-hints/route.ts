import { JsonRequestError, readJsonPost } from "@/lib/json-request";
import { generateProgrammingHints } from "@/server/programming-hints";
export async function POST(request: Request) {
  try { return Response.json(await generateProgrammingHints(await readJsonPost(request, 250000)), { headers: { "Cache-Control": "no-store" } }); }
  catch (e) { return Response.json({ ok: false, error: "Invalid hint request." }, { status: e instanceof JsonRequestError ? e.status : 400 }); }
}

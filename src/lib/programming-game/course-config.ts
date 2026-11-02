import { z } from "zod";
import { programmingPayloadSchema, programmingVersion, type ProgrammingPayload } from "./config";
import { parallelProgrammingPayloadSchema, parallelProgrammingVersion, type ParallelProgrammingPayload } from "./parallel-config";

/** No version means legacy v1. Explicit unknown versions must never fall back. */
const legacyCoursePayloadSchema = z.object({ rulesVersion: z.literal(1).optional() }).passthrough().pipe(programmingPayloadSchema);
export const courseProgrammingPayloadSchema = z.union([parallelProgrammingPayloadSchema, legacyCoursePayloadSchema]);
export type CourseProgrammingPayload = ProgrammingPayload | ParallelProgrammingPayload;
export function isParallelProgramming(payload: CourseProgrammingPayload): payload is ParallelProgrammingPayload {
  return "rulesVersion" in payload && payload.rulesVersion === 2;
}
export async function courseProgrammingVersion(input: CourseProgrammingPayload): Promise<string> {
  const p = courseProgrammingPayloadSchema.parse(input);
  return isParallelProgramming(p) ? parallelProgrammingVersion(p) : programmingVersion(p);
}

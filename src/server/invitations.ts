"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getI18n } from "@/i18n/server";
import { auth, signIn } from "@/lib/auth";
import { firstLesson, getCourseById } from "@/lib/courses";
import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  redeemInvitation,
  revokeInvitation,
  type InvitationRecord,
} from "@/server/invitation";

export type InvitationActionResult =
  | { ok: true; invitation?: InvitationRecord; invitations?: InvitationRecord[] }
  | { ok: false; error: string };

const courseIdSchema = z.string().min(1).max(100);
const invitationIdSchema = z.string().min(1).max(100);
const tokenSchema = z.string().min(1).max(200);

async function requireSignedInOwner(courseId: string) {
  const { t } = await getI18n();
  const parsed = courseIdSchema.safeParse(courseId);
  if (!parsed.success) {
    return { ok: false as const, error: t("server.invitation.courseGone"), t };
  }

  const session = await auth();
  const user = session?.user;
  if (user === undefined) {
    return { ok: false as const, error: t("server.invitation.signIn"), t };
  }

  return {
    ok: true as const,
    actorId: user.id,
    courseId: parsed.data,
    t,
  };
}

async function learnPathFor(courseId: string): Promise<string | null> {
  const course = await getCourseById(courseId);
  if (course === null) {
    return null;
  }
  const lesson = firstLesson(course);
  if (lesson === undefined) {
    return `/courses/${course.slug}`;
  }
  return `/learn/${course.id}/${lesson.id}`;
}

export async function createCourseInvitation(
  courseId: string,
  expiresAtIso: string | null,
): Promise<InvitationActionResult> {
  const gate = await requireSignedInOwner(courseId);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  let expiresAt: Date | null = null;
  if (expiresAtIso !== null && expiresAtIso.length > 0) {
    const parsed = new Date(expiresAtIso);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: gate.t("server.invitation.badExpiry") };
    }
    expiresAt = parsed;
  }

  const result = await createInvitation({
    courseId: gate.courseId,
    actorId: gate.actorId,
    expiresAt,
    t: gate.t,
  });

  if (!result.ok) {
    return result;
  }

  revalidatePath(`/teach/courses/${gate.courseId}/students`);
  return { ok: true, invitation: result.invitation };
}

export async function listCourseInvitations(
  courseId: string,
): Promise<InvitationActionResult> {
  const gate = await requireSignedInOwner(courseId);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  const result = await listInvitations({
    courseId: gate.courseId,
    actorId: gate.actorId,
    t: gate.t,
  });

  if (!result.ok) {
    return result;
  }

  return { ok: true, invitations: result.invitations };
}

export async function revokeCourseInvitation(
  courseId: string,
  invitationId: string,
): Promise<InvitationActionResult> {
  const gate = await requireSignedInOwner(courseId);
  if (!gate.ok) {
    return { ok: false, error: gate.error };
  }

  if (!invitationIdSchema.safeParse(invitationId).success) {
    return { ok: false, error: gate.t("server.invitation.notFound") };
  }

  const result = await revokeInvitation({
    invitationId,
    actorId: gate.actorId,
    t: gate.t,
  });

  if (!result.ok) {
    return result;
  }

  revalidatePath(`/teach/courses/${gate.courseId}/students`);
  return { ok: true };
}

export type RedeemFormState = { error: string | null };

/** Signed-in redeem; redirects into the Course on success. */
export async function redeemCourseInvitation(
  token: string,
): Promise<RedeemFormState> {
  const { t } = await getI18n();
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) {
    return { error: t("server.invitation.invalid") };
  }

  const session = await auth();
  const user = session?.user;
  if (user === undefined) {
    return { error: t("server.invitation.signInToRedeem") };
  }

  const result = await redeemInvitation({
    token: parsed.data,
    userId: user.id,
    role: user.role,
    t,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const path = await learnPathFor(result.courseId);
  if (path === null) {
    return { error: t("server.invitation.redeemFailed") };
  }

  redirect(path);
}

export type AcceptFormState = { error: string | null };

/** Logged-out accept: register as Learner, enroll, then sign in. */
export async function acceptCourseInvitation(
  _previous: AcceptFormState,
  formData: FormData,
): Promise<AcceptFormState> {
  const { t } = await getI18n();
  const tokenValue = formData.get("token");
  const token =
    typeof tokenValue === "string" ? tokenValue : "";

  const result = await acceptInvitation({
    token,
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    t,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  const path = await learnPathFor(result.courseId);
  const redirectTo = path ?? `/courses/${result.courseSlug}`;
  // New Learner accounts always go through onboarding first (same as register).
  const target = `/onboarding?next=${encodeURIComponent(redirectTo)}`;

  try {
    await signIn("credentials", {
      email: result.email,
      password: String(formData.get("password") ?? ""),
      redirectTo: target,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return { error: t("server.auth.invalidCredentials") };
    }
    throw error;
  }

  return { error: null };
}

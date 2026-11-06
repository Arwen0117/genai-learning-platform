import { Prisma, type Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { Translator } from "@/i18n/translate";
import { trackEvent } from "@/lib/analytics";
import { hashPassword, normaliseEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Course Invitation rules (ADR 0001) — the agreed test seam.
 *
 * Thin server actions own session/i18n wiring; this module owns create / list /
 * revoke / redeem / accept behaviour against Prisma.
 */

const TOKEN_BYTES = 32;
export const INVITE_REDEEM_PREFIX = "/invite/";

export type InvitationStatus = "active" | "expired" | "revoked";

export type InvitationRecord = {
  id: string;
  token: string;
  redeemPath: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  status: InvitationStatus;
};

type Fail = { ok: false; error: string };
type CreateOk = { ok: true; invitation: InvitationRecord };
type ListOk = { ok: true; invitations: InvitationRecord[] };
type RedeemOk = { ok: true; courseId: string; courseSlug: string };
type AcceptOk = RedeemOk & { email: string };

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
});

function redeemPathFor(token: string): string {
  return `${INVITE_REDEEM_PREFIX}${token}`;
}

function invitationStatus(
  row: { expiresAt: Date | null; revokedAt: Date | null },
  now: Date,
): InvitationStatus {
  if (row.revokedAt !== null) {
    return "revoked";
  }
  if (row.expiresAt !== null && row.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "active";
}

function toRecord(
  row: {
    id: string;
    token: string;
    createdAt: Date;
    expiresAt: Date | null;
    revokedAt: Date | null;
  },
  now: Date,
): InvitationRecord {
  return {
    id: row.id,
    token: row.token,
    redeemPath: redeemPathFor(row.token),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    status: invitationStatus(row, now),
  };
}

function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === "P2002"
  );
}

type LoadedInvitation = {
  id: string;
  token: string;
  courseId: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  course: { id: string; slug: string; status: string; title: string };
};

async function loadInvitation(token: string): Promise<LoadedInvitation | null> {
  return prisma.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      token: true,
      courseId: true,
      expiresAt: true,
      revokedAt: true,
      course: { select: { id: true, slug: true, status: true, title: true } },
    },
  });
}

export type InvitationPreview = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  status: InvitationStatus;
  redeemable: boolean;
};

/** Read-only preview for the redeem page; no Enrollment side effects. */
export async function previewInvitation(input: {
  token: string;
  now?: Date;
}): Promise<InvitationPreview | null> {
  const now = input.now ?? new Date();
  const token = input.token.trim();
  if (token.length === 0) {
    return null;
  }

  const invitation = await loadInvitation(token);
  if (invitation === null) {
    return null;
  }

  const status = invitationStatus(invitation, now);
  return {
    courseId: invitation.courseId,
    courseSlug: invitation.course.slug,
    courseTitle: invitation.course.title,
    status,
    redeemable:
      status === "active" && invitation.course.status === "PUBLISHED",
  };
}

function redeemGate(
  invitation: LoadedInvitation | null,
  now: Date,
  t: Translator,
): Fail | { ok: true; invitation: LoadedInvitation } {
  if (invitation === null) {
    return { ok: false, error: t("server.invitation.invalid") };
  }

  const status = invitationStatus(invitation, now);
  if (status === "revoked") {
    return { ok: false, error: t("server.invitation.revoked") };
  }
  if (status === "expired") {
    return { ok: false, error: t("server.invitation.expired") };
  }
  if (invitation.course.status !== "PUBLISHED") {
    return { ok: false, error: t("server.invitation.notPublished") };
  }

  return { ok: true, invitation };
}

async function requireOwnedCourse(
  courseId: string,
  actorId: string,
  t: Translator,
  options: { requirePublished: boolean },
): Promise<Fail | { ok: true; course: { id: string; createdById: string } }> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, createdById: true, status: true },
  });

  if (course === null) {
    return { ok: false, error: t("server.invitation.courseGone") };
  }

  if (course.createdById !== actorId) {
    return { ok: false, error: t("server.invitation.notOwner") };
  }

  if (options.requirePublished && course.status !== "PUBLISHED") {
    return { ok: false, error: t("server.invitation.notPublished") };
  }

  return { ok: true, course };
}

export async function createInvitation(input: {
  courseId: string;
  actorId: string;
  expiresAt?: Date | null;
  now?: Date;
  t: Translator;
}): Promise<CreateOk | Fail> {
  const now = input.now ?? new Date();
  const guard = await requireOwnedCourse(
    input.courseId,
    input.actorId,
    input.t,
    { requirePublished: true },
  );
  if (!guard.ok) {
    return guard;
  }

  const expiresAt = input.expiresAt ?? null;
  if (expiresAt !== null && expiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: input.t("server.invitation.expiryInPast") };
  }

  const created = await prisma.invitation.create({
    data: {
      token: newToken(),
      courseId: input.courseId,
      createdById: input.actorId,
      expiresAt,
    },
  });

  return { ok: true, invitation: toRecord(created, now) };
}

export async function listInvitations(input: {
  courseId: string;
  actorId: string;
  now?: Date;
  t: Translator;
}): Promise<ListOk | Fail> {
  const now = input.now ?? new Date();
  const guard = await requireOwnedCourse(
    input.courseId,
    input.actorId,
    input.t,
    { requirePublished: false },
  );
  if (!guard.ok) {
    return guard;
  }

  const rows = await prisma.invitation.findMany({
    where: { courseId: input.courseId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  return {
    ok: true,
    invitations: rows.map((row) => toRecord(row, now)),
  };
}

export async function revokeInvitation(input: {
  invitationId: string;
  actorId: string;
  now?: Date;
  t: Translator;
}): Promise<{ ok: true } | Fail> {
  const now = input.now ?? new Date();
  const row = await prisma.invitation.findUnique({
    where: { id: input.invitationId },
    select: {
      id: true,
      courseId: true,
      revokedAt: true,
      course: { select: { createdById: true } },
    },
  });

  if (row === null) {
    return { ok: false, error: input.t("server.invitation.notFound") };
  }

  if (row.course.createdById !== input.actorId) {
    return { ok: false, error: input.t("server.invitation.notOwner") };
  }

  if (row.revokedAt !== null) {
    return { ok: true };
  }

  await prisma.invitation.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { revokedAt: now },
  });

  return { ok: true };
}

export async function redeemInvitation(input: {
  token: string;
  userId: string;
  role: Role;
  now?: Date;
  t: Translator;
}): Promise<RedeemOk | Fail> {
  const now = input.now ?? new Date();

  if (input.role === "INSTRUCTOR") {
    return {
      ok: false,
      error: input.t("server.invitation.instructorCannotRedeem"),
    };
  }

  const token = input.token.trim();
  if (token.length === 0) {
    return { ok: false, error: input.t("server.invitation.invalid") };
  }

  const gate = redeemGate(await loadInvitation(token), now, input.t);
  if (!gate.ok) {
    return gate;
  }

  const { invitation } = gate;

  try {
    await prisma.enrollment.create({
      data: { userId: input.userId, courseId: invitation.courseId },
    });
  } catch (error: unknown) {
    if (!isUniqueViolation(error)) {
      console.error("[invitation] redeem failed", { invitationId: invitation.id });
      return { ok: false, error: input.t("server.invitation.redeemFailed") };
    }
  }

  await trackEvent("ENROLL", {
    userId: input.userId,
    courseId: invitation.courseId,
    payload: { via: "invitation", invitationId: invitation.id },
  });

  return {
    ok: true,
    courseId: invitation.courseId,
    courseSlug: invitation.course.slug,
  };
}

export async function acceptInvitation(input: {
  token: string;
  name: string;
  email: string;
  password: string;
  now?: Date;
  t: Translator;
}): Promise<AcceptOk | Fail> {
  const now = input.now ?? new Date();
  const parsed = registerSchema.safeParse({
    name: input.name,
    email: input.email,
    password: input.password,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: input.t("server.invitation.invalidRegistration"),
    };
  }

  const token = input.token.trim();
  if (token.length === 0) {
    return { ok: false, error: input.t("server.invitation.invalid") };
  }

  const gate = redeemGate(await loadInvitation(token), now, input.t);
  if (!gate.ok) {
    return gate;
  }

  const { invitation } = gate;
  const email = normaliseEmail(parsed.data.email);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing !== null) {
    return { ok: false, error: input.t("server.invitation.emailTaken") };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash,
        role: "LEARNER",
        enrollments: { create: { courseId: invitation.courseId } },
      },
    });
    userId = user.id;
  } catch (error: unknown) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: input.t("server.invitation.emailTaken") };
    }
    console.error("[invitation] accept failed", { invitationId: invitation.id });
    return { ok: false, error: input.t("server.invitation.redeemFailed") };
  }

  await trackEvent("ENROLL", {
    userId,
    courseId: invitation.courseId,
    payload: { via: "invitation", invitationId: invitation.id },
  });

  return {
    ok: true,
    courseId: invitation.courseId,
    courseSlug: invitation.course.slug,
    email,
  };
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const m = vi.hoisted(() => ({
  courseFind: vi.fn(),
  invitationCreate: vi.fn(),
  invitationFindUnique: vi.fn(),
  invitationFindMany: vi.fn(),
  invitationUpdateMany: vi.fn(),
  enrollmentCreate: vi.fn(),
  userFindUnique: vi.fn(),
  userCreate: vi.fn(),
  hashPassword: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    course: { findUnique: m.courseFind },
    invitation: {
      create: m.invitationCreate,
      findUnique: m.invitationFindUnique,
      findMany: m.invitationFindMany,
      updateMany: m.invitationUpdateMany,
    },
    enrollment: { create: m.enrollmentCreate },
    user: { findUnique: m.userFindUnique, create: m.userCreate },
  },
}));
vi.mock("@/lib/auth", () => ({
  hashPassword: m.hashPassword,
  normaliseEmail: (email: string) => email.trim().toLowerCase(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: m.trackEvent }));

import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  redeemInvitation,
  revokeInvitation,
} from "./invitation";

const t = (key: string) => key;
const now = new Date("2026-11-04T12:00:00.000Z");
const ownerId = "owner-1";
const courseId = "course-1";

function publishedOwnedCourse(
  overrides: { createdById?: string; status?: string } = {},
) {
  return {
    id: courseId,
    slug: "intro",
    status: overrides.status ?? "PUBLISHED",
    createdById: overrides.createdById ?? ownerId,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.hashPassword.mockResolvedValue("hashed");
  m.trackEvent.mockResolvedValue(undefined);
});

describe("createInvitation", () => {
  it("creates an Invitation for the owner of a PUBLISHED Course", async () => {
    m.courseFind.mockResolvedValue(publishedOwnedCourse());
    m.invitationCreate.mockResolvedValue({
      id: "inv-1",
      token: "tok-abc",
      courseId,
      createdById: ownerId,
      createdAt: now,
      expiresAt: null,
      revokedAt: null,
    });

    const result = await createInvitation({
      courseId,
      actorId: ownerId,
      t,
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.invitation.redeemPath).toBe("/invite/tok-abc");
    expect(result.invitation.status).toBe("active");
    expect(m.invitationCreate).toHaveBeenCalledOnce();
    const created = m.invitationCreate.mock.calls[0][0].data;
    expect(created.courseId).toBe(courseId);
    expect(created.createdById).toBe(ownerId);
    expect(typeof created.token).toBe("string");
    expect(created.token.length).toBeGreaterThanOrEqual(32);
  });

  it("rejects a non-owner", async () => {
    m.courseFind.mockResolvedValue(publishedOwnedCourse());
    const result = await createInvitation({
      courseId,
      actorId: "other",
      t,
      now,
    });
    expect(result).toEqual({ ok: false, error: "server.invitation.notOwner" });
    expect(m.invitationCreate).not.toHaveBeenCalled();
  });

  it("rejects Courses that are not PUBLISHED", async () => {
    m.courseFind.mockResolvedValue(publishedOwnedCourse({ status: "DRAFT" }));
    const result = await createInvitation({
      courseId,
      actorId: ownerId,
      t,
      now,
    });
    expect(result).toEqual({
      ok: false,
      error: "server.invitation.notPublished",
    });
    expect(m.invitationCreate).not.toHaveBeenCalled();
  });

  it("stores an optional expiry", async () => {
    const expiresAt = new Date("2026-12-01T00:00:00.000Z");
    m.courseFind.mockResolvedValue(publishedOwnedCourse());
    m.invitationCreate.mockResolvedValue({
      id: "inv-2",
      token: "tok-exp",
      courseId,
      createdById: ownerId,
      createdAt: now,
      expiresAt,
      revokedAt: null,
    });

    const result = await createInvitation({
      courseId,
      actorId: ownerId,
      expiresAt,
      t,
      now,
    });

    expect(result.ok).toBe(true);
    expect(m.invitationCreate.mock.calls[0][0].data.expiresAt).toEqual(
      expiresAt,
    );
  });
});

describe("listInvitations", () => {
  it("returns active, expired, and revoked states for the owner", async () => {
    m.courseFind.mockResolvedValue(publishedOwnedCourse());
    m.invitationFindMany.mockResolvedValue([
      {
        id: "a",
        token: "t-a",
        createdAt: now,
        expiresAt: null,
        revokedAt: null,
      },
      {
        id: "b",
        token: "t-b",
        createdAt: now,
        expiresAt: new Date("2026-11-01T00:00:00.000Z"),
        revokedAt: null,
      },
      {
        id: "c",
        token: "t-c",
        createdAt: now,
        expiresAt: null,
        revokedAt: new Date("2026-11-03T00:00:00.000Z"),
      },
    ]);

    const result = await listInvitations({
      courseId,
      actorId: ownerId,
      t,
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.invitations.map((row) => row.status)).toEqual([
      "active",
      "expired",
      "revoked",
    ]);
  });

  it("rejects a non-owner", async () => {
    m.courseFind.mockResolvedValue(publishedOwnedCourse());
    const result = await listInvitations({
      courseId,
      actorId: "other",
      t,
      now,
    });
    expect(result).toEqual({ ok: false, error: "server.invitation.notOwner" });
    expect(m.invitationFindMany).not.toHaveBeenCalled();
  });
});

describe("revokeInvitation", () => {
  it("revokes an Invitation owned via the Course", async () => {
    m.invitationFindUnique.mockResolvedValue({
      id: "inv-1",
      courseId,
      revokedAt: null,
      course: { createdById: ownerId },
    });
    m.invitationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await revokeInvitation({
      invitationId: "inv-1",
      actorId: ownerId,
      t,
      now,
    });

    expect(result).toEqual({ ok: true });
    expect(m.invitationUpdateMany).toHaveBeenCalledWith({
      where: { id: "inv-1", revokedAt: null },
      data: { revokedAt: now },
    });
  });

  it("rejects a non-owner", async () => {
    m.invitationFindUnique.mockResolvedValue({
      id: "inv-1",
      courseId,
      revokedAt: null,
      course: { createdById: ownerId },
    });
    const result = await revokeInvitation({
      invitationId: "inv-1",
      actorId: "other",
      t,
      now,
    });
    expect(result).toEqual({ ok: false, error: "server.invitation.notOwner" });
    expect(m.invitationUpdateMany).not.toHaveBeenCalled();
  });
});

describe("redeemInvitation", () => {
  function validInvitation(
    overrides: {
      revokedAt?: Date | null;
      expiresAt?: Date | null;
      status?: string;
    } = {},
  ) {
    return {
      id: "inv-1",
      token: "good-token",
      courseId,
      revokedAt: overrides.revokedAt ?? null,
      expiresAt: overrides.expiresAt ?? null,
      course: {
        id: courseId,
        slug: "intro",
        status: overrides.status ?? "PUBLISHED",
      },
    };
  }

  it("enrolls a signed-in non-Instructor User", async () => {
    m.invitationFindUnique.mockResolvedValue(validInvitation());
    m.enrollmentCreate.mockResolvedValue({ id: "enr-1" });

    const result = await redeemInvitation({
      token: "good-token",
      userId: "learner-1",
      role: "LEARNER",
      t,
      now,
    });

    expect(result).toEqual({
      ok: true,
      courseId,
      courseSlug: "intro",
    });
    expect(m.enrollmentCreate).toHaveBeenCalledWith({
      data: { userId: "learner-1", courseId },
    });
    expect(m.trackEvent).toHaveBeenCalled();
  });

  it("treats an already-enrolled User as success", async () => {
    m.invitationFindUnique.mockResolvedValue(validInvitation());
    m.enrollmentCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const result = await redeemInvitation({
      token: "good-token",
      userId: "learner-1",
      role: "ADMIN",
      t,
      now,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects Instructors", async () => {
    m.invitationFindUnique.mockResolvedValue(validInvitation());
    const result = await redeemInvitation({
      token: "good-token",
      userId: "teacher-1",
      role: "INSTRUCTOR",
      t,
      now,
    });
    expect(result).toEqual({
      ok: false,
      error: "server.invitation.instructorCannotRedeem",
    });
    expect(m.enrollmentCreate).not.toHaveBeenCalled();
  });

  it("rejects unknown tokens", async () => {
    m.invitationFindUnique.mockResolvedValue(null);
    const result = await redeemInvitation({
      token: "missing",
      userId: "learner-1",
      role: "LEARNER",
      t,
      now,
    });
    expect(result).toEqual({ ok: false, error: "server.invitation.invalid" });
  });

  it("rejects when the Course is not PUBLISHED", async () => {
    m.invitationFindUnique.mockResolvedValue(
      validInvitation({ status: "ARCHIVED" }),
    );
    const result = await redeemInvitation({
      token: "good-token",
      userId: "learner-1",
      role: "LEARNER",
      t,
      now,
    });
    expect(result).toEqual({
      ok: false,
      error: "server.invitation.notPublished",
    });
  });

  it("rejects expired Invitations", async () => {
    m.invitationFindUnique.mockResolvedValue(
      validInvitation({ expiresAt: new Date("2026-11-01T00:00:00.000Z") }),
    );
    const result = await redeemInvitation({
      token: "good-token",
      userId: "learner-1",
      role: "LEARNER",
      t,
      now,
    });
    expect(result).toEqual({ ok: false, error: "server.invitation.expired" });
  });

  it("rejects revoked Invitations", async () => {
    m.invitationFindUnique.mockResolvedValue(
      validInvitation({ revokedAt: new Date("2026-11-03T00:00:00.000Z") }),
    );
    const result = await redeemInvitation({
      token: "good-token",
      userId: "learner-1",
      role: "LEARNER",
      t,
      now,
    });
    expect(result).toEqual({ ok: false, error: "server.invitation.revoked" });
  });
});

describe("acceptInvitation", () => {
  function validInvitation() {
    return {
      id: "inv-1",
      token: "good-token",
      courseId,
      revokedAt: null,
      expiresAt: null,
      course: { id: courseId, slug: "intro", status: "PUBLISHED" },
    };
  }

  it("registers a Learner with the chosen password and enrolls them", async () => {
    m.invitationFindUnique.mockResolvedValue(validInvitation());
    m.userFindUnique.mockResolvedValue(null);
    m.userCreate.mockResolvedValue({ id: "new-user" });
    m.enrollmentCreate.mockResolvedValue({ id: "enr-1" });

    const result = await acceptInvitation({
      token: "good-token",
      name: "Ada",
      email: "Ada@Example.com",
      password: "password1",
      t,
      now,
    });

    expect(result).toEqual({
      ok: true,
      courseId,
      courseSlug: "intro",
      email: "ada@example.com",
    });
    expect(m.hashPassword).toHaveBeenCalledWith("password1");
    expect(m.userCreate).toHaveBeenCalledWith({
      data: {
        name: "Ada",
        email: "ada@example.com",
        passwordHash: "hashed",
        role: "LEARNER",
        enrollments: { create: { courseId } },
      },
    });
  });

  it("rejects when the email is already taken", async () => {
    m.invitationFindUnique.mockResolvedValue(validInvitation());
    m.userFindUnique.mockResolvedValue({ id: "existing" });
    const result = await acceptInvitation({
      token: "good-token",
      name: "Ada",
      email: "ada@example.com",
      password: "password1",
      t,
      now,
    });
    expect(result).toEqual({
      ok: false,
      error: "server.invitation.emailTaken",
    });
    expect(m.userCreate).not.toHaveBeenCalled();
  });

  it("rejects invalid registration input", async () => {
    const result = await acceptInvitation({
      token: "good-token",
      name: "",
      email: "not-an-email",
      password: "short",
      t,
      now,
    });
    expect(result).toEqual({
      ok: false,
      error: "server.invitation.invalidRegistration",
    });
    expect(m.invitationFindUnique).not.toHaveBeenCalled();
  });

  it("rejects expired Invitations before creating a User", async () => {
    m.invitationFindUnique.mockResolvedValue({
      ...validInvitation(),
      expiresAt: new Date("2026-11-01T00:00:00.000Z"),
    });
    const result = await acceptInvitation({
      token: "good-token",
      name: "Ada",
      email: "ada@example.com",
      password: "password1",
      t,
      now,
    });
    expect(result).toEqual({ ok: false, error: "server.invitation.expired" });
    expect(m.userCreate).not.toHaveBeenCalled();
  });
});

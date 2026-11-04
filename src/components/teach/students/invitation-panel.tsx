"use client";

import { Copy, Link2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import type { InvitationStatus } from "@/server/invitation";
import {
  createCourseInvitation,
  revokeCourseInvitation,
} from "@/server/invitations";

export type InvitationListItem = {
  id: string;
  redeemPath: string;
  createdAt: string;
  expiresAt: string | null;
  status: InvitationStatus;
};

type InvitationPanelProps = {
  courseId: string;
  coursePublished: boolean;
  initialInvitations: InvitationListItem[];
};

function statusTone(
  status: InvitationStatus,
): "default" | "secondary" | "destructive" {
  if (status === "active") {
    return "default";
  }
  if (status === "revoked") {
    return "destructive";
  }
  return "secondary";
}

export function InvitationPanel({
  courseId,
  coursePublished,
  initialInvitations,
}: InvitationPanelProps) {
  const t = useT();
  const router = useRouter();
  const [invitations, setInvitations] =
    useState<InvitationListItem[]>(initialInvitations);
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCreate(): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const result = await createCourseInvitation(
        courseId,
        expiresAt.length > 0 ? new Date(expiresAt).toISOString() : null,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.invitation !== undefined) {
        const row: InvitationListItem = {
          id: result.invitation.id,
          redeemPath: result.invitation.redeemPath,
          createdAt: new Date(result.invitation.createdAt).toISOString(),
          expiresAt:
            result.invitation.expiresAt === null
              ? null
              : new Date(result.invitation.expiresAt).toISOString(),
          status: result.invitation.status,
        };
        setInvitations((current) => [row, ...current]);
        setExpiresAt("");
      }
      router.refresh();
    } catch (createError: unknown) {
      console.error("[invitation] create failed", createError);
      setError(t("students.invitation.createFailed"));
    } finally {
      setPending(false);
    }
  }

  async function handleRevoke(invitationId: string): Promise<void> {
    setPending(true);
    setError(null);
    try {
      const result = await revokeCourseInvitation(courseId, invitationId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setInvitations((current) =>
        current.map((row) =>
          row.id === invitationId ? { ...row, status: "revoked" as const } : row,
        ),
      );
      router.refresh();
    } catch (revokeError: unknown) {
      console.error("[invitation] revoke failed", revokeError);
      setError(t("students.invitation.revokeFailed"));
    } finally {
      setPending(false);
    }
  }

  async function handleCopy(row: InvitationListItem): Promise<void> {
    const url = `${window.location.origin}${row.redeemPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(row.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === row.id ? null : current));
      }, 2000);
    } catch (copyError: unknown) {
      console.error("[invitation] copy failed", copyError);
      setError(t("students.invitation.copyFailed"));
    }
  }

  return (
    <section
      aria-labelledby="invitation-heading"
      className="space-y-4 rounded-xl p-5 ring-1 ring-foreground/10"
    >
      <div className="space-y-1">
        <h2
          className="flex items-center gap-2 text-base font-medium"
          id="invitation-heading"
        >
          <Link2 aria-hidden="true" className="size-4" />
          {t("students.invitation.title")}
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          {t("students.invitation.description")}
        </p>
      </div>

      {coursePublished ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="invitation-expires">
              {t("students.invitation.expiresLabel")}
            </Label>
            <Input
              id="invitation-expires"
              onChange={(event) => {
                setExpiresAt(event.target.value);
              }}
              type="datetime-local"
              value={expiresAt}
            />
          </div>
          <Button
            disabled={pending}
            onClick={() => {
              void handleCreate();
            }}
          >
            {pending
              ? t("students.invitation.creating")
              : t("students.invitation.create")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("students.invitation.publishFirst")}
        </p>
      )}

      {error === null ? null : (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {invitations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("students.invitation.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg ring-1 ring-foreground/10">
          {invitations.map((row) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
              key={row.id}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusTone(row.status)}>
                    {t(`students.invitation.status.${row.status}`)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {t("students.invitation.created", {
                      date: new Date(row.createdAt).toLocaleString(),
                    })}
                  </span>
                </div>
                {row.expiresAt === null ? null : (
                  <p className="text-xs text-muted-foreground">
                    {t("students.invitation.expiresAt", {
                      date: new Date(row.expiresAt).toLocaleString(),
                    })}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={row.status !== "active"}
                  onClick={() => {
                    void handleCopy(row);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Copy aria-hidden="true" />
                  {copiedId === row.id
                    ? t("students.invitation.copied")
                    : t("students.invitation.copy")}
                </Button>
                <Button
                  disabled={pending || row.status === "revoked"}
                  onClick={() => {
                    void handleRevoke(row.id);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Trash2 aria-hidden="true" />
                  {t("students.invitation.revoke")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

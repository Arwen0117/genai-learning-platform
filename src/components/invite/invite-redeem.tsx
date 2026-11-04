"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";
import type { InvitationStatus } from "@/server/invitation";
import {
  acceptCourseInvitation,
  redeemCourseInvitation,
  type AcceptFormState,
} from "@/server/invitations";

type InviteRedeemProps = {
  token: string;
  courseTitle: string;
  redeemable: boolean;
  status: InvitationStatus;
  signedIn: boolean;
  role: string | null;
};

const INITIAL_ACCEPT: AcceptFormState = { error: null };

export function InviteRedeem({
  token,
  courseTitle,
  redeemable,
  status,
  signedIn,
  role,
}: InviteRedeemProps) {
  const t = useT();
  const [acceptState, acceptAction, acceptPending] = useActionState(
    acceptCourseInvitation,
    INITIAL_ACCEPT,
  );
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemPending, startRedeem] = useTransition();

  const blockedReason = !redeemable
    ? status === "revoked"
      ? t("invite.revoked")
      : status === "expired"
        ? t("invite.expired")
        : t("invite.unavailable")
    : role === "INSTRUCTOR"
      ? t("invite.instructorBlocked")
      : null;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">{t("invite.title")}</CardTitle>
        <CardDescription>
          {t("invite.description", { course: courseTitle })}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {blockedReason !== null ? (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {blockedReason}
          </p>
        ) : null}

        {redeemError === null ? null : (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {redeemError}
          </p>
        )}

        {acceptState.error === null ? null : (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {acceptState.error}
          </p>
        )}

        {blockedReason !== null ? null : signedIn ? (
          <Button
            className="w-full"
            disabled={redeemPending}
            onClick={() => {
              setRedeemError(null);
              startRedeem(async () => {
                const result = await redeemCourseInvitation(token);
                if (result.error !== null) {
                  setRedeemError(result.error);
                }
              });
            }}
          >
            {redeemPending ? t("invite.joining") : t("invite.join")}
          </Button>
        ) : (
          <form action={acceptAction} className="flex flex-col gap-4">
            <input name="token" type="hidden" value={token} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t("auth.field.name")}</Label>
              <Input
                autoComplete="name"
                id="name"
                name="name"
                required
                type="text"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("auth.field.email")}</Label>
              <Input
                autoComplete="email"
                id="email"
                name="email"
                required
                type="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("auth.field.password")}</Label>
              <Input
                autoComplete="new-password"
                id="password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </div>
            <Button className="w-full" disabled={acceptPending} type="submit">
              {acceptPending ? t("invite.registering") : t("invite.register")}
            </Button>
          </form>
        )}
      </CardContent>

      {signedIn || blockedReason !== null ? null : (
        <CardFooter className="justify-center text-sm text-muted-foreground">
          {t("invite.haveAccount")}{" "}
          <Link
            className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}
            href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
          >
            {t("invite.signIn")}
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

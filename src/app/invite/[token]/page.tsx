import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { InviteRedeem } from "@/components/invite/invite-redeem";
import { Skeleton } from "@/components/ui/skeleton";
import { getI18n } from "@/i18n/server";
import { auth } from "@/lib/auth";
import { previewInvitation } from "@/server/invitation";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("invite.metaTitle") };
}

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

async function InviteContent({ params }: InvitePageProps) {
  await connection();
  const { token } = await params;
  const [{ t }, session, preview] = await Promise.all([
    getI18n(),
    auth(),
    previewInvitation({ token }),
  ]);

  if (preview === null) {
    return (
      <div className="mx-auto w-full max-w-md rounded-xl bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
        {t("invite.invalid")}
      </div>
    );
  }

  return (
    <InviteRedeem
      courseTitle={preview.courseTitle}
      redeemable={preview.redeemable}
      role={session?.user?.role ?? null}
      signedIn={session?.user !== undefined}
      status={preview.status}
      token={token}
    />
  );
}

export default function InvitePage(props: InvitePageProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <Suspense fallback={<Skeleton className="h-96 w-full max-w-md rounded-xl" />}>
        <InviteContent params={props.params} />
      </Suspense>
    </main>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, Send } from "lucide-react";
import { sendAccountReadyEmail, type SettingsState } from "@/modules/companies/actions";

export function AccountReadyButton({
  companyId,
  sentAt,
}: {
  companyId: string;
  sentAt?: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState<SettingsState, FormData>(sendAccountReadyEmail, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const sent = Boolean(sentAt) || state?.ok;
  const when = sentAt
    ? new Date(sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-brand-600/10 p-2 text-brand-700">
            <MailCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Finish &amp; notify the customer</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              When you&apos;ve set this company up, send the &ldquo;account ready&rdquo; email — the
              login button that lets them set their password and get started.
            </p>
          </div>
        </div>
        {sent && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
            <MailCheck className="h-3.5 w-3.5" /> Sent{when ? ` · ${when}` : ""}
          </span>
        )}
      </div>

      <form action={action} className="mt-4 flex items-center gap-3">
        <input type="hidden" name="companyId" value={companyId} />
        <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Send className="h-4 w-4" />
          {sent ? "Resend account-ready email" : "Mark setup complete & email them"}
        </button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </form>
    </div>
  );
}

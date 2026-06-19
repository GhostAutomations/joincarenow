"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import { sendRejection } from "@/modules/applications/actions";

const input =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const TEMPLATES: Record<string, string> = {
  unsuccessful:
    "Hi {{first_name}},\n\nThank you for taking the time to apply to {{company_name}} and for your interest in the role. After careful consideration, we won't be taking your application further on this occasion.\n\nWe wish you all the best in your job search.\n\nKind regards,\n{{company_name}}",
  experience:
    "Hi {{first_name}},\n\nThank you for applying to {{company_name}}. On this occasion we've decided to move forward with applicants whose experience more closely matches what the role needs, so we won't be taking your application further.\n\nWe genuinely appreciate your interest and wish you the very best.\n\nKind regards,\n{{company_name}}",
  interview:
    "Hi {{first_name}},\n\nThank you for taking the time to meet with us and for your interest in joining {{company_name}}. It was a difficult decision, but on this occasion we won't be progressing your application further.\n\nWe wish you every success in your search.\n\nKind regards,\n{{company_name}}",
  eligibility:
    "Hi {{first_name}},\n\nThank you for applying to {{company_name}}. Unfortunately we're unable to progress your application at this stage as we couldn't confirm the eligibility requirements for the role.\n\nIf you believe this is incorrect, please do get in touch.\n\nKind regards,\n{{company_name}}",
  filled:
    "Hi {{first_name}},\n\nThank you for your interest in joining {{company_name}}. This position has now been filled, so we won't be progressing your application this time.\n\nWe'd be glad to keep your details on file for future roles — see the link below if you're happy for us to.\n\nKind regards,\n{{company_name}}",
  unresponsive:
    "Hi {{first_name}},\n\nWe tried to reach you regarding your application to {{company_name}} but haven't been able to make contact, so we've closed your application for now.\n\nIf you're still interested, please get in touch and we'll be happy to pick things back up.\n\nKind regards,\n{{company_name}}",
  closed:
    "Hi {{first_name}},\n\nThank you for your interest in {{company_name}}. This role has now closed, so we won't be progressing your application this time.\n\nWe'd love to keep your details on file for future opportunities — see the link below if you're happy for us to.\n\nKind regards,\n{{company_name}}",
  custom: "",
};

/** Move-to-Not-Progressing popup: pick a reason, edit the message, send a reply. */
export function RejectModal({ applicationId, onClose }: { applicationId: string; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState<keyof typeof TEMPLATES>("unsuccessful");
  const [message, setMessage] = useState(TEMPLATES.unsuccessful);
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [talentPool, setTalentPool] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickReason(r: keyof typeof TEMPLATES) {
    setReason(r);
    setMessage(TEMPLATES[r]);
    if (r === "closed") setTalentPool(true);
  }

  async function action(fd: FormData) {
    setBusy(true);
    setError(null);
    fd.set("applicationId", applicationId);
    fd.set("message", message);
    fd.set("channel", channel);
    if (talentPool) fd.set("talentPool", "on");
    const r = await sendRejection(fd);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative mx-auto my-8 w-full max-w-lg px-4">
        <div className="rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Not progressing — send a reply</h2>
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form action={action} className="space-y-3 px-5 py-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Reason</span>
              <select
                value={reason}
                onChange={(e) => pickReason(e.target.value as keyof typeof TEMPLATES)}
                className={input}
              >
                <option value="unsuccessful">Unsuccessful this time</option>
                <option value="experience">Not enough relevant experience</option>
                <option value="interview">Unsuccessful after interview</option>
                <option value="eligibility">Right to work / eligibility not met</option>
                <option value="filled">Position already filled</option>
                <option value="unresponsive">Couldn’t make contact / unresponsive</option>
                <option value="closed">Role now closed — offer talent pool</option>
                <option value="custom">Custom message</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">Message (merge fields like {"{{first_name}}"} are filled in)</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className={`${input} font-mono text-xs leading-relaxed`}
              />
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={talentPool}
                onChange={(e) => setTalentPool(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span>Include a talent-pool opt-in link (email only) — lets them consent to be kept on file.</span>
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">Send by</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value as "email" | "sms" | "both")} className={input}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="both">Email &amp; SMS</option>
              </select>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                Cancel
              </button>
              <button disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60">
                <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send & not progress"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

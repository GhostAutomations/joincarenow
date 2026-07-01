"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { submitDemoLead, type DemoLeadState } from "@/modules/marketing/actions";

const field =
  "mt-1 block w-full rounded-lg border border-white/40 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const label = "block text-sm font-medium text-gray-700";

export function DemoForm() {
  const [state, action, pending] = useActionState<DemoLeadState, FormData>(
    submitDemoLead,
    undefined
  );

  if (state?.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center"
      >
        <CheckCircle2 className="h-10 w-10 text-brand-600" aria-hidden />
        <h3 className="text-lg font-semibold text-gray-900">Thanks — we&apos;ll be in touch</h3>
        <p className="max-w-sm text-sm text-gray-600">
          Your request is in. A member of the team will email you shortly to arrange a
          time that suits you.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      {/* Honeypot — hidden from real users */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_website">Leave this empty</label>
        <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="df-name" className={label}>Your name</label>
          <input id="df-name" name="name" required autoComplete="name" className={field} placeholder="Jane Smith" />
        </div>
        <div>
          <label htmlFor="df-company" className={label}>Care company</label>
          <input id="df-company" name="company" required autoComplete="organization" className={field} placeholder="Sunrise Care Ltd" />
        </div>
        <div>
          <label htmlFor="df-role" className={label}>Your role <span className="text-gray-400">(optional)</span></label>
          <input id="df-role" name="role" autoComplete="organization-title" className={field} placeholder="Registered manager" />
        </div>
        <div>
          <label htmlFor="df-setting" className={label}>Care setting <span className="text-gray-400">(optional)</span></label>
          <select id="df-setting" name="setting" defaultValue="" className={field}>
            <option value="">Select…</option>
            <option value="domiciliary">Domiciliary / home care</option>
            <option value="residential">Residential / care home</option>
            <option value="supported_living">Supported living</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="df-email" className={label}>Work email</label>
          <input id="df-email" name="email" type="email" required autoComplete="email" className={field} placeholder="jane@sunrisecare.co.uk" />
        </div>
        <div>
          <label htmlFor="df-phone" className={label}>Phone <span className="text-gray-400">(optional)</span></label>
          <input id="df-phone" name="phone" type="tel" autoComplete="tel" className={field} placeholder="07700 900000" />
        </div>
        <div>
          <label htmlFor="df-region" className={label}>Region <span className="text-gray-400">(optional)</span></label>
          <input id="df-region" name="region" className={field} placeholder="e.g. South Wales" />
        </div>
        <div>
          <label htmlFor="df-website" className={label}>Website <span className="text-gray-400">(optional)</span></label>
          <input id="df-website" name="website" type="url" autoComplete="url" className={field} placeholder="https://sunrisecare.co.uk" />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5">
        <input id="df-consent" name="consent" type="checkbox" required className="mt-1 h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500" />
        <label htmlFor="df-consent" className="text-sm text-gray-600">
          I&apos;m happy for Join Care Now to contact me about a demo. See our{" "}
          <Link href="/privacy" className="font-medium text-brand-700 underline">privacy notice</Link>.
        </label>
      </div>

      {state?.error && (
        <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
      >
        <Send className="h-4 w-4" aria-hidden />
        {pending ? "Sending…" : "Book a demo"}
      </button>
    </form>
  );
}

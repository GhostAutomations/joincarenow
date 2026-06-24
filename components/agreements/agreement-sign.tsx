"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { signAgreement, type AgreementState } from "@/modules/agreements/actions";

export function AgreementSign({ title, bodyText }: { title: string; bodyText: string }) {
  const [state, action, pending] = useActionState<AgreementState, FormData>(signAgreement, undefined);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center gap-2 text-brand-700">
        <ShieldCheck className="h-5 w-5" />
        <span className="text-sm font-semibold">One last step before you start</span>
      </div>
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-600">Please read and accept the agreement below to activate your account.</p>

      <div className="mt-5 max-h-[48vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 text-sm leading-relaxed text-gray-700 shadow-sm">
        {bodyText.split("\n\n").map((para, i) => (
          <p key={i} className="mb-3 whitespace-pre-line">{para}</p>
        ))}
      </div>

      <form action={action} className="mt-5 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Type your full name to sign
          <input
            name="signer_name"
            autoComplete="name"
            placeholder="e.g. Jane Smith"
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="agree" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
          <span>I have read and agree to the terms above, and I have authority to accept them on behalf of my organisation.</span>
        </label>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
        >
          {pending ? "Activating…" : "Agree & activate my account"}
        </button>
      </form>
    </div>
  );
}

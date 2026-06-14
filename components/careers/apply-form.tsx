"use client";

import { useActionState } from "react";
import { applyToJob } from "@/modules/applicants/actions";
import { SubmitButton, FormError } from "@/components/ui/form";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export type ApplyDefaults = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  postcode?: string;
};

export function ApplyForm({
  jobId,
  defaults,
}: {
  jobId: string;
  defaults?: ApplyDefaults;
}) {
  const [state, action] = useActionState(applyToJob, undefined);

  return (
    <form action={action} className="space-y-5">
      <FormError error={state?.error} />
      <input type="hidden" name="jobId" value={jobId} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            required
            defaultValue={defaults?.firstName}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            required
            defaultValue={defaults?.lastName}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={defaults?.phone}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="postcode" className="block text-sm font-medium text-gray-700">
            Postcode
          </label>
          <input
            id="postcode"
            name="postcode"
            defaultValue={defaults?.postcode}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="coverMessage" className="block text-sm font-medium text-gray-700">
          Why are you a good fit? <span className="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="coverMessage"
          name="coverMessage"
          rows={5}
          className={inputClass}
          placeholder="Tell the employer a little about yourself and your experience…"
        />
      </div>

      <div>
        <label htmlFor="cv" className="block text-sm font-medium text-gray-700">
          Upload your CV <span className="text-gray-400">(optional, PDF/Word, max 5MB)</span>
        </label>
        <input
          id="cv"
          name="cv"
          type="file"
          accept=".pdf,.doc,.docx"
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="rightToWork"
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <span>I confirm I have the right to work in the UK.</span>
      </label>

      <div className="sm:w-48">
        <SubmitButton>Submit application</SubmitButton>
      </div>
    </form>
  );
}

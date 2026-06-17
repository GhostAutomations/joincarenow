"use client";

import { useActionState, useState } from "react";
import { submitReference } from "@/modules/references/actions";
import { DynamicField, type FormField } from "@/components/careers/apply-form";
import { SubmitButton, FormError } from "@/components/ui/form";

type State = { error?: string; ok?: boolean } | undefined;

export function RefereeForm({
  token,
  fields,
}: {
  token: string;
  fields: FormField[];
}) {
  const [state, action] = useActionState<State, FormData>(async (_prev, fd) => {
    return await submitReference(fd);
  }, undefined);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  function track(e: { target: EventTarget | null }) {
    const t = e.target as HTMLInputElement;
    const name = t?.name;
    if (!name || !name.startsWith("field_")) return;
    const id = name.slice("field_".length);
    if (t.type === "checkbox") {
      setAnswers((a) => {
        const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
        const next = t.checked ? [...cur, t.value] : cur.filter((v) => v !== t.value);
        return { ...a, [id]: next };
      });
    } else {
      setAnswers((a) => ({ ...a, [id]: t.value }));
    }
  }

  function visible(f: FormField) {
    if (!f.parent_field_id) return true;
    const v = answers[f.parent_field_id];
    if (v == null) return false;
    return Array.isArray(v) ? v.includes(f.parent_value ?? "") : v === f.parent_value;
  }

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-6 text-center">
        <p className="text-base font-medium text-green-800">Thank you — your reference has been submitted.</p>
        <p className="mt-1 text-sm text-green-700">You can now close this page.</p>
      </div>
    );
  }

  return (
    <form action={action} onChange={track} className="space-y-5">
      <FormError error={state?.error} />
      <input type="hidden" name="token" value={token} />
      {fields.filter(visible).map((f) =>
        f.field_type === "page_break" ? null : <DynamicField key={f.field_id} field={f} />
      )}

      <label className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        <input type="checkbox" name="declaration" required className="mt-0.5 h-4 w-4 rounded border-gray-300" />
        <span>
          I confirm that the information I have provided is accurate and given in good faith, and
          that I am happy to be contacted about this reference if needed.
        </span>
      </label>

      <div className="sm:w-56">
        <SubmitButton>Submit reference</SubmitButton>
      </div>
    </form>
  );
}

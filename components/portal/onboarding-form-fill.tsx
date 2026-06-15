"use client";

import { useActionState, useState } from "react";
import { submitOnboardingForm, type OnbState } from "@/modules/onboarding/actions";
import { DynamicField, type FormField } from "@/components/careers/apply-form";
import { SubmitButton, FormError } from "@/components/ui/form";

export function OnboardingFormFill({
  taskId,
  fields,
}: {
  taskId: string;
  fields: FormField[];
}) {
  const [state, action] = useActionState<OnbState, FormData>(submitOnboardingForm, undefined);
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

  return (
    <form action={action} onChange={track} className="space-y-5">
      <FormError error={state?.error} />
      <input type="hidden" name="taskId" value={taskId} />
      {fields.filter(visible).map((f) =>
        f.field_type === "page_break" ? null : <DynamicField key={f.field_id} field={f} />
      )}
      <div className="sm:w-48">
        <SubmitButton>Submit</SubmitButton>
      </div>
    </form>
  );
}

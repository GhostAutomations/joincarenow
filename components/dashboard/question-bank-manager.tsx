"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import {
  saveQuestionTemplate,
  deleteQuestionTemplate,
  type QuestionState,
} from "@/modules/questions/actions";

export type QuestionTemplate = {
  id: string;
  label: string;
  field_type: string;
  options: string[];
  help_text: string | null;
  category: string;
};

const TYPES = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes / No" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Single select" },
  { value: "checkboxes", label: "Multi select" },
];
const CHOICE = ["dropdown", "radio", "checkboxes"];
const cls =
  "mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function QuestionBankManager({ questions }: { questions: QuestionTemplate[] }) {
  const [state, action] = useActionState<QuestionState, FormData>(saveQuestionTemplate, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<QuestionTemplate | null>(null);
  const [type, setType] = useState("short_text");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setEditing(null);
      setType("short_text");
    }
  }, [state]);

  function edit(q: QuestionTemplate) {
    setEditing(q);
    setType(q.field_type);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Group by category for the list.
  const byCat = new Map<string, QuestionTemplate[]>();
  for (const q of questions) {
    const list = byCat.get(q.category) ?? [];
    list.push(q);
    byCat.set(q.category, list);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-6 shadow-sm">
        <h2 className="text-base font-medium text-gray-900">
          {editing ? "Edit question" : "Add a question"}
        </h2>
        <form ref={formRef} action={action} className="mt-4 space-y-3" key={editing?.id ?? "new"}>
          {state?.error && (
            <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{state.error}</p>
          )}
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <label className="block text-xs font-medium text-gray-600">
            Question
            <input name="label" defaultValue={editing?.label ?? ""} placeholder="e.g. Do you hold a full UK driving licence?" className={cls} />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-gray-600">
              Answer type
              <select name="fieldType" value={type} onChange={(e) => setType(e.target.value)} className={cls}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Category
              <input name="category" defaultValue={editing?.category ?? ""} placeholder="e.g. Experience" className={cls} />
            </label>
          </div>

          {CHOICE.includes(type) && (
            <label className="block text-xs font-medium text-gray-600">
              Options (one per line)
              <textarea name="options" rows={4} defaultValue={editing?.options.join("\n") ?? ""} className={cls} />
            </label>
          )}

          <label className="block text-xs font-medium text-gray-600">
            Help text (optional)
            <input name="helpText" defaultValue={editing?.help_text ?? ""} className={cls} />
          </label>

          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              {editing ? "Save changes" : "Add question"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(null); setType("short_text"); formRef.current?.reset(); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {questions.length === 0 ? (
        <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
          No questions yet. Add your first above.
        </div>
      ) : (
        [...byCat.entries()].map(([cat, list]) => (
          <section key={cat}>
            <h3 className="text-sm font-medium text-white drop-shadow-sm">{cat}</h3>
            <ul className="mt-2 divide-y divide-gray-100 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm">
              {list.map((q) => (
                <li key={q.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{q.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {TYPES.find((t) => t.value === q.field_type)?.label ?? q.field_type}
                      {q.options.length > 0 && ` · ${q.options.length} options`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => edit(q)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <form action={deleteQuestionTemplate}>
                      <input type="hidden" name="id" value={q.id} />
                      <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

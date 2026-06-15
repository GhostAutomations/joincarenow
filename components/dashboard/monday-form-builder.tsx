"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Lock, Trash2, Plus, GripVertical, ImagePlus, X, GitBranch, Eye,
  AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";
import {
  addFieldOfType, deleteField, reorderFields, updateFormHeader, uploadFormLogo,
} from "@/modules/forms/actions";
import { FieldForm, type FieldDefaults } from "@/components/dashboard/field-form";
import { FormPreview } from "@/components/dashboard/form-preview";
import { type FormField } from "@/components/careers/apply-form";

export type BuilderField = {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  options: string[];
  help_text: string | null;
  config: { text?: string; size?: string; color?: string } | null;
  parent_field_id: string | null;
  parent_value: string | null;
};

const CHOICE_FIELD = ["dropdown", "radio", "checkboxes", "yes_no"];
function optionsFor(f: BuilderField): string[] {
  return f.field_type === "yes_no" ? ["Yes", "No"] : f.options ?? [];
}

type FormMeta = {
  id: string;
  name: string;
  description: string;
  style: {
    title?: { color?: string; size?: string; align?: string };
    description?: { color?: string; size?: string; align?: string };
    logo_url?: string;
  };
};

const PALETTE: { value: string; label: string }[] = [
  { value: "body_text", label: "Body text / heading" },
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Single select" },
  { value: "checkboxes", label: "Multi select" },
  { value: "yes_no", label: "Yes / No" },
  { value: "file", label: "File upload" },
  { value: "signature", label: "Signature" },
  { value: "address", label: "Address" },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PALETTE.map((p) => [p.value, p.label])
);
const SIZE_CLASS: Record<string, string> = {
  sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl", "3xl": "text-3xl",
};
const TITLE_SIZES = ["lg", "xl", "2xl", "3xl"];
const DESC_SIZES = ["sm", "base", "lg", "xl"];
const alignCls = (a?: string) =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

export function MondayFormBuilder({ form, fields }: { form: FormMeta; fields: BuilderField[] }) {
  const router = useRouter();
  const [name, setName] = useState(form.name === "Untitled form" ? "" : form.name);
  const [desc, setDesc] = useState(form.description);
  const [tColor, setTColor] = useState(form.style.title?.color ?? "#111827");
  const [tSize, setTSize] = useState(form.style.title?.size ?? "2xl");
  const [tAlign, setTAlign] = useState(form.style.title?.align ?? "left");
  const [dColor, setDColor] = useState(form.style.description?.color ?? "#6b7280");
  const [dSize, setDSize] = useState(form.style.description?.size ?? "sm");
  const [dAlign, setDAlign] = useState(form.style.description?.align ?? "left");
  const [logoUrl, setLogoUrl] = useState(form.style.logo_url ?? "");

  const [selected, setSelected] = useState<string | null>(null);
  const [openPlus, setOpenPlus] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [order, setOrder] = useState<string[]>(fields.map((f) => f.id));
  const dragId = useRef<string | null>(null);
  const headerMounted = useRef(false);

  useEffect(() => setOrder(fields.map((f) => f.id)), [fields]);

  useEffect(() => {
    if (!headerMounted.current) {
      headerMounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      updateFormHeader({
        id: form.id,
        name,
        description: desc,
        style: {
          title: { color: tColor, size: tSize, align: tAlign },
          description: { color: dColor, size: dSize, align: dAlign },
          logo_url: logoUrl,
        },
      }).then(() => router.refresh());
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, desc, tColor, tSize, tAlign, dColor, dSize, dAlign, logoUrl]);

  const byId = new Map(fields.map((f) => [f.id, f]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as BuilderField[];

  async function addAt(afterId: string, type: string) {
    const fd = new FormData();
    fd.append("formId", form.id);
    fd.append("afterId", afterId);
    fd.append("fieldType", type);
    const id = await addFieldOfType(fd);
    setOpenPlus(null);
    if (id) setSelected(id);
    router.refresh();
  }

  async function addFollowUp(parentId: string, value: string, type: string) {
    const fd = new FormData();
    fd.append("formId", form.id);
    fd.append("parentFieldId", parentId);
    fd.append("parentValue", value);
    fd.append("fieldType", type);
    const id = await addFieldOfType(fd);
    if (id) setSelected(id);
    router.refresh();
  }

  async function onLogo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("id", form.id);
    fd.append("logo", f);
    const res = await uploadFormLogo(fd);
    if (res.url) setLogoUrl(res.url);
  }

  function onDrop(targetId: string) {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    const next = [...order];
    next.splice(next.indexOf(from), 1);
    next.splice(next.indexOf(targetId), 0, from);
    setOrder(next);
    reorderFields(form.id, next).then(() => router.refresh());
  }

  const previewFields: FormField[] = ordered.map((f) => ({
    field_id: f.id,
    label: f.label,
    field_type: f.field_type,
    required: f.required,
    options: f.options ?? [],
    help_text: f.help_text,
    config: f.config,
    parent_field_id: f.parent_field_id,
    parent_value: f.parent_value,
    field_position: 0,
  }));

  return (
    <>
    <div className="mb-3 flex justify-end">
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        <Eye className="h-4 w-4" /> Preview form
      </button>
    </div>
    <div className="grid grid-cols-[180px_1fr] gap-4">
      {/* LEFT: content outline */}
      <aside className="h-max rounded-xl border border-gray-200 bg-white p-3">
        <p className="mb-2 text-xs font-medium text-gray-900">Content</p>
        <button
          onClick={() => setSelected("title")}
          className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-100"
        >
          Welcome / title
        </button>
        <div className="mt-1 rounded-md px-2 py-1.5 text-xs text-gray-400">Full name</div>
        {ordered.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelected(f.id)}
            className={`mt-1 block w-full truncate rounded-md px-2 py-1.5 text-left text-xs ${
              selected === f.id ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {f.field_type === "body_text" ? f.config?.text || "Body text" : f.label}
          </button>
        ))}
      </aside>

      {/* RIGHT: canvas */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        {/* logo */}
        <div className="mb-3">
          {logoUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Logo" className="h-12 w-auto rounded" />
              <button onClick={() => setLogoUrl("")} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          ) : (
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-gray-500 hover:text-brand-700">
              <ImagePlus className="h-4 w-4" /> Add logo
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
          )}
        </div>

        {/* title */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => setSelected("title")}
          placeholder="Form title"
          style={{ color: tColor }}
          className={`block w-full border-0 px-0 font-bold placeholder-gray-300 focus:outline-none focus:ring-0 ${SIZE_CLASS[tSize]} ${alignCls(tAlign)}`}
        />
        {selected === "title" && (
          <Toolbar sizes={TITLE_SIZES} size={tSize} setSize={setTSize} color={tColor} setColor={setTColor} align={tAlign} setAlign={setTAlign} />
        )}

        {/* description */}
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onFocus={() => setSelected("description")}
          rows={2}
          placeholder="Add a description"
          style={{ color: dColor }}
          className={`mt-2 block w-full resize-none border-0 px-0 placeholder-gray-300 focus:outline-none focus:ring-0 ${SIZE_CLASS[dSize]} ${alignCls(dAlign)}`}
        />
        {selected === "description" && (
          <Toolbar sizes={DESC_SIZES} size={dSize} setSize={setDSize} color={dColor} setColor={setDColor} align={dAlign} setAlign={setDAlign} />
        )}

        <div className="my-4 h-px bg-gray-100" />

        {/* locked name */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Full name</p>
            <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Lock className="h-3 w-3" /> Always included</span>
          </div>
        </div>

        <PlusRow
          open={openPlus === ""}
          onToggle={() => {
            setSelected(null);
            setOpenPlus(openPlus === "" ? null : "");
          }}
          onPick={(t) => addAt("", t)}
        />

        {ordered.map((f) => (
          <div key={f.id}>
            <div
              draggable={selected !== f.id}
              onDragStart={() => (dragId.current = f.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(f.id)}
              className={`rounded-lg border bg-white ${selected === f.id ? "border-brand-400 ring-1 ring-brand-200" : "border-gray-200"} ${f.parent_field_id ? "ml-6 border-l-2 border-l-brand-200" : ""}`}
            >
              {selected === f.id ? (
                <div className="p-4">
                  <FieldForm
                    formId={form.id}
                    defaults={{
                      id: f.id, label: f.label, fieldType: f.field_type, required: f.required,
                      options: f.options ?? [], helpText: f.help_text ?? "", config: f.config ?? null,
                    } as FieldDefaults}
                  />
                  {CHOICE_FIELD.includes(f.field_type) && (
                    <LogicPanel
                      options={optionsFor(f)}
                      onAdd={(value, t) => addFollowUp(f.id, value, t)}
                    />
                  )}
                  <div className="mt-3 flex border-t border-gray-100 pt-3">
                    <form action={deleteField} className="ml-auto">
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="formId" value={form.id} />
                      <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <button onClick={() => setSelected(f.id)} className="flex w-full items-center gap-3 p-4 text-left">
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-300" />
                  <span className="min-w-0">
                    {f.parent_field_id && (
                      <span className="mb-0.5 block text-xs font-medium text-brand-600">
                        Follow-up · shows if answer = “{f.parent_value}”
                      </span>
                    )}
                    {f.field_type === "body_text" ? (
                      <span className="text-sm text-gray-600">{f.config?.text || "Body text"}</span>
                    ) : (
                      <>
                        <span className="block text-sm font-medium text-gray-900">
                          {f.label}
                          {f.required && <span className="ml-1 text-red-500">*</span>}
                        </span>
                        <span className="block text-xs text-gray-400">{TYPE_LABEL[f.field_type] ?? f.field_type}</span>
                      </>
                    )}
                  </span>
                </button>
              )}
            </div>
            <PlusRow
              open={openPlus === f.id}
              onToggle={() => {
                setSelected(null);
                setOpenPlus(openPlus === f.id ? null : f.id);
              }}
              onPick={(t) => addAt(f.id, t)}
            />
          </div>
        ))}
      </div>
    </div>
    {showPreview && (
      <FormPreview
        form={{ name, description: desc, style: { title: { color: tColor, size: tSize, align: tAlign }, description: { color: dColor, size: dSize, align: dAlign }, logo_url: logoUrl } }}
        fields={previewFields}
        onClose={() => setShowPreview(false)}
      />
    )}
    </>
  );
}

function PlusRow({ open, onToggle, onPick }: { open: boolean; onToggle: () => void; onPick: (t: string) => void }) {
  return (
    <div className="py-2">
      <div className="flex justify-center">
        <button
          onClick={onToggle}
          aria-label="Add a field here"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="mx-auto mt-2 grid max-w-md grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:grid-cols-3">
          {PALETTE.map((t) => (
            <button
              key={t.value}
              onClick={() => onPick(t.value)}
              className="rounded-md border border-gray-200 px-2 py-1.5 text-left text-xs text-gray-700 hover:border-brand-300 hover:bg-brand-50"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LogicPanel({
  options,
  onAdd,
}: {
  options: string[];
  onAdd: (value: string, type: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(options[0] ?? "");

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        <GitBranch className="h-3.5 w-3.5" /> Logic
      </button>
      {open && (
        <div className="mt-2 rounded-lg bg-gray-50 p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span>Add a follow-up shown when the answer is</span>
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded border border-gray-300 px-1.5 py-1 text-xs"
            >
              {options.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-xs text-gray-500">Pick the follow-up field type:</p>
          <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {PALETTE.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  onAdd(value, t.value);
                  setOpen(false);
                }}
                className="rounded-md border border-gray-200 px-2 py-1.5 text-left text-xs text-gray-700 hover:border-brand-300 hover:bg-brand-50"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Toolbar({
  sizes, size, setSize, color, setColor, align, setAlign,
}: {
  sizes: string[]; size: string; setSize: (s: string) => void;
  color: string; setColor: (c: string) => void; align: string; setAlign: (a: string) => void;
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md bg-gray-50 p-1.5">
      <select value={size} onChange={(e) => setSize(e.target.value)} className="h-7 rounded border border-gray-300 px-1 text-xs" aria-label="Font size">
        {sizes.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
      </select>
      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-8 rounded border border-gray-300" aria-label="Colour" />
      <div className="flex overflow-hidden rounded border border-gray-300">
        {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => (
          <button key={a} onClick={() => setAlign(a)} className={`p-1.5 ${align === a ? "bg-brand-100 text-brand-700" : "bg-white text-gray-500 hover:bg-gray-100"}`} aria-label={`Align ${a}`}>
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

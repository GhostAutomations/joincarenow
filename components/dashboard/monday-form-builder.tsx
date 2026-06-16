"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
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

/** Client-side default for a freshly added field, mirroring the server's
 *  defaultField() so we can show it instantly (optimistic) without a refresh. */
function clientDefault(id: string, type: string): BuilderField {
  const base: BuilderField = {
    id, field_type: type, label: "Untitled question", required: false,
    options: [], help_text: null, config: null, parent_field_id: null, parent_value: null,
  };
  if (type === "body_text")
    return { ...base, label: "Information", config: { text: "Add your text here", size: "normal", color: "#374151" } };
  if (CHOICE_FIELD.includes(type)) return { ...base, options: ["Option 1"] };
  if (type === "address") return { ...base, label: "Address" };
  if (type === "page_break") return { ...base, label: "Page break" };
  if (type === "branch") return { ...base, label: "Branch" };
  if (type === "role") return { ...base, label: "Role" };
  if (type === "transport") return { ...base, label: "Transport" };
  return base;
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
  { value: "branch", label: "Branch (company list)" },
  { value: "role", label: "Role (company list)" },
  { value: "transport", label: "Transport (Driver / Walker)" },
  { value: "file", label: "File upload" },
  { value: "signature", label: "Signature" },
  { value: "address", label: "Address" },
  { value: "page_break", label: "New page" },
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

export function MondayFormBuilder({
  form,
  fields,
  managed,
}: {
  form: FormMeta;
  fields: BuilderField[];
  managed?: { branch: string[]; role: string[] };
}) {
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
  const [flds, setFlds] = useState<BuilderField[]>(fields);
  const [order, setOrder] = useState<string[]>(fields.map((f) => f.id));
  const dragId = useRef<string | null>(null);
  const headerMounted = useRef(false);

  // Note: we intentionally do NOT resync from `fields` props after mount.
  // The builder owns its state optimistically; resyncing on every server
  // round-trip caused the page to re-render and jump. Fresh data is picked up
  // on a full mount (e.g. switching back from the PDF import tab).

  useEffect(() => {
    if (!headerMounted.current) {
      headerMounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      // Persist quietly; local state already reflects these, so no refresh
      // (a refresh here causes a jarring full re-render of the builder).
      updateFormHeader({
        id: form.id,
        name,
        description: desc,
        style: {
          title: { color: tColor, size: tSize, align: tAlign },
          description: { color: dColor, size: dSize, align: dAlign },
          logo_url: logoUrl,
        },
      });
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, desc, tColor, tSize, tAlign, dColor, dSize, dAlign, logoUrl]);

  const byId = new Map(flds.map((f) => [f.id, f]));
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as BuilderField[];

  /** Swap a temporary field id for the real one returned by the server. */
  function reconcileId(tempId: string, realId: string | null) {
    if (!realId) {
      // Persist failed — roll the optimistic field back out.
      setFlds((prev) => prev.filter((f) => f.id !== tempId));
      setOrder((prev) => prev.filter((x) => x !== tempId));
      setSelected((s) => (s === tempId ? null : s));
      return;
    }
    setFlds((prev) => prev.map((f) => (f.id === tempId ? { ...f, id: realId } : f)));
    setOrder((prev) => prev.map((x) => (x === tempId ? realId : x)));
    setSelected((s) => (s === tempId ? realId : s));
  }

  async function addAt(afterId: string, type: string) {
    // Insert instantly with a temp id (no awaiting), then persist + reconcile.
    // This keeps the field exactly where the "+" was — no scroll jump.
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    setFlds((prev) => [...prev, clientDefault(tempId, type)]);
    setOrder((prev) => {
      const next = [...prev];
      const idx = afterId ? next.indexOf(afterId) + 1 : next.length;
      next.splice(idx, 0, tempId);
      return next;
    });
    setOpenPlus(null);
    setSelected(tempId);

    const fd = new FormData();
    fd.append("formId", form.id);
    fd.append("afterId", afterId);
    fd.append("fieldType", type);
    reconcileId(tempId, await addFieldOfType(fd));
  }

  async function addFollowUp(parentId: string, value: string, type: string) {
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    setFlds((prev) => [
      ...prev,
      { ...clientDefault(tempId, type), parent_field_id: parentId, parent_value: value },
    ]);
    setOrder((prev) => {
      const next = [...prev];
      next.splice(next.indexOf(parentId) + 1, 0, tempId);
      return next;
    });
    setSelected(tempId);

    const fd = new FormData();
    fd.append("formId", form.id);
    fd.append("parentFieldId", parentId);
    fd.append("parentValue", value);
    fd.append("fieldType", type);
    reconcileId(tempId, await addFieldOfType(fd));
  }

  function removeField(id: string) {
    setSelected(null);
    setFlds((prev) => prev.filter((f) => f.id !== id));
    setOrder((prev) => prev.filter((x) => x !== id));
    const fd = new FormData();
    fd.append("id", id);
    fd.append("formId", form.id);
    deleteField(fd);
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
    reorderFields(form.id, next); // persist quietly; order already updated locally
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
    {/* Small screens: Preview sits above the form (no side gutters there). */}
    <div className="mb-3 flex justify-end xl:hidden">
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        <Eye className="h-4 w-4" /> Preview form
      </button>
    </div>
    {/* Centred form canvas (page-centre, aligned with the dock); the content
        outline floats into the left gutter and Preview into the right gutter,
        both level with the top of the form, on wide screens. */}
    <div className="relative mx-auto w-full max-w-2xl pb-4">
      {/* RIGHT gutter: Preview, level with the top of the form. */}
      <button
        type="button"
        onClick={() => setShowPreview(true)}
        className="absolute left-full top-0 ml-6 hidden items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 xl:inline-flex"
      >
        <Eye className="h-4 w-4" /> Preview form
      </button>
      {/* LEFT: content outline */}
      <aside className="absolute right-full top-0 mr-6 hidden h-max w-44 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm p-3 xl:block">
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
      <div className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm p-6 sm:p-8">
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

        {ordered.map((f) =>
          f.field_type === "page_break" ? (
            <div key={f.id}>
              <div className="flex items-center gap-3 py-2">
                <div className="h-px flex-1 bg-brand-200" />
                <span className="text-xs font-medium uppercase tracking-wide text-brand-600">
                  Page break
                </span>
                <button
                  type="button"
                  onClick={() => removeField(f.id)}
                  aria-label="Remove page break"
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="h-px flex-1 bg-brand-200" />
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
          ) : (
          <div key={f.id}>
            <div
              draggable={selected !== f.id}
              onDragStart={() => (dragId.current = f.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(f.id)}
              className={`jcn-field-in rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${selected === f.id ? "border-brand-400 ring-2 ring-brand-200" : "border-gray-200"} ${f.parent_field_id ? "ml-6 border-l-2 border-l-brand-200" : ""}`}
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
                    <button
                      type="button"
                      onClick={() => removeField(f.id)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
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
        managed={managed}
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
            {PALETTE.filter((t) => t.value !== "page_break").map((t) => (
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

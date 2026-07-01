"use client";

import {
  useActionState,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { applyToJob } from "@/modules/applicants/actions";
import { SubmitButton, FormError } from "@/components/ui/form";
import { COUNTRIES, toE164 } from "@/lib/countries";

const inputClass =
  "mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export type ApplyDefaults = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  postcode?: string;
};

export type FormField = {
  field_id: string;
  label: string;
  field_type: string;
  required: boolean;
  options: string[];
  help_text: string | null;
  config: { text?: string; size?: string; color?: string } | null;
  parent_field_id: string | null;
  parent_value: string | null;
  field_position: number;
};

/** Options for the managed-list field types, resolved per company. */
export type ManagedOptions = { branch: string[]; role: string[] };
export const TRANSPORT_OPTIONS = ["Driver", "Walker"];

/** Resolve the dropdown options for any field, including managed types. */
export function fieldOptions(field: FormField, managed?: ManagedOptions): string[] {
  if (field.field_type === "transport") return TRANSPORT_OPTIONS;
  if (field.field_type === "branch") return managed?.branch ?? [];
  if (field.field_type === "role") return managed?.role ?? [];
  if (field.field_type === "yes_no") return ["Yes", "No"];
  return field.options;
}

export function ApplyForm({
  jobId,
  defaults,
  formFields = [],
  managed,
}: {
  jobId: string;
  defaults?: ApplyDefaults;
  formFields?: FormField[];
  managed?: ManagedOptions;
}) {
  const [state, action] = useActionState(applyToJob, undefined);
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

  function visible(f: FormField): boolean {
    if (!f.parent_field_id) return true;
    const v = answers[f.parent_field_id];
    if (v == null) return false;
    return Array.isArray(v) ? v.includes(f.parent_value ?? "") : v === f.parent_value;
  }

  const formRef = useRef<HTMLFormElement>(null);
  const [page, setPage] = useState(0);

  // Split custom fields into pages at each page break.
  const pages: FormField[][] = [[]];
  for (const f of formFields) {
    if (f.field_type === "page_break") pages.push([]);
    else pages[pages.length - 1].push(f);
  }
  const lastPage = pages.length - 1;

  function goNext() {
    const el = formRef.current?.querySelector(`[data-page="${page}"]`);
    if (el) {
      const controls = Array.from(
        el.querySelectorAll<HTMLInputElement>("input, select, textarea")
      );
      for (const c of controls) {
        if (!c.checkValidity()) {
          c.reportValidity();
          return;
        }
      }
    }
    setPage((p) => Math.min(p + 1, lastPage));
  }

  const basics = (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First name</label>
          <input id="firstName" name="firstName" required defaultValue={defaults?.firstName} className={inputClass} />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last name</label>
          <input id="lastName" name="lastName" required defaultValue={defaults?.lastName} className={inputClass} />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={defaults?.phone} className={inputClass} />
        </div>
        <div>
          <label htmlFor="postcode" className="block text-sm font-medium text-gray-700">Postcode</label>
          <input id="postcode" name="postcode" defaultValue={defaults?.postcode} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="coverMessage" className="block text-sm font-medium text-gray-700">
          Why are you a good fit? <span className="text-gray-400">(optional)</span>
        </label>
        <textarea id="coverMessage" name="coverMessage" rows={5} className={inputClass}
          placeholder="Tell the employer a little about yourself and your experience…" />
      </div>
      <div>
        <label htmlFor="cv" className="block text-sm font-medium text-gray-700">
          Upload your CV <span className="text-gray-400">(optional, PDF/Word, max 5MB)</span>
        </label>
        <input id="cv" name="cv" type="file" accept=".pdf,.doc,.docx"
          className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
      </div>
    </>
  );

  const rightToWork = (
    <label className="flex items-start gap-2 text-sm text-gray-700">
      <input type="checkbox" name="rightToWork"
        className="mt-0.5 h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500" />
      <span>I confirm I have the right to work in the UK.</span>
    </label>
  );

  return (
    <form ref={formRef} action={action} onChange={track} className="space-y-5">
      <FormError error={state?.error} />
      <input type="hidden" name="jobId" value={jobId} />

      {pages.map((pageFields, idx) => (
        <div key={idx} data-page={idx} className={idx === page ? "space-y-5" : "hidden"}>
          {idx === 0 && basics}
          {pageFields.filter(visible).map((f) => (
            <DynamicField key={f.field_id} field={f} managed={managed} />
          ))}
          {idx === lastPage && rightToWork}
        </div>
      ))}

      <div className="flex items-center justify-between gap-3 pt-2">
        {page > 0 ? (
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-white/40 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-white/70"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        {lastPage > 0 && (
          <span className="text-xs text-gray-400">Page {page + 1} of {pages.length}</span>
        )}
        {page < lastPage ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Next
          </button>
        ) : (
          <div className="sm:w-48">
            <SubmitButton>Submit application</SubmitButton>
          </div>
        )}
      </div>
    </form>
  );
}

const SIZE_CLASS: Record<string, string> = {
  small: "text-xs",
  normal: "text-sm",
  large: "text-lg",
  xl: "text-2xl",
};

export function DynamicField({
  field,
  managed,
  defaults,
}: {
  field: FormField;
  managed?: ManagedOptions;
  defaults?: Record<string, string | string[]>;
}) {
  const name = `field_${field.field_id}`;
  const req = field.required;
  const dv = defaults?.[field.field_id];
  const dvStr = Array.isArray(dv) ? (dv[0] ?? "") : (dv ?? "");
  const dvArr = Array.isArray(dv) ? dv : dv != null && dv !== "" ? [dv] : [];

  // Static information block — not an input.
  if (field.field_type === "body_text") {
    const sizeClass = SIZE_CLASS[field.config?.size ?? "normal"] ?? "text-sm";
    return (
      <div>
        {field.label && field.label !== "Information" && (
          <p className="mb-1 text-sm font-semibold text-gray-900">{field.label}</p>
        )}
        <p
          className={`whitespace-pre-wrap ${sizeClass}`}
          style={{ color: field.config?.color ?? "#374151" }}
        >
          {field.config?.text ?? ""}
        </p>
      </div>
    );
  }

  if (field.field_type === "signature") {
    return <SignatureField name={name} label={field.label} required={req} help={field.help_text} initial={dvStr} />;
  }
  if (field.field_type === "email") {
    return <EmailField name={name} label={field.label} required={req} help={field.help_text} initial={dvStr} />;
  }
  if (field.field_type === "phone") {
    return <PhoneField name={name} label={field.label} required={req} help={field.help_text} initial={dvStr} />;
  }
  const label = (
    <span className="block text-sm font-medium text-gray-700">
      {field.label}
      {req && <span className="ml-0.5 text-red-500">*</span>}
    </span>
  );
  const help = field.help_text ? (
    <span className="mt-0.5 block text-xs text-gray-500">{field.help_text}</span>
  ) : null;

  if (field.field_type === "long_text") {
    return (
      <label className="block">
        {label}
        {help}
        <textarea name={name} required={req} rows={4} defaultValue={dvStr} className={inputClass} />
      </label>
    );
  }
  if (
    field.field_type === "dropdown" ||
    field.field_type === "branch" ||
    field.field_type === "role" ||
    field.field_type === "transport"
  ) {
    const opts = fieldOptions(field, managed);
    const managedEmpty =
      (field.field_type === "branch" || field.field_type === "role") && opts.length === 0;
    return (
      <label className="block">
        {label}
        {help}
        <select name={name} required={req} defaultValue={dvStr || ""} className={inputClass} disabled={managedEmpty}>
          <option value="" disabled>
            {managedEmpty ? "Set per company in Settings" : "Select…"}
          </option>
          {opts.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.field_type === "radio" || field.field_type === "yes_no") {
    const opts = field.field_type === "yes_no" ? ["Yes", "No"] : field.options;
    return (
      <fieldset>
        {label}
        {help}
        <div className="mt-1 space-y-1">
          {opts.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="radio" name={name} value={o} required={req} defaultChecked={dvStr === o} />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  if (field.field_type === "checkboxes") {
    return (
      <fieldset>
        {label}
        {help}
        <div className="mt-1 space-y-1">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name={name} value={o} defaultChecked={dvArr.includes(o)} />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  if (field.field_type === "file") {
    return (
      <label className="block">
        {label}
        {help}
        <input type="file" name={name} required={req} className="mt-1 block w-full text-sm" />
      </label>
    );
  }
  if (field.field_type === "address") {
    return (
      <fieldset>
        {label}
        {help}
        <div className="mt-1 space-y-2">
          <input name={name} required={req} placeholder="Address line 1" defaultValue={dvArr[0] ?? ""} className={inputClass} />
          <input name={name} placeholder="Address line 2 (optional)" defaultValue={dvArr[1] ?? ""} className={inputClass} />
          <input name={name} placeholder="Town / city" defaultValue={dvArr[2] ?? ""} className={inputClass} />
          <input name={name} placeholder="County" defaultValue={dvArr[3] ?? ""} className={inputClass} />
          <input name={name} placeholder="Postcode / ZIP" defaultValue={dvArr[4] ?? ""} className={inputClass} />
          <select name={name} defaultValue={dvArr[5] ?? "United Kingdom"} className={inputClass} aria-label="Country">
            {COUNTRIES.map((c) => (
              <option key={c.iso} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
    );
  }

  if (field.field_type === "country") {
    return (
      <label className="block">
        {label}
        {help}
        <select name={name} required={req} defaultValue={dvStr || ""} className={inputClass}>
          <option value="" disabled>Select a country…</option>
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.name}>{c.name}</option>
          ))}
        </select>
      </label>
    );
  }
  if (field.field_type === "date_range") {
    // Two date inputs share the field name → collected as [from, to].
    return (
      <fieldset>
        {label}
        {help}
        <div className="mt-1 flex flex-wrap items-end gap-3">
          <label className="text-xs text-gray-500">
            From
            <input type="date" name={name} required={req} defaultValue={dvArr[0] ?? ""} className={inputClass} />
          </label>
          <label className="text-xs text-gray-500">
            To
            <input type="date" name={name} required={req} defaultValue={dvArr[1] ?? ""} className={inputClass} />
          </label>
        </div>
      </fieldset>
    );
  }
  if (field.field_type === "rating") {
    return <RatingField name={name} label={field.label} required={req} help={field.help_text} initial={dvStr} />;
  }

  // short_text, number, date, month, time, link
  const type =
    field.field_type === "number"
      ? "number"
      : field.field_type === "date"
      ? "date"
      : field.field_type === "month"
      ? "month"
      : field.field_type === "time"
      ? "time"
      : field.field_type === "link"
      ? "url"
      : "text";
  return (
    <label className="block">
      {label}
      {help}
      <input
        type={type}
        name={name}
        required={req}
        defaultValue={dvStr}
        placeholder={field.field_type === "link" ? "https://…" : undefined}
        className={inputClass}
      />
    </label>
  );
}

function SignatureField({
  name,
  label,
  required,
  help,
  initial = "",
}: {
  name: string;
  label: string;
  required: boolean;
  help: string | null;
  initial?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [value, setValue] = useState(initial);
  const loaded = useRef(false);

  // Paint the previously-captured signature onto the canvas once.
  function paintInitial(c: HTMLCanvasElement | null) {
    canvasRef.current = c;
    if (!c || loaded.current || !initial.startsWith("data:image")) return;
    loaded.current = true;
    const img = new Image();
    img.onload = () => c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    img.src = initial;
  }

  function point(e: ReactPointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }
  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    setValue(canvasRef.current!.toDataURL("image/png"));
  }
  function clear() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setValue("");
  }

  return (
    <div>
      <span className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {help && <span className="mt-0.5 block text-xs text-gray-500">{help}</span>}
      <div className="mt-1 inline-block rounded-md border border-white/40 bg-white">
        <canvas
          ref={paintInitial}
          width={400}
          height={140}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="touch-none rounded-md"
          style={{ width: 400, height: 140, maxWidth: "100%" }}
        />
      </div>
      <div className="mt-1">
        <button
          type="button"
          onClick={clear}
          className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
        >
          Clear signature
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

const EMAIL_PROVIDERS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "live.com",
  "live.co.uk",
  "btinternet.com",
  "sky.com",
  "aol.com",
];

function FieldLabel({ label, required, help }: { label: string; required: boolean; help: string | null }) {
  return (
    <>
      <span className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {help && <span className="mt-0.5 block text-xs text-gray-500">{help}</span>}
    </>
  );
}

/** Star rating (1–5). Submits the chosen number as the field value. */
function RatingField({
  name,
  label,
  required,
  help,
  initial,
}: {
  name: string;
  label: string;
  required: boolean;
  help: string | null;
  initial: string;
}) {
  const [value, setValue] = useState(initial ? Number(initial) || 0 : 0);
  return (
    <fieldset>
      <span className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {help && <span className="mt-0.5 block text-xs text-gray-500">{help}</span>}
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue((v) => (v === n ? 0 : n))}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="text-2xl leading-none"
          >
            <span className={n <= value ? "text-amber-400" : "text-gray-300"}>★</span>
          </button>
        ))}
      </div>
      <input type="hidden" name={name} value={value || ""} />
    </fieldset>
  );
}

/** Email entry: local part + a provider picker (or a custom domain). Validates
 *  a real domain and submits the full address as one value. */
function EmailField({
  name,
  label,
  required,
  help,
  initial = "",
}: {
  name: string;
  label: string;
  required: boolean;
  help: string | null;
  initial?: string;
}) {
  const at = initial.lastIndexOf("@");
  const initLocal = at > 0 ? initial.slice(0, at) : "";
  const initDomain = at > 0 ? initial.slice(at + 1) : "";
  const known = EMAIL_PROVIDERS.includes(initDomain);

  const [local, setLocal] = useState(initLocal);
  const [choice, setChoice] = useState(initDomain ? (known ? initDomain : "other") : "gmail.com");
  const [custom, setCustom] = useState(known ? "" : initDomain);

  const domain = choice === "other" ? custom.trim().toLowerCase() : choice;
  const value = local.trim() && domain ? `${local.trim()}@${domain}` : "";

  return (
    <div>
      <FieldLabel label={label} required={required} help={help} />
      <div className="mt-1 flex items-stretch gap-2">
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          required={required}
          placeholder="yourname"
          aria-label="Email username"
          className={`${inputClass} flex-1`}
        />
        <span className="flex items-center text-sm text-gray-500">@</span>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          aria-label="Email provider"
          className={`${inputClass} w-auto flex-1`}
        >
          {EMAIL_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value="other">Other (type domain)…</option>
        </select>
      </div>
      {choice === "other" && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          required={required}
          placeholder="company.com"
          aria-label="Email domain"
          pattern="[^@\s]+\.[^@\s]+"
          title="Enter a valid domain, e.g. company.com"
          className={`${inputClass} mt-2`}
        />
      )}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

/** Phone entry: country dial-code picker + national number, submitted as E.164
 *  (+<code><number>) so it's Twilio-ready. */
function PhoneField({
  name,
  label,
  required,
  help,
  initial = "",
}: {
  name: string;
  label: string;
  required: boolean;
  help: string | null;
  initial?: string;
}) {
  // Parse an existing E.164 value back into country + national number.
  function parse(): { iso: string; national: string } {
    const digits = initial.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) {
      const rest = digits.slice(1);
      const match = [...COUNTRIES]
        .sort((a, b) => b.dial.length - a.dial.length)
        .find((c) => rest.startsWith(c.dial));
      if (match) return { iso: match.iso, national: rest.slice(match.dial.length) };
    }
    return { iso: "GB", national: "" };
  }
  const parsed = parse();
  const [iso, setIso] = useState(parsed.iso);
  const [national, setNational] = useState(parsed.national);

  const dial = COUNTRIES.find((c) => c.iso === iso)?.dial ?? "44";
  const value = toE164(dial, national);

  return (
    <div>
      <FieldLabel label={label} required={required} help={help} />
      <div className="mt-1 flex items-stretch gap-2">
        <select
          value={iso}
          onChange={(e) => setIso(e.target.value)}
          aria-label="Country dialling code"
          className={`${inputClass} w-auto max-w-[55%]`}
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        <input
          value={national}
          onChange={(e) => setNational(e.target.value)}
          required={required}
          type="tel"
          inputMode="tel"
          placeholder="7700 900000"
          aria-label="Phone number"
          className={`${inputClass} flex-1`}
        />
      </div>
      {value && <p className="mt-1 text-xs text-gray-400">Will be saved as {value}</p>}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

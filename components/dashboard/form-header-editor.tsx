"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { AlignLeft, AlignCenter, AlignRight, ImagePlus, X } from "lucide-react";
import { updateFormHeader, uploadFormLogo } from "@/modules/forms/actions";

const SIZE_CLASS: Record<string, string> = {
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
  "3xl": "text-3xl",
};
const TITLE_SIZES = ["lg", "xl", "2xl", "3xl"];
const DESC_SIZES = ["sm", "base", "lg", "xl"];

function alignClass(a: string) {
  return a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
}

type Style = {
  title?: { color?: string; size?: string; align?: string };
  description?: { color?: string; size?: string; align?: string };
  logo_url?: string;
};

export function FormHeaderEditor({
  formId,
  name,
  description,
  style,
}: {
  formId: string;
  name: string;
  description: string;
  style: Style;
}) {
  const router = useRouter();
  const [formName, setFormName] = useState(name === "Untitled form" ? "" : name);
  const [desc, setDesc] = useState(description);

  const [tColor, setTColor] = useState(style.title?.color ?? "#111827");
  const [tSize, setTSize] = useState(style.title?.size ?? "2xl");
  const [tAlign, setTAlign] = useState(style.title?.align ?? "left");

  const [dColor, setDColor] = useState(style.description?.color ?? "#374151");
  const [dSize, setDSize] = useState(style.description?.size ?? "sm");
  const [dAlign, setDAlign] = useState(style.description?.align ?? "left");

  const [logoUrl, setLogoUrl] = useState(style.logo_url ?? "");
  const [logoErr, setLogoErr] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | "saving" | "saved">("");

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setStatus("saving");
    const t = setTimeout(async () => {
      await updateFormHeader({
        id: formId,
        name: formName,
        description: desc,
        style: {
          title: { color: tColor, size: tSize, align: tAlign },
          description: { color: dColor, size: dSize, align: dAlign },
          logo_url: logoUrl,
        },
      });
      setStatus("saved");
      router.refresh();
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formName, desc, tColor, tSize, tAlign, dColor, dSize, dAlign, logoUrl]);

  async function onLogo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoErr(null);
    const fd = new FormData();
    fd.append("id", formId);
    fd.append("logo", f);
    const res = await uploadFormLogo(fd);
    if (res.url) setLogoUrl(res.url);
    else setLogoErr(res.error ?? "Could not upload logo");
  }

  const Toolbar = ({
    sizes,
    size,
    setSize,
    color,
    setColor,
    align,
    setAlign,
  }: {
    sizes: string[];
    size: string;
    setSize: (s: string) => void;
    color: string;
    setColor: (c: string) => void;
    align: string;
    setAlign: (a: string) => void;
  }) => (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <select
        value={size}
        onChange={(e) => setSize(e.target.value)}
        className="rounded-md border border-gray-300 px-1.5 py-1 text-xs"
        aria-label="Font size"
      >
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s.toUpperCase()}
          </option>
        ))}
      </select>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-7 w-8 rounded border border-gray-300"
        aria-label="Text colour"
      />
      <div className="flex rounded-md border border-gray-300">
        {([
          ["left", AlignLeft],
          ["center", AlignCenter],
          ["right", AlignRight],
        ] as const).map(([a, Icon]) => (
          <button
            key={a}
            type="button"
            onClick={() => setAlign(a)}
            className={`p-1.5 ${align === a ? "bg-brand-100 text-brand-700" : "text-gray-500 hover:bg-gray-100"}`}
            aria-label={`Align ${a}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
      {/* Logo */}
      <div className="mb-4">
        {logoUrl ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="Logo" className="h-12 w-auto rounded" />
            <button
              type="button"
              onClick={() => setLogoUrl("")}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600"
            >
              <X className="h-3.5 w-3.5" /> Remove logo
            </button>
          </div>
        ) : (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-gray-600 hover:text-brand-700">
            <ImagePlus className="h-4 w-4" /> Add logo
            <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
          </label>
        )}
        {logoErr && <p className="mt-1 text-xs text-red-600">{logoErr}</p>}
      </div>

      {/* Title */}
      <Toolbar
        sizes={TITLE_SIZES}
        size={tSize}
        setSize={setTSize}
        color={tColor}
        setColor={setTColor}
        align={tAlign}
        setAlign={setTAlign}
      />
      <input
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        placeholder="Form title"
        style={{ color: tColor }}
        className={`block w-full border-0 px-0 font-bold placeholder-gray-300 focus:outline-none focus:ring-0 ${SIZE_CLASS[tSize]} ${alignClass(tAlign)}`}
      />

      {/* Description */}
      <div className="mt-4">
        <Toolbar
          sizes={DESC_SIZES}
          size={dSize}
          setSize={setDSize}
          color={dColor}
          setColor={setDColor}
          align={dAlign}
          setAlign={setDAlign}
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
          placeholder="Add a description — e.g. how to complete this form, what's needed…"
          style={{ color: dColor }}
          className={`block w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${SIZE_CLASS[dSize]} ${alignClass(dAlign)}`}
        />
      </div>

      <p className="mt-2 h-4 text-xs text-gray-400">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}
      </p>
    </div>
  );
}

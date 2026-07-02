"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, GripVertical } from "lucide-react";
import { savePoppyAttributes } from "@/modules/poppy/actions";
import {
  POPPY_PROFESSIONAL_ATTRIBUTES,
  POPPY_PERSONAL_ATTRIBUTES,
  type PoppyAttrGroup,
  type PoppyConfig,
} from "@/lib/poppy/config";

const uniq = (xs: string[]) => [...new Set(xs)];

type GroupState = { required: string[]; desired: string[]; custom: string[] };

/** Seed a group's editable state, making sure any custom names already sitting in
 *  a bucket are tracked in `custom` so they survive being unassigned. */
function seedGroup(g: PoppyAttrGroup, standard: string[]): GroupState {
  const notStandard = (a: string) => !standard.includes(a);
  const custom = uniq([...(g.custom ?? []), ...g.required.filter(notStandard), ...g.desired.filter(notStandard)]);
  return { required: [...g.required], desired: [...g.desired], custom };
}

/** Poppy Attributes screen — the master on/off switch plus Professional and
 *  Personal attributes, each split into Required and Desired via drag/drop
 *  (tap-to-assign also works). Admin-only. */
export function PoppyAttributesForm({ config }: { config: PoppyConfig }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(config.attributesEnabled !== false);
  const [pro, setPro] = useState<GroupState>(seedGroup(config.professional, POPPY_PROFESSIONAL_ATTRIBUTES));
  const [per, setPer] = useState<GroupState>(seedGroup(config.personal, POPPY_PERSONAL_ATTRIBUTES));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setSaved(false);
    setError(null);
    start(async () => {
      const res = await savePoppyAttributes({
        enabled,
        professional: pro,
        personal: per,
      });
      if (res.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
        window.dispatchEvent(new Event("jcn-section-saved"));
      }
    });
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Master on/off */}
      <div className="flex items-start justify-between gap-3 rounded-xl border border-white/50 bg-white/60 px-4 py-3 backdrop-blur-sm">
        <div>
          <p className="text-sm font-medium text-gray-800">Use attributes when screening</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {enabled
              ? "On — Poppy assesses every candidate against the attributes below."
              : "Off — Poppy ignores these attributes and screens on the role and your instructions only."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled((v) => !v)}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${enabled ? "bg-brand-600" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      <div className={enabled ? "space-y-6" : "space-y-6 opacity-60"}>
        <AttrGroupEditor
          groupId="pro"
          title="Professional attributes"
          hint="Compliance and job-readiness — DBS, references, qualifications, experience."
          standard={POPPY_PROFESSIONAL_ATTRIBUTES}
          state={pro}
          onChange={setPro}
        />
        <AttrGroupEditor
          groupId="per"
          title="Personal attributes"
          hint="Values and soft skills — compassion, communication, reliability."
          standard={POPPY_PERSONAL_ATTRIBUTES}
          state={per}
          onChange={setPer}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save attributes"}
        </button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}

function AttrGroupEditor({
  groupId,
  title,
  hint,
  standard,
  state,
  onChange,
}: {
  groupId: string;
  title: string;
  hint: string;
  standard: string[];
  state: GroupState;
  onChange: (next: GroupState) => void;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [dropOn, setDropOn] = useState<"required" | "desired" | null>(null);

  const master = uniq([...standard, ...state.custom]);
  const palette = master.filter((a) => !state.required.includes(a) && !state.desired.includes(a));

  function assign(bucket: "required" | "desired", name: string) {
    onChange({
      required: bucket === "required" ? uniq([...state.required.filter((x) => x !== name), name]) : state.required.filter((x) => x !== name),
      desired: bucket === "desired" ? uniq([...state.desired.filter((x) => x !== name), name]) : state.desired.filter((x) => x !== name),
      custom: state.custom,
    });
    setArmed(null);
  }
  function unassign(name: string) {
    onChange({ required: state.required.filter((x) => x !== name), desired: state.desired.filter((x) => x !== name), custom: state.custom });
  }
  function addCustom() {
    const a = custom.trim();
    if (!a) return;
    if (!master.some((x) => x.toLowerCase() === a.toLowerCase())) {
      onChange({ ...state, custom: [...state.custom, a] });
    }
    setCustom("");
  }
  function onDrop(bucket: "required" | "desired", e: React.DragEvent) {
    e.preventDefault();
    setDropOn(null);
    try {
      const p = JSON.parse(e.dataTransfer.getData("text/plain")) as { g: string; name: string };
      if (p.g === groupId && p.name) assign(bucket, p.name);
    } catch {
      /* ignore */
    }
  }

  const Pill = ({ name, draggable = true }: { name: string; draggable?: boolean }) => (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ g: groupId, name }))}
      onClick={() => setArmed(armed === name ? null : name)}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
        armed === name ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-400" : "border-white/70 bg-white/80 text-gray-700 hover:border-brand-300"
      }`}
    >
      <GripVertical className="h-3 w-3 text-gray-400" />
      {name}
    </button>
  );

  const Box = ({ bucket, label }: { bucket: "required" | "desired"; label: string }) => (
    <div
      onClick={() => armed && assign(bucket, armed)}
      onDragOver={(e) => {
        e.preventDefault();
        setDropOn(bucket);
      }}
      onDragLeave={() => setDropOn((d) => (d === bucket ? null : d))}
      onDrop={(e) => onDrop(bucket, e)}
      className={`min-h-[6rem] rounded-xl border p-2.5 transition ${
        dropOn === bucket ? "border-brand-400 bg-brand-50/70 ring-1 ring-brand-300" : armed ? "border-brand-200 bg-white/70 cursor-copy" : "border-white/60 bg-white/50"
      } backdrop-blur-sm`}
    >
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {state[bucket].length === 0 ? (
          <p className="text-[11px] text-gray-400">{armed ? "Tap to place here" : "Drop attributes here"}</p>
        ) : (
          state[bucket].map((name) => (
            <span
              key={name}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", JSON.stringify({ g: groupId, name }))}
              className="inline-flex cursor-grab items-center gap-1 rounded-md border border-brand-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-800 shadow-sm"
            >
              {name}
              <button type="button" onClick={() => unassign(name)} aria-label={`Remove ${name}`} className="rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-white/50 bg-white/40 p-4 backdrop-blur-sm">
      <p className="text-sm font-semibold text-gray-800">{title}</p>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>

      {/* Palette of unassigned attributes */}
      <div className="mt-3 rounded-lg border border-white/60 bg-white/40 p-2.5">
        <p className="mb-1.5 text-[11px] font-medium text-gray-500">
          {armed ? "Tap Required or Desired to place it — or drag any pill into a box." : "Drag a pill into a box below (or tap it, then tap a box)."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {palette.length === 0 ? (
            <p className="text-[11px] text-gray-400">All assigned.</p>
          ) : (
            palette.map((a) => <Pill key={a} name={a} />)
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add a custom attribute…"
            className="w-full max-w-xs rounded-lg border border-white/50 bg-white px-2.5 py-1.5 text-xs shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!custom.trim()}
            className="inline-flex items-center gap-1 rounded-lg border border-white/50 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-white/90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Required / Desired boxes */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Box bucket="required" label="Required" />
        <Box bucket="desired" label="Desired / not essential" />
      </div>
    </div>
  );
}

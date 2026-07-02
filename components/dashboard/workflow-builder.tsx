"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, GripVertical, FileText, ScrollText, Sparkles, CheckCircle2 } from "lucide-react";
import { addTemplateTasks, type TaskDraft } from "@/modules/onboarding/actions";
import { MultiSelect } from "@/components/dashboard/multi-select";

const cls =
  "mt-1 block w-full rounded-md border border-white/60 bg-white/70 backdrop-blur-sm shadow-sm px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-500 focus:bg-white/90 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** The pipeline stages a task can be attached to. "Application" replaces
 *  "Applied" and there's no "Not progressing" stage — a task can't trigger on
 *  rejection. Right to work is a real stage the applicant reaches. */
const STAGES: { key: string; label: string }[] = [
  { key: "on_application", label: "Application" },
  { key: "reviewing", label: "Reviewing" },
  { key: "interview", label: "Interview" },
  { key: "right_to_work", label: "Right to work" },
  { key: "offer", label: "Offer" },
  { key: "hired", label: "Hired" },
];

type Lib = { source: "form" | "doc"; refId: string; name: string };
type Placed = Lib & { key: string };

/**
 * The drag-and-drop workflow builder. Collapsed to an "Add workflow" button;
 * expands into a pipeline-style board. Two library boxes at the top (Forms,
 * Documents) hold draggable chips; drag (or tap-to-arm then tap a stage) drops
 * them into a stage column. A Poppy placeholder sits below (built next).
 * On create, each placed chip becomes a task at its stage.
 */
export function WorkflowBuilder({
  forms,
  docs = [],
  roleOptions = [],
  showRole = true,
  roleLabel = "Applies to roles",
  saveAction = addTemplateTasks,
}: {
  forms: { id: string; name: string }[];
  /** Contracts + policies. Dropped in as a read-&-confirm task. */
  docs?: { id: string; name: string }[];
  /** Company: value = role UUID. Founder store: value = standard role name. */
  roleOptions?: { value: string; label: string }[];
  showRole?: boolean;
  roleLabel?: string;
  saveAction?: (drafts: TaskDraft[]) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [roleValues, setRoleValues] = useState<string[]>([]);
  const [placed, setPlaced] = useState<Record<string, Placed[]>>({});
  const [armed, setArmed] = useState<Lib | null>(null); // tap-to-place fallback
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  function reset() {
    setTitle("");
    setRoleValues([]);
    setPlaced({});
    setArmed(null);
    setError(null);
    setCreated(false);
  }

  function place(stageKey: string, item: Lib) {
    setPlaced((p) => ({
      ...p,
      [stageKey]: [...(p[stageKey] ?? []), { ...item, key: crypto.randomUUID() }],
    }));
    setArmed(null);
  }
  function removePlaced(stageKey: string, key: string) {
    setPlaced((p) => ({ ...p, [stageKey]: (p[stageKey] ?? []).filter((x) => x.key !== key) }));
  }
  function onStageClick(stageKey: string) {
    if (armed) place(stageKey, armed);
  }
  function onStageDrop(stageKey: string, e: React.DragEvent) {
    e.preventDefault();
    setDropTarget(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      place(stageKey, JSON.parse(raw) as Lib);
    } catch {
      /* ignore malformed drag payload */
    }
  }

  async function create() {
    setError(null);
    if (title.trim().length < 2) {
      setError("Give the workflow a title.");
      return;
    }
    const drafts: TaskDraft[] = [];
    for (const stage of STAGES) {
      for (const item of placed[stage.key] ?? []) {
        if (item.source === "form") {
          drafts.push({
            title: title.trim(),
            workflowTitle: title.trim(),
            taskType: "form",
            formIds: [item.refId],
            dueDays: "",
            required: true,
            body: "",
            triggerStage: stage.key,
            roleValues,
          });
        } else {
          drafts.push({
            title: item.name,
            workflowTitle: title.trim(),
            taskType: "acknowledge",
            formIds: [],
            dueDays: "",
            required: true,
            body: `Please read and confirm you have read "${item.name}".`,
            triggerStage: stage.key,
            roleValues,
          });
        }
      }
    }
    if (drafts.length === 0) {
      setError("Drag at least one form or document onto a stage.");
      return;
    }
    setSaving(true);
    const res = await saveAction(drafts);
    setSaving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setCreated(true);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> Add workflow
      </button>
    );
  }

  if (created) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-green-300 bg-green-50 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-green-800">
          <CheckCircle2 className="h-5 w-5" /> Workflow created
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white/80 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            <Plus className="h-4 w-4" /> Create another
          </button>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  const armEq = (l: Lib) => armed && armed.source === l.source && armed.refId === l.refId;

  const LibChip = ({ item, icon }: { item: Lib; icon: React.ReactNode }) => (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify(item));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => setArmed(armEq(item) ? null : item)}
      title="Drag onto a stage, or tap then tap a stage"
      className={`flex w-full cursor-grab items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs font-medium text-gray-800 shadow-sm transition active:cursor-grabbing ${
        armEq(item)
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-400"
          : "border-white/70 bg-white/80 hover:border-brand-300"
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      {icon}
      <span className="truncate">{item.name}</span>
    </button>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">New workflow</p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          aria-label="Close"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>}

      {/* Title + roles */}
      <div className={`grid grid-cols-1 gap-3 ${showRole ? "sm:grid-cols-2" : ""}`}>
        <label className="text-xs font-medium text-gray-600">
          Workflow title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New starter onboarding"
            className={cls}
          />
        </label>
        {showRole && (
          <div className="text-xs font-medium text-gray-600">
            {roleLabel}
            <MultiSelect options={roleOptions} selected={roleValues} onChange={setRoleValues} allLabel="All roles" className="mt-1" />
            <span className="mt-1 block text-[11px] font-normal text-gray-400">None selected = all roles.</span>
          </div>
        )}
      </div>

      {/* Library: forms + documents */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/60 bg-white/50 p-3 backdrop-blur-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <FileText className="h-4 w-4 text-brand-600" /> Forms
          </p>
          <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {forms.length === 0 ? (
              <p className="text-xs text-gray-400">No forms yet — create one in Forms first.</p>
            ) : (
              forms.map((f) => <LibChip key={f.id} item={{ source: "form", refId: f.id, name: f.name }} icon={<FileText className="h-3.5 w-3.5 shrink-0 text-brand-500" />} />)
            )}
          </div>
        </div>
        <div className="rounded-xl border border-white/60 bg-white/50 p-3 backdrop-blur-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <ScrollText className="h-4 w-4 text-brand-600" /> Contracts &amp; policies
          </p>
          <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
            {docs.length === 0 ? (
              <p className="text-xs text-gray-400">No contracts or policies yet.</p>
            ) : (
              docs.map((d) => <LibChip key={d.id} item={{ source: "doc", refId: d.id, name: d.name }} icon={<ScrollText className="h-3.5 w-3.5 shrink-0 text-brand-500" />} />)
            )}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-500">
        {armed ? (
          <span className="font-medium text-brand-600">Tap a stage to drop “{armed.name}”.</span>
        ) : (
          <>Drag a form or document onto a stage below — or tap it, then tap a stage.</>
        )}
      </p>

      {/* Pipeline stage columns */}
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {STAGES.map((stage) => {
          const items = placed[stage.key] ?? [];
          const active = dropTarget === stage.key || (!!armed);
          return (
            <div
              key={stage.key}
              onClick={() => onStageClick(stage.key)}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(stage.key);
              }}
              onDragLeave={() => setDropTarget((t) => (t === stage.key ? null : t))}
              onDrop={(e) => onStageDrop(stage.key, e)}
              className={`flex min-h-[7rem] w-36 shrink-0 flex-col rounded-xl border p-2 transition ${
                dropTarget === stage.key
                  ? "border-brand-400 bg-brand-50/70 ring-1 ring-brand-300"
                  : active
                    ? "border-brand-200 bg-white/70"
                    : "border-white/60 bg-white/50"
              } backdrop-blur-sm ${armed ? "cursor-copy" : ""}`}
            >
              <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">{stage.label}</p>
              <div className="flex-1 space-y-1.5">
                {items.length === 0 ? (
                  <p className="mt-1 px-0.5 text-[10px] text-gray-400">Drop here</p>
                ) : (
                  items.map((it) => (
                    <div
                      key={it.key}
                      className="group flex items-center gap-1 rounded-md border border-white/70 bg-white/90 px-1.5 py-1 text-[11px] font-medium text-gray-800 shadow-sm"
                    >
                      {it.source === "form" ? (
                        <FileText className="h-3 w-3 shrink-0 text-brand-500" />
                      ) : (
                        <ScrollText className="h-3 w-3 shrink-0 text-brand-500" />
                      )}
                      <span className="truncate">{it.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePlaced(stage.key, it.key);
                        }}
                        aria-label="Remove"
                        className="ml-auto rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Poppy placeholder — built next */}
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-brand-300/70 bg-brand-50/40 px-3 py-2.5 text-xs text-brand-700/80 backdrop-blur-sm">
        <Sparkles className="h-4 w-4 text-brand-500" />
        <span className="font-medium">Poppy AI screening</span>
        <span className="text-brand-600/60">— coming next</span>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={create}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Creating…" : "Create workflow"}
        </button>
      </div>
    </div>
  );
}

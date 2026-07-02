"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, GripVertical, FileText, ScrollText, Sparkles, CheckCircle2, Settings2 } from "lucide-react";
import { addTemplateTasks, type TaskDraft } from "@/modules/onboarding/actions";
import { MultiSelect } from "@/components/dashboard/multi-select";
import { POPPY_FOCUS_OPTIONS } from "@/lib/poppy/config";

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

type Lib = { source: "form" | "doc" | "poppy"; refId: string; name: string; kind?: "contract" | "policy" };
type PoppyCfg = {
  engage: "stage" | "all_forms" | "as_forms";
  formIds: string[];
  includeCv: boolean;
  focus: string[];
  instructions: string;
  questionCount: string;
  documentIds: string[];
};
const blankPoppy = (): PoppyCfg => ({
  engage: "stage",
  formIds: [],
  includeCv: true,
  focus: [],
  instructions: "",
  questionCount: "",
  documentIds: [],
});
type Placed = Lib & { key: string; poppy?: PoppyCfg };

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
  poppyDocs = [],
  roleOptions = [],
  showRole = true,
  roleLabel = "Applies to roles",
  poppyEnabled = false,
  saveAction = addTemplateTasks,
}: {
  forms: { id: string; name: string }[];
  /** Contracts + policies. Dropped in as a read-&-sign task. */
  docs?: { id: string; name: string; kind: "contract" | "policy" }[];
  /** Company documents (type-suffixed) Poppy can compare a candidate against. */
  poppyDocs?: { id: string; name: string }[];
  /** Company: value = role UUID. Founder store: value = standard role name. */
  roleOptions?: { value: string; label: string }[];
  showRole?: boolean;
  roleLabel?: string;
  /** Show the draggable Poppy AI screening step (company has Poppy). */
  poppyEnabled?: boolean;
  saveAction?: (drafts: TaskDraft[]) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [roleValues, setRoleValues] = useState<string[]>([]);
  const [placed, setPlaced] = useState<Record<string, Placed[]>>({});
  const [armed, setArmed] = useState<Lib | null>(null); // tap-to-place fallback
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // poppy item key being configured
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  function reset() {
    setTitle("");
    setRoleValues([]);
    setPlaced({});
    setArmed(null);
    setEditing(null);
    setError(null);
    setCreated(false);
  }

  function place(stageKey: string, item: Lib) {
    const key = crypto.randomUUID();
    const withCfg: Placed =
      item.source === "poppy" ? { ...item, key, poppy: blankPoppy() } : { ...item, key };
    setPlaced((p) => ({ ...p, [stageKey]: [...(p[stageKey] ?? []), withCfg] }));
    setArmed(null);
    if (item.source === "poppy") setEditing(key); // open config on drop
  }
  function removePlaced(stageKey: string, key: string) {
    setPlaced((p) => ({ ...p, [stageKey]: (p[stageKey] ?? []).filter((x) => x.key !== key) }));
    setEditing((e) => (e === key ? null : e));
  }

  /** Find a placed poppy item + its stage by key. */
  function findPoppy(key: string): { stageKey: string; item: Placed } | null {
    for (const [stageKey, list] of Object.entries(placed)) {
      const item = list.find((x) => x.key === key);
      if (item) return { stageKey, item };
    }
    return null;
  }
  function updatePoppy(key: string, patch: Partial<PoppyCfg>) {
    setPlaced((p) => {
      const next: Record<string, Placed[]> = {};
      for (const [sk, list] of Object.entries(p)) {
        next[sk] = list.map((x) => (x.key === key && x.poppy ? { ...x, poppy: { ...x.poppy, ...patch } } : x));
      }
      return next;
    });
  }
  function togglePoppyId(key: string, field: "formIds" | "documentIds", id: string) {
    const found = findPoppy(key);
    if (!found?.item.poppy) return;
    const cur = found.item.poppy[field];
    updatePoppy(key, { [field]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } as Partial<PoppyCfg>);
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
        } else if (item.source === "poppy") {
          const cfg = item.poppy ?? blankPoppy();
          if (cfg.formIds.length === 0 && !cfg.includeCv) {
            setError("Poppy needs at least one form (or the CV) to review — open its settings.");
            return;
          }
          drafts.push({
            title: "Poppy screening",
            workflowTitle: title.trim(),
            taskType: "poppy",
            formIds: [],
            dueDays: "",
            required: true,
            body: "",
            triggerStage: stage.key,
            roleValues,
            poppyEngage: cfg.engage,
            poppyFormIds: cfg.formIds,
            poppyIncludeCv: cfg.includeCv,
            poppyFocus: cfg.focus,
            poppyInstructions: cfg.instructions,
            poppyQuestionCount: cfg.questionCount,
            poppyDocumentIds: cfg.documentIds,
          });
        } else {
          drafts.push({
            title: item.name,
            workflowTitle: title.trim(),
            taskType: "acknowledge",
            formIds: [],
            dueDays: "",
            required: true,
            body: `Please read and sign "${item.name}".`,
            triggerStage: stage.key,
            roleValues,
            documentId: item.refId,
            documentKind: item.kind,
          });
        }
      }
    }
    if (drafts.length === 0) {
      setError("Drag at least one form, document or Poppy step onto a stage.");
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
                      className={`group flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-medium shadow-sm ${
                        it.source === "poppy"
                          ? "border-brand-300 bg-brand-50 text-brand-800"
                          : "border-white/70 bg-white/90 text-gray-800"
                      }`}
                    >
                      {it.source === "form" ? (
                        <FileText className="h-3 w-3 shrink-0 text-brand-500" />
                      ) : it.source === "poppy" ? (
                        <Sparkles className="h-3 w-3 shrink-0 text-brand-500" />
                      ) : (
                        <ScrollText className="h-3 w-3 shrink-0 text-brand-500" />
                      )}
                      <span className="truncate">{it.source === "poppy" ? "Poppy" : it.name}</span>
                      {it.source === "poppy" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(it.key);
                          }}
                          aria-label="Configure Poppy"
                          className="rounded p-0.5 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
                        >
                          <Settings2 className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePlaced(stage.key, it.key);
                        }}
                        aria-label="Remove"
                        className={`rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-600 ${it.source === "poppy" ? "" : "ml-auto"}`}
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

      {/* Poppy — draggable AI screening step (drop onto the stage it runs at). */}
      {poppyEnabled && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3 backdrop-blur-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-800">
            <Sparkles className="h-4 w-4 text-brand-500" /> Poppy AI screening
          </p>
          <LibChip
            item={{ source: "poppy", refId: "poppy", name: "Poppy screening" }}
            icon={<Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
          />
          <p className="mt-2 text-[11px] text-brand-700/70">
            Drop onto the stage Poppy should run at, then set which forms it reviews.
          </p>
        </div>
      )}

      {/* Poppy config panel — appears when a placed Poppy step is being edited. */}
      {editing &&
        (() => {
          const found = findPoppy(editing);
          const cfg = found?.item.poppy;
          if (!found || !cfg) return null;
          const stageLabel = STAGES.find((s) => s.key === found.stageKey)?.label ?? found.stageKey;
          return (
            <div className="space-y-3 rounded-xl border border-brand-300 bg-white/80 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
                  <Sparkles className="h-4 w-4 text-brand-500" /> Poppy settings · {stageLabel}
                </p>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                >
                  Done
                </button>
              </div>

              <label className="block text-xs font-medium text-gray-600">
                When should Poppy engage?
                <select
                  value={cfg.engage}
                  onChange={(e) => updatePoppy(editing, { engage: e.target.value as PoppyCfg["engage"] })}
                  className={cls}
                >
                  <option value="stage">When they reach {stageLabel}</option>
                  <option value="all_forms">When the selected forms are complete</option>
                  <option value="as_forms">As the selected forms come in</option>
                </select>
              </label>

              <div className="text-xs font-medium text-gray-600">
                Forms Poppy reviews
                <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-md border border-white/60 bg-white/70 p-2">
                  <label className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                    <input
                      type="checkbox"
                      checked={cfg.includeCv}
                      onChange={() => updatePoppy(editing, { includeCv: !cfg.includeCv })}
                      className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                    />
                    CV (uploaded)
                  </label>
                  {forms.length === 0 ? (
                    <p className="px-1 font-normal text-gray-400">No forms yet.</p>
                  ) : (
                    forms.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                        <input
                          type="checkbox"
                          checked={cfg.formIds.includes(f.id)}
                          onChange={() => togglePoppyId(editing, "formIds", f.id)}
                          className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                        />
                        {f.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="text-xs font-medium text-gray-600">
                Focus on (optional)
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {POPPY_FOCUS_OPTIONS.map((f) => {
                    const on = cfg.focus.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() =>
                          updatePoppy(editing!, {
                            focus: on ? cfg.focus.filter((x) => x !== f) : [...cfg.focus, f],
                          })
                        }
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                          on ? "border-brand-500 bg-brand-100 text-brand-800" : "border-white/60 bg-white/70 text-gray-600 hover:border-brand-300"
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-gray-600">
                  Number of questions (optional)
                  <input
                    value={cfg.questionCount}
                    onChange={(e) => updatePoppy(editing!, { questionCount: e.target.value })}
                    type="number"
                    min="1"
                    max="20"
                    placeholder="Default"
                    className={cls}
                  />
                </label>
              </div>

              <label className="block text-xs font-medium text-gray-600">
                Instructions for Poppy (optional)
                <textarea
                  value={cfg.instructions}
                  onChange={(e) => updatePoppy(editing!, { instructions: e.target.value })}
                  rows={2}
                  placeholder="e.g. Probe any gaps in employment history."
                  className={cls}
                />
              </label>

              <div className="text-xs font-medium text-gray-600">
                What to compare to (optional)
                {poppyDocs.length === 0 ? (
                  <p className="mt-1 font-normal text-gray-400">No policies or contracts to compare against yet.</p>
                ) : (
                  <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-md border border-white/60 bg-white/70 p-2">
                    {poppyDocs.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                        <input
                          type="checkbox"
                          checked={cfg.documentIds.includes(d.id)}
                          onChange={() => togglePoppyId(editing!, "documentIds", d.id)}
                          className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                )}
                <span className="mt-1 block text-[11px] font-normal text-gray-400">
                  The role&apos;s job description is always compared. Leave blank to use your Settings default.
                </span>
              </div>
            </div>
          );
        })()}

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

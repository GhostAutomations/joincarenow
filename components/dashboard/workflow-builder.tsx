"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, GripVertical, FileText, ScrollText, Sparkles, CheckCircle2, GitBranch } from "lucide-react";
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

type Engage = "all_forms" | "as_forms" | "stage";
const ENGAGE: { key: Engage; label: string }[] = [
  { key: "all_forms", label: "When the selected forms are complete" },
  { key: "as_forms", label: "As the selected forms come in" },
  { key: "stage", label: "When they reach a stage in the pipeline" },
];

// Temporarily hidden (kept in code): the Pipeline library box and the
// "when they reach a stage" Poppy engage option. Flip to true to bring back.
const SHOW_PIPELINE = false;
const ENGAGE_VISIBLE = SHOW_PIPELINE ? ENGAGE : ENGAGE.filter((m) => m.key !== "stage");

type Lib = {
  source: "form" | "doc" | "stage";
  refId: string;
  name: string;
  kind?: "contract" | "policy";
  /** The job application form — Poppy may review it, but it can't be reissued as
   *  a pipeline task (it's tied to the advert). */
  poppyOnly?: boolean;
};
type Placed = Lib & { key: string };
const sameItem = (a: Lib, b: Lib) => a.source === b.source && a.refId === b.refId;

/**
 * The drag-and-drop workflow builder. Collapsed to an "Add workflow" button;
 * expands into a pipeline-style board. Library boxes (Forms, Contracts &
 * policies, Pipeline) hold draggable chips. Forms/documents drop onto a pipeline
 * stage column to become tasks. Poppy has its own area with three "engage"
 * boxes — drop the forms/policies/contracts it should use into the box for the
 * moment it should run (box 3 also takes a pipeline stage).
 */
export function WorkflowBuilder({
  forms,
  docs = [],
  roleOptions = [],
  showRole = true,
  roleLabel = "Applies to roles",
  poppyEnabled = false,
  saveAction = addTemplateTasks,
}: {
  forms: { id: string; name: string; poppyOnly?: boolean }[];
  /** Contracts + policies. Dropped on a stage = read-&-sign task; dropped in a
   *  Poppy box = something Poppy compares the candidate against. */
  docs?: { id: string; name: string; kind: "contract" | "policy" }[];
  /** Company: value = role UUID. Founder store: value = standard role name. */
  roleOptions?: { value: string; label: string }[];
  showRole?: boolean;
  roleLabel?: string;
  /** Show the Poppy AI screening area (company has Poppy). */
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
  // Poppy config (one Poppy step per workflow).
  const [poppyEngage, setPoppyEngage] = useState<Engage | "">("");
  const [poppyItems, setPoppyItems] = useState<Lib[]>([]); // forms reviewed + docs compared
  const [poppyStage, setPoppyStage] = useState<string>("");
  const [poppyIncludeCv, setPoppyIncludeCv] = useState(true);
  const [poppyFocus, setPoppyFocus] = useState<string[]>([]);
  const [poppyInstructions, setPoppyInstructions] = useState("");
  const [poppyQuestionCount, setPoppyQuestionCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  function reset() {
    setTitle("");
    setRoleValues([]);
    setPlaced({});
    setArmed(null);
    setPoppyEngage("");
    setPoppyItems([]);
    setPoppyStage("");
    setPoppyIncludeCv(true);
    setPoppyFocus([]);
    setPoppyInstructions("");
    setPoppyQuestionCount("");
    setError(null);
    setCreated(false);
  }

  // --- Pipeline columns (form/document tasks) ---
  function place(stageKey: string, item: Lib) {
    if (item.source === "stage") return; // stages aren't tasks
    if (item.poppyOnly) {
      // The application form is tied to the advert — Poppy can review it, but it
      // can't be reissued to the applicant as a pipeline task.
      setError(`"${item.name}" is the job application form — it can only be given to Poppy, not sent as a task.`);
      setArmed(null);
      return;
    }
    setError(null);
    setPlaced((p) => ({ ...p, [stageKey]: [...(p[stageKey] ?? []), { ...item, key: crypto.randomUUID() }] }));
    setArmed(null);
  }
  function removePlaced(stageKey: string, key: string) {
    setPlaced((p) => ({ ...p, [stageKey]: (p[stageKey] ?? []).filter((x) => x.key !== key) }));
  }
  function onStageClick(stageKey: string) {
    if (armed && armed.source !== "stage") place(stageKey, armed);
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

  // --- Poppy engage boxes ---
  function addToPoppy(mode: Engage, item: Lib) {
    if (item.source === "stage") {
      if (mode !== "stage") return; // a stage only belongs in the pipeline-stage box
      setPoppyEngage("stage");
      setPoppyStage(item.refId);
      setArmed(null);
      return;
    }
    setPoppyEngage(mode);
    setPoppyItems((prev) => (prev.some((x) => sameItem(x, item)) ? prev : [...prev, item]));
    setArmed(null);
  }
  function onPoppyBoxDrop(mode: Engage, e: React.DragEvent) {
    e.preventDefault();
    setDropTarget(null);
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return;
    try {
      addToPoppy(mode, JSON.parse(raw) as Lib);
    } catch {
      /* ignore */
    }
  }
  function onPoppyBoxClick(mode: Engage) {
    if (armed) addToPoppy(mode, armed);
  }
  function removePoppyItem(item: Lib) {
    setPoppyItems((prev) => prev.filter((x) => !sameItem(x, item)));
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
            body: `Please read and sign "${item.name}".`,
            triggerStage: stage.key,
            roleValues,
            documentId: item.refId,
            documentKind: item.kind,
          });
        }
      }
    }

    // Poppy step (optional). Present once an engage box has been chosen.
    if (poppyEngage) {
      const poppyFormIds = poppyItems.filter((x) => x.source === "form").map((x) => x.refId);
      const poppyDocumentIds = poppyItems.filter((x) => x.source === "doc").map((x) => x.refId);
      if (poppyFormIds.length === 0 && !poppyIncludeCv) {
        setError("Poppy needs at least one form (or the CV) to review.");
        return;
      }
      if (poppyEngage === "stage" && !poppyStage) {
        setError("Drag a pipeline stage into the third Poppy box.");
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
        triggerStage: poppyEngage === "stage" ? poppyStage : "on_application",
        roleValues,
        poppyEngage,
        poppyFormIds,
        poppyIncludeCv,
        poppyFocus,
        poppyInstructions,
        poppyQuestionCount,
        poppyDocumentIds,
      });
    }

    if (drafts.length === 0) {
      setError("Add at least one form, document or Poppy step.");
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

  const armEq = (l: Lib) => armed && sameItem(armed, l);

  const LibChip = ({ item, icon }: { item: Lib; icon: React.ReactNode }) => (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify(item));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => setArmed(armEq(item) ? null : item)}
      title="Drag it where you want it, or tap it then tap a target"
      className={`flex w-full cursor-grab items-center gap-1.5 rounded-md border px-2 py-1.5 text-left text-xs font-medium text-gray-800 shadow-sm transition active:cursor-grabbing ${
        armEq(item)
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-400"
          : "border-white/70 bg-white/80 hover:border-brand-300"
      }`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-400" />
      {icon}
      <span className="truncate">{item.name}</span>
      {item.poppyOnly && (
        <span className="ml-auto shrink-0 rounded bg-brand-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-700">
          Poppy only
        </span>
      )}
    </button>
  );

  const ItemChip = ({ item, onRemove }: { item: Lib; onRemove: () => void }) => (
    <div className="group flex items-center gap-1 rounded-md border border-white/70 bg-white/90 px-1.5 py-1 text-[11px] font-medium text-gray-800 shadow-sm">
      {item.source === "form" ? (
        <FileText className="h-3 w-3 shrink-0 text-brand-500" />
      ) : item.source === "stage" ? (
        <GitBranch className="h-3 w-3 shrink-0 text-brand-500" />
      ) : (
        <ScrollText className="h-3 w-3 shrink-0 text-brand-500" />
      )}
      <span className="truncate">{item.name}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label="Remove"
        className="ml-auto rounded p-0.5 text-gray-300 hover:bg-red-50 hover:text-red-600"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
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

      {/* Libraries: Forms, Contracts & policies (Pipeline hidden for now) */}
      <div className={`grid grid-cols-1 gap-3 ${SHOW_PIPELINE ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        <div className="rounded-xl border border-white/60 bg-white/50 p-3 backdrop-blur-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <FileText className="h-4 w-4 text-brand-600" /> Forms
          </p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {forms.length === 0 ? (
              <p className="text-xs text-gray-400">No forms yet — create one in Forms first.</p>
            ) : (
              forms.map((f) => <LibChip key={f.id} item={{ source: "form", refId: f.id, name: f.name, poppyOnly: f.poppyOnly }} icon={<FileText className="h-3.5 w-3.5 shrink-0 text-brand-500" />} />)
            )}
          </div>
        </div>
        <div className="rounded-xl border border-white/60 bg-white/50 p-3 backdrop-blur-sm">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
            <ScrollText className="h-4 w-4 text-brand-600" /> Contracts &amp; policies
          </p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {docs.length === 0 ? (
              <p className="text-xs text-gray-400">No contracts or policies yet.</p>
            ) : (
              docs.map((d) => <LibChip key={d.id} item={{ source: "doc", refId: d.id, name: d.name, kind: d.kind }} icon={<ScrollText className="h-3.5 w-3.5 shrink-0 text-brand-500" />} />)
            )}
          </div>
        </div>
        {SHOW_PIPELINE && (
          <div className="rounded-xl border border-white/60 bg-white/50 p-3 backdrop-blur-sm">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <GitBranch className="h-4 w-4 text-brand-600" /> Pipeline
            </p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {STAGES.map((s) => (
                <LibChip key={s.key} item={{ source: "stage", refId: s.key, name: s.label }} icon={<GitBranch className="h-3.5 w-3.5 shrink-0 text-brand-500" />} />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        {armed ? (
          <span className="font-medium text-brand-600">Now tap where “{armed.name}” should go.</span>
        ) : (
          <>Drag forms and documents onto a pipeline stage below to send them to the applicant.</>
        )}
      </p>

      {/* Pipeline stage columns (form / document tasks) — fill the full width */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((stage) => {
          const items = placed[stage.key] ?? [];
          const active = dropTarget === stage.key || (!!armed && armed.source !== "stage");
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
              className={`flex min-h-[7rem] flex-col rounded-xl border p-2 transition ${
                dropTarget === stage.key
                  ? "border-brand-400 bg-brand-50/70 ring-1 ring-brand-300"
                  : active
                    ? "border-brand-200 bg-white/70"
                    : "border-white/60 bg-white/50"
              } backdrop-blur-sm ${armed && armed.source !== "stage" ? "cursor-copy" : ""}`}
            >
              <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600">{stage.label}</p>
              <div className="flex-1 space-y-1.5">
                {items.length === 0 ? (
                  <p className="mt-1 px-0.5 text-[10px] text-gray-400">Drop here</p>
                ) : (
                  items.map((it) => <ItemChip key={it.key} item={it} onRemove={() => removePlaced(stage.key, it.key)} />)
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Poppy AI screening — its own 3-box "when to engage" area. */}
      {poppyEnabled && (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4 backdrop-blur-sm">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
            <Sparkles className="h-4 w-4 text-brand-500" /> Poppy AI screening
          </p>
          <p className="text-xs font-medium text-gray-700">When should Poppy engage?</p>
          <p className="text-[11px] text-gray-500">
            Drop the forms Poppy reviews (and any policies/contracts to compare against) into one box.
            {SHOW_PIPELINE && " For the third box, also drop a pipeline stage."}
          </p>

          <div className={`grid grid-cols-1 gap-3 ${ENGAGE_VISIBLE.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {ENGAGE_VISIBLE.map((mode) => {
              const isActive = poppyEngage === mode.key;
              return (
                <div
                  key={mode.key}
                  onClick={() => onPoppyBoxClick(mode.key)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropTarget(`poppy-${mode.key}`);
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === `poppy-${mode.key}` ? null : t))}
                  onDrop={(e) => onPoppyBoxDrop(mode.key, e)}
                  className={`flex min-h-[7rem] flex-col rounded-xl border p-2.5 transition ${
                    dropTarget === `poppy-${mode.key}`
                      ? "border-brand-400 bg-white ring-1 ring-brand-300"
                      : isActive
                        ? "border-brand-400 bg-white/90"
                        : "border-white/60 bg-white/50"
                  } backdrop-blur-sm ${armed ? "cursor-copy" : ""}`}
                >
                  <p className={`mb-1.5 text-[11px] font-semibold ${isActive ? "text-brand-800" : "text-gray-600"}`}>
                    {mode.label}
                  </p>
                  <div className="flex-1 space-y-1.5">
                    {isActive ? (
                      <>
                        {mode.key === "stage" && (
                          poppyStage ? (
                            <ItemChip
                              item={{ source: "stage", refId: poppyStage, name: STAGES.find((s) => s.key === poppyStage)?.label ?? poppyStage }}
                              onRemove={() => setPoppyStage("")}
                            />
                          ) : (
                            <p className="rounded-md border border-dashed border-brand-300 px-1.5 py-1 text-[10px] text-brand-600/70">
                              Drop a pipeline stage
                            </p>
                          )
                        )}
                        {poppyItems.map((it) => (
                          <ItemChip key={`${it.source}-${it.refId}`} item={it} onRemove={() => removePoppyItem(it)} />
                        ))}
                        {poppyItems.length === 0 && mode.key !== "stage" && (
                          <p className="px-0.5 text-[10px] text-gray-400">Drop forms / policies / contracts</p>
                        )}
                      </>
                    ) : (
                      <p className="px-0.5 text-[10px] text-gray-400">
                        {mode.key === "stage" ? "Drop forms, docs & a stage" : "Drop forms / policies / contracts"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {poppyEngage && (
            <>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={poppyIncludeCv}
                  onChange={() => setPoppyIncludeCv((v) => !v)}
                  className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                />
                Also review the applicant&apos;s CV
              </label>

              {/* Optional fine-tuning. */}
              <div className="space-y-3 rounded-lg border border-white/60 bg-white/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Fine-tune (optional)</p>
                <div className="text-xs font-medium text-gray-600">
                  Focus on
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {POPPY_FOCUS_OPTIONS.map((f) => {
                      const on = poppyFocus.includes(f);
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setPoppyFocus((prev) => (on ? prev.filter((x) => x !== f) : [...prev, f]))}
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
                    Number of questions
                    <input
                      value={poppyQuestionCount}
                      onChange={(e) => setPoppyQuestionCount(e.target.value)}
                      type="number"
                      min="1"
                      max="20"
                      placeholder="Default"
                      className={cls}
                    />
                  </label>
                </div>
                <label className="block text-xs font-medium text-gray-600">
                  Instructions for Poppy
                  <textarea
                    value={poppyInstructions}
                    onChange={(e) => setPoppyInstructions(e.target.value)}
                    rows={2}
                    placeholder="e.g. Probe any gaps in employment history."
                    className={cls}
                  />
                </label>
                <p className="text-[11px] text-gray-400">
                  The role&apos;s job description is always compared. Leave blank to use your Settings default.
                </p>
              </div>
            </>
          )}
        </div>
      )}

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

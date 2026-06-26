import { requirePlatformAdmin } from "@/modules/auth/queries";
import { WorkflowStoreManager, type StoreWorkflow, type StoreFormOption } from "@/components/founder/workflow-store-manager";

export default async function FounderWorkflowsPage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: rows }, { data: forms }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select(
        "id, title, task_type, form_id, trigger_stage, required, due_days, body, position, workflow_id, workflow_name, store_category, store_description, store_published"
      )
      .eq("is_store", true)
      .order("workflow_id", { ascending: true })
      .order("position", { ascending: true }),
    supabase.from("forms").select("id, name").eq("is_store", true).order("name", { ascending: true }),
  ]);

  // Group store rows into workflows by workflow_id.
  type Row = {
    id: string; title: string; task_type: string; form_id: string | null;
    trigger_stage: string | null; required: boolean; due_days: number | null;
    body: string | null; position: number; workflow_id: string; workflow_name: string;
    store_category: string | null; store_description: string | null; store_published: boolean;
  };
  const map = new Map<string, StoreWorkflow>();
  for (const r of (rows ?? []) as Row[]) {
    const wf = map.get(r.workflow_id) ?? {
      id: r.workflow_id,
      name: r.workflow_name,
      category: r.store_category,
      description: r.store_description,
      published: r.store_published,
      steps: [],
    };
    wf.steps.push({
      id: r.id,
      title: r.title,
      taskType: r.task_type,
      formId: r.form_id,
      triggerStage: r.trigger_stage,
      required: r.required,
      dueDays: r.due_days,
      body: r.body,
    });
    map.set(r.workflow_id, wf);
  }
  const workflows = [...map.values()];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Workflows</h1>
      <p className="mt-1 max-w-2xl text-sm text-white/80">
        Build reusable onboarding workflows from your store forms. Publish the ones you want to
        offer, then pick them when setting up a company — they copy in and the company owns their
        copy. Editing it there never changes your master here.
      </p>
      <div className="mt-6">
        <WorkflowStoreManager
          workflows={workflows}
          storeForms={(forms ?? []) as StoreFormOption[]}
        />
      </div>
    </div>
  );
}

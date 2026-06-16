import { requirePlatformAdmin } from "@/modules/auth/queries";
import {
  QuestionBankManager,
  type QuestionTemplate,
} from "@/components/dashboard/question-bank-manager";

export default async function QuestionBankPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data } = await supabase
    .from("question_templates")
    .select("id, label, field_type, options, help_text, category")
    .order("category")
    .order("position");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Question bank</h1>
      <p className="mt-1 text-sm text-white/80">
        Ready-made questions every company can drop into their forms from the
        builder&apos;s &ldquo;+&rdquo; menu.
      </p>
      <div className="mt-6">
        <QuestionBankManager questions={(data ?? []) as QuestionTemplate[]} />
      </div>
    </div>
  );
}

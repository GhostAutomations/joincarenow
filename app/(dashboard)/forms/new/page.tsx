import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { createForm } from "@/modules/forms/actions";
import { CreateFormButton } from "@/components/dashboard/create-form-button";

export default async function NewFormPage() {
  // Guard: only company members reach this.
  await requireCompany();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/forms"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to forms
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-gray-900">Create a form</h1>
      <p className="mt-1 text-sm text-gray-500">
        Give your form a name. You&apos;ll add fields (or import them from a PDF)
        on the next screen.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <CreateFormButton action={createForm} />
      </div>
    </div>
  );
}

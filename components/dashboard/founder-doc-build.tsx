"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { DocEditorForm } from "@/components/dashboard/doc-editor-form";
import { StoreDocBar } from "@/components/dashboard/store-doc-bar";
import { saveStoreDoc, deleteStoreDoc } from "@/modules/contracts/actions";

type Kind = "contract" | "policy" | "job_description";

const NOUN: Record<Kind, string> = {
  contract: "contract template",
  policy: "policy",
  job_description: "job description",
};

const TAB: Record<Kind, string> = {
  contract: "contracts",
  policy: "policies",
  job_description: "jobdescriptions",
};

/** Founder File Store builder for a doc template. Combines the store settings bar
 *  (category / price / publish) with the reusable DocEditorForm (name / body / AI
 *  / signature), all writing to the store row. Mirrors the founder form builder. */
export function FounderDocBuild({
  kind,
  doc,
  category,
  pricePence,
  published,
}: {
  kind: Kind;
  doc: { id: string; name: string; body: string; signatureMethod: "type" | "draw" | "none" };
  category: string;
  pricePence: number;
  published: boolean;
}) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/founder/forms?tab=${TAB[kind]}`}
          className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to File Store
        </Link>
        <form action={deleteStoreDoc}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={doc.id} />
          <button
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            onClick={(e) => {
              if (!confirm(`Delete this ${NOUN[kind]}? This can't be undone.`)) e.preventDefault();
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </form>
      </div>

      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">
        {doc.name || `Untitled ${NOUN[kind]}`}
      </h1>
      <p className="text-sm text-white/80">Store {NOUN[kind]} · set its category and price below.</p>

      <div className="mt-4">
        <StoreDocBar
          kind={kind}
          docId={doc.id}
          category={category}
          pricePence={pricePence}
          published={published}
        />
      </div>

      <div className="mt-4 rounded-2xl border border-white/40 bg-white/90 p-6 shadow-lg backdrop-blur-md">
        <DocEditorForm
          key={`${kind}-${doc.id}`}
          kind={kind}
          doc={doc}
          store
          embedded
          saveAction={saveStoreDoc}
          onSaved={() => router.refresh()}
          onCancel={() => router.push(`/founder/forms?tab=${TAB[kind]}`)}
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { removeFromTalentPool } from "@/modules/applications/actions";

/** Remove an applicant from the Talent Pool (deletes their applications at this
 *  company). Confirms first, since it's irreversible. */
export function RemoveFromPoolButton({ applicantId, name }: { applicantId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !confirm(
        `Remove ${name} from the talent pool?\n\nThis permanently deletes their application(s) and related records at your company. It can't be undone. Their profile stays intact, so they can apply again.`
      )
    )
      return;
    setBusy(true);
    const r = await removeFromTalentPool(applicantId);
    setBusy(false);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label={`Remove ${name} from talent pool`}
      title="Remove from talent pool"
      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

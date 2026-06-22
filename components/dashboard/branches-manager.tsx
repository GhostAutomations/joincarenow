import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";

/** Read-only list. Branches are added/removed in Billing (each extra branch is
 *  a paid add-on), so management lives there. */
export function BranchesManager({
  branches,
}: {
  branches: { id: string; name: string }[];
  companyId?: string;
}) {
  return (
    <div>
      {branches.length > 0 ? (
        <ul className="mb-3 divide-y divide-gray-100">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center gap-2 py-2.5 text-sm text-gray-900">
              <Building2 className="h-4 w-4 text-gray-400" />
              {b.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-gray-500">No branches yet.</p>
      )}
      <Link
        href="/billing"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
      >
        Add or remove branches in Billing <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

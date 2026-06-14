import { revokeInvitation } from "@/modules/invitations/actions";

export type PendingInvite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  companies?: { name: string } | null;
};

/** Server component: lists pending invitations with a revoke action.
 *  Set `showCompany` in the founder console where invites span companies. */
export function PendingInvites({
  invites,
  showCompany = false,
}: {
  invites: PendingInvite[];
  showCompany?: boolean;
}) {
  if (invites.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">No pending invitations.</p>;
  }

  return (
    <ul className="mt-4 divide-y divide-gray-100">
      {invites.map((inv) => (
        <li key={inv.id} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {inv.email}
            </p>
            <p className="text-xs text-gray-500">
              {showCompany && inv.companies?.name
                ? `${inv.companies.name} · `
                : ""}
              <span className="capitalize">{inv.role}</span> · expires{" "}
              {new Date(inv.expires_at).toLocaleDateString("en-GB")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Pending
            </span>
            <form action={revokeInvitation}>
              <input type="hidden" name="id" value={inv.id} />
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                Revoke
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

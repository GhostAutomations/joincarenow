"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { createRole, deleteRole, reorderRoles, type RoleState } from "@/modules/roles/actions";

type Role = { id: string; name: string; team?: string };

/** One team's roles: drag-reorderable list + add form. */
function RoleGroup({
  title,
  hint,
  team,
  roles,
  companyId,
}: {
  title: string;
  hint: string;
  team: "care" | "office";
  roles: Role[];
  companyId: string;
}) {
  const [state, action] = useActionState<RoleState, FormData>(createRole, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [items, setItems] = useState<Role[]>(roles);
  const [dragId, setDragId] = useState<string | null>(null);
  useEffect(() => setItems(roles), [roles]);
  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return setDragId(null);
    const from = items.findIndex((r) => r.id === dragId);
    const to = items.findIndex((r) => r.id === targetId);
    if (from === -1 || to === -1) return setDragId(null);
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    setDragId(null);
    void reorderRoles(companyId, next.map((r) => r.id));
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mb-2 text-xs text-gray-500">{hint}</p>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((r) => (
            <li
              key={r.id}
              draggable
              onDragStart={() => setDragId(r.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(r.id)}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition ${
                dragId === r.id ? "border-brand-400 bg-brand-50" : "border-gray-200 bg-white/80"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-gray-400 active:cursor-grabbing" />
                <span className="truncate text-sm font-medium text-gray-900">{r.name}</span>
              </span>
              <form action={deleteRole}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="companyId" value={companyId} />
                <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove role">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={ref} action={action} className="flex items-start gap-2">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="team" value={team} />
        <div className="flex-1">
          {state?.error && <p className="mb-1 text-xs text-red-600">{state.error}</p>}
          <input
            name="name"
            placeholder={team === "office" ? "e.g. Coordinator, Trainer" : "e.g. Walker, Driver"}
            className="block w-full rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
    </div>
  );
}

export function RolesManager({
  roles,
  companyId,
}: {
  roles: Role[];
  companyId: string;
}) {
  const care = roles.filter((r) => (r.team ?? "care") !== "office");
  const office = roles.filter((r) => r.team === "office");

  return (
    <div className="space-y-5">
      <RoleGroup
        title="Branch / care roles"
        hint="Roles you recruit for at your care branches (drag to reorder)."
        team="care"
        roles={care}
        companyId={companyId}
      />
      <div className="border-t border-gray-200" />
      <RoleGroup
        title="Office Team roles"
        hint="Head-office roles — recruited for the Office Team, not a branch."
        team="office"
        roles={office}
        companyId={companyId}
      />
    </div>
  );
}

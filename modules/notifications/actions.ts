"use server";

import { requireUser } from "@/modules/auth/queries";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

/** Recent notifications for the signed-in user + unread count. */
export async function getNotifications(): Promise<{
  items: Notification[];
  unread: number;
}> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  const items = (data ?? []) as Notification[];
  return { items, unread: items.filter((n) => !n.read_at).length };
}

export async function markNotificationRead(id: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
}

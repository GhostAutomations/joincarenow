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

// ---------- Per-user notification preferences ----------

type Channel = { inApp: boolean; email: boolean };
export type NotificationPrefs = { new_application: Channel; applicant_message: Channel };
export type PrefsState = { ok?: boolean; error?: string } | undefined;

const PREF_DEFAULTS: NotificationPrefs = {
  new_application: { inApp: true, email: true },
  applicant_message: { inApp: true, email: true },
};

/** The signed-in user's notification preferences (unset channels default on). */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", user.id)
    .maybeSingle();
  const saved = (data?.notification_prefs ?? null) as Partial<NotificationPrefs> | null;
  return {
    new_application: { ...PREF_DEFAULTS.new_application, ...(saved?.new_application ?? {}) },
    applicant_message: { ...PREF_DEFAULTS.applicant_message, ...(saved?.applicant_message ?? {}) },
  };
}

export async function setNotificationPrefs(_prev: PrefsState, formData: FormData): Promise<PrefsState> {
  const { supabase, user } = await requireUser();
  const on = (k: string) => formData.get(k) === "on";
  const prefs: NotificationPrefs = {
    new_application: { inApp: on("new_application_inApp"), email: on("new_application_email") },
    applicant_message: { inApp: on("applicant_message_inApp"), email: on("applicant_message_email") },
  };
  const { error } = await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", user.id);
  if (error) return { error: "Could not save your preferences. Please try again." };
  return { ok: true };
}

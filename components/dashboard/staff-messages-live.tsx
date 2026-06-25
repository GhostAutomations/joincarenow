"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Live-refresh the staff Messages screens on new/updated internal messages.
 *  RLS scopes events to the company. */
export function StaffMessagesLive() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => { if (pending) clearTimeout(pending); pending = setTimeout(() => router.refresh(), 400); };
    const channel = supabase
      .channel("staff-messages-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_messages" }, refresh)
      .subscribe();
    const poll = setInterval(() => { if (!document.hidden) router.refresh(); }, 10_000);
    return () => { if (pending) clearTimeout(pending); clearInterval(poll); supabase.removeChannel(channel); };
  }, [router]);
  return null;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Live-refreshes the Sales (CRM) pipeline when a prospect's stage changes
 *  (e.g. an inbound email/SMS auto-moves it) or a message lands. Its own
 *  channel — independent of the pipeline/portal/sign-off subscriptions, so it
 *  has no effect on push latency for any other feature. RLS scopes events to
 *  the founder. */
export function ProspectLive() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel("prospect-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_companies" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_activities" }, refresh)
      .subscribe();

    // Safety net: poll every 10s while the tab is visible, so the board still
    // catches changes made in another session (e.g. a prospect accepting a
    // proposal) even if the realtime socket drops an event. Matches the
    // recruitment pipeline-board pattern.
    const poll = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 10_000);

    const onVisible = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (pending) clearTimeout(pending);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}

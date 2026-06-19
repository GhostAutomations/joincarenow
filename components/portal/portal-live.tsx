"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Live-refreshes the applicant portal when anything is sent to them — offers,
 *  forms/document requests (onboarding_tasks), interviews, messages, or a stage
 *  change. RLS scopes events to this applicant's own rows. A slow poll is kept
 *  as a safety net if the socket drops. */
export function PortalLive() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase.channel("portal-live");
    for (const table of ["offers", "applications", "interviews", "messages", "onboarding_tasks"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();

    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 60000);

    return () => {
      if (pending) clearTimeout(pending);
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}

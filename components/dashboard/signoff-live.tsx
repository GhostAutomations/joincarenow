"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Live-refreshes the Sign Off widget/screen when a contract or policy is
 *  signed, signed off, rejected or re-signed. Its own channel — independent of
 *  the pipeline/portal subscriptions. RLS scopes events to this company. */
export function SignoffLive() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase
      .channel("signoff-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "signed_documents" }, refresh)
      .subscribe();

    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 60000);

    const onVisible = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (pending) clearTimeout(pending);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}

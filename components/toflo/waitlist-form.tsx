"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      const res = await fetch("/api/toflo/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not join right now. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("done");
    } catch {
      setError("Could not join right now. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
        <Check className="h-4 w-4" aria-hidden />
        You&apos;re on the list. We&apos;ll be in touch when Toflo launches.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/40 backdrop-blur focus:border-emerald-400/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
        />
        <button
          disabled={status === "loading"}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
        >
          {status === "loading" ? "Joining…" : "Join the waitlist"}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
      <p className="mt-2 text-xs text-white/40">No spam. Just one email when we launch.</p>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { CreditCard } from "lucide-react";
import { startActivationCheckout } from "@/modules/billing/actions";

export function ActivatePay() {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => startActivationCheckout())}
      disabled={pending}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
    >
      <CreditCard className="h-4 w-4" /> {pending ? "Opening secure checkout…" : "Pay & activate"}
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Building2, Store, MessageSquareText, ListChecks, Users, ScrollText, Plug, TriangleAlert, MessageSquarePlus, Lightbulb, BarChart3, CreditCard, Target, ClipboardCheck } from "lucide-react";

const APPS = [
  { href: "/founder/sales", label: "Sales", icon: Target, grad: "from-rose-500 to-pink-600" },
  { href: "/founder/companies", label: "Companies", icon: Building2, grad: "from-teal-400 to-teal-600" },
  { href: "/founder/statistics", label: "Statistics", icon: BarChart3, grad: "from-blue-400 to-blue-600" },
  { href: "/founder/billing", label: "Billing", icon: CreditCard, grad: "from-amber-400 to-amber-500" },
  { href: "/founder/users", label: "Users", icon: Users, grad: "from-sky-400 to-sky-600" },
  { href: "/founder/feedback", label: "Feedback", icon: MessageSquarePlus, grad: "from-fuchsia-400 to-fuchsia-600" },
  { href: "/founder/requests", label: "Requests", icon: Lightbulb, grad: "from-yellow-400 to-amber-500" },
  { href: "/founder/audit", label: "Audit log", icon: ScrollText, grad: "from-violet-400 to-violet-600" },
  { href: "/founder/integrations", label: "Integrations", icon: Plug, grad: "from-emerald-400 to-emerald-600" },
  { href: "/founder/errors", label: "Errors", icon: TriangleAlert, grad: "from-red-400 to-red-600" },
  { href: "/founder/forms", label: "Form Store", icon: Store, grad: "from-rose-400 to-rose-600" },
  { href: "/founder/workflows", label: "Workflows", icon: ClipboardCheck, grad: "from-emerald-400 to-emerald-600" },
  { href: "/founder/questions", label: "Question Bank", icon: ListChecks, grad: "from-amber-400 to-amber-500" },
  { href: "/founder/sms", label: "SMS Usage", icon: MessageSquareText, grad: "from-pink-400 to-pink-600" },
] as const;

export function FounderAppGrid() {
  const router = useRouter();
  return (
    <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5 lg:grid-cols-6">
      {APPS.map(({ href, label, icon: Icon, grad }) => (
        <button
          key={href}
          onClick={() => router.push(href)}
          className="group flex flex-col items-center gap-2"
        >
          <div className={`relative grid h-[68px] w-[68px] place-items-center rounded-[20px] bg-gradient-to-br ${grad} border border-white/30 shadow-lg transition-transform group-hover:-translate-y-1`}>
            <Icon className="h-8 w-8 text-white" strokeWidth={1.8} />
          </div>
          <span className="text-[13px] font-medium text-white">{label}</span>
        </button>
      ))}
    </div>
  );
}

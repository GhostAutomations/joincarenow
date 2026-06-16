"use client";

import { useRouter } from "next/navigation";
import { Building2, Store, MessageSquareText } from "lucide-react";

const APPS = [
  { href: "/admin/companies", label: "Companies", icon: Building2, grad: "from-teal-400 to-teal-600" },
  { href: "/admin/forms", label: "Form Store", icon: Store, grad: "from-rose-400 to-rose-600" },
  { href: "/admin/sms", label: "SMS Usage", icon: MessageSquareText, grad: "from-pink-400 to-pink-600" },
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

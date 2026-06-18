"use client";

import { useState, type ReactNode } from "react";
import {
  Building2,
  PanelLeft,
  Globe,
  MapPin,
  Tag,
  FileSignature,
  Hash,
  CalendarClock,
  Clock,
  Users,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";

export type SettingsSection = {
  key: string;
  label: string;
  description: string;
  content: ReactNode;
};

const ICONS: Record<string, LucideIcon> = {
  company: Building2,
  navigation: PanelLeft,
  careers: Globe,
  branches: MapPin,
  roles: Tag,
  contracts: FileSignature,
  numbers: Hash,
  interview: CalendarClock,
  hours: Clock,
  team: Users,
};

const TILE_TINT: Record<string, string> = {
  company: "from-slate-500 to-slate-600",
  navigation: "from-sky-500 to-sky-600",
  careers: "from-teal-500 to-teal-600",
  branches: "from-emerald-500 to-emerald-600",
  roles: "from-amber-500 to-amber-600",
  contracts: "from-violet-500 to-violet-600",
  numbers: "from-rose-500 to-rose-600",
  interview: "from-indigo-500 to-indigo-600",
  hours: "from-cyan-500 to-cyan-600",
  team: "from-blue-500 to-blue-600",
};

export function SettingsHub({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState<string | null>(null);
  const current = sections.find((s) => s.key === active) ?? null;

  if (current) {
    const Icon = ICONS[current.key] ?? Building2;
    return (
      <div className="mt-6 mx-auto max-w-3xl">
        <button
          onClick={() => setActive(null)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> All settings
        </button>

        <section className="mt-4 rounded-2xl border border-white/40 bg-white/80 p-6 shadow-lg backdrop-blur-md">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm ${
                TILE_TINT[current.key] ?? "from-slate-500 to-slate-600"
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-medium text-gray-900">{current.label}</h2>
              <p className="mt-0.5 text-sm text-gray-500">{current.description}</p>
            </div>
          </div>
          <div className="mt-5">{current.content}</div>
        </section>
      </div>
    );
  }

  return (
    <div className="mt-6 grid w-fit grid-cols-3 gap-x-[84px] gap-y-8 sm:grid-cols-5 mx-auto">
      {sections.map((s) => {
        const Icon = ICONS[s.key] ?? Building2;
        return (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            title={s.description}
            className="group flex w-14 flex-col items-center gap-2 text-center"
          >
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md ${
                TILE_TINT[s.key] ?? "from-slate-500 to-slate-600"
              }`}
            >
              <Icon className="h-6 w-6" />
            </span>
            <span className="block text-xs font-medium leading-tight text-white drop-shadow-sm">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

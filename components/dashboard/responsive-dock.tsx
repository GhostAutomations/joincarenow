"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, X, LayoutGrid, type LucideIcon } from "lucide-react";

export type DockItem = { href: string; label: string; icon: LucideIcon; grad: string };

/**
 * Shared app navigation. On desktop/tablet it's the floating glassy dock; on
 * phones it's a slim bottom tab bar (4 primary apps + "More"), where "More"
 * opens the full app grid as a sheet. Keeps the screen usable on mobile.
 */
export function ResponsiveDock({
  items,
  primary,
  isActive,
}: {
  items: DockItem[];
  primary: string[]; // hrefs shown in the mobile bottom bar (first 4 used)
  isActive?: (pathname: string, href: string) => boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Desktop dock sits minimised and opens on hover (click as a touch fallback).
  const [expanded, setExpanded] = useState(false);

  const active = (href: string) =>
    isActive ? isActive(pathname, href) : pathname === href || pathname.startsWith(href + "/");

  const go = (href: string) => {
    setOpen(false);
    setExpanded(false);
    router.push(href);
  };

  const primaryItems = primary
    .map((h) => items.find((i) => i.href === h))
    .filter((i): i is DockItem => Boolean(i))
    .slice(0, 4);

  return (
    <>
      {/* Desktop / tablet floating dock — minimised to an "Apps" pill that opens
          on hover (click to open on touch); a single row that never wraps
          (scrolls sideways if needed). Collapses again on mouse-leave. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 hidden justify-center px-3 sm:flex">
        <div
          className="pointer-events-auto"
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
        >
          {expanded ? (
            <div className="flex max-w-[94vw] items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/50 bg-white/70 px-2.5 py-2 shadow-xl backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {items.map(({ href, label, icon: Icon, grad }) => (
                <button
                  key={href}
                  onClick={() => go(href)}
                  aria-label={label}
                  title={label}
                  className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow transition hover:brightness-110 ${
                    active(href) ? "ring-2 ring-brand-600 ring-offset-2 ring-offset-white/60" : ""
                  }`}
                >
                  <Icon className="h-8 w-8" strokeWidth={1.9} />
                </button>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              aria-label="Show app dock"
              title="Apps"
              className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/70 px-4 py-2.5 text-gray-700 shadow-xl backdrop-blur-xl transition hover:bg-white/90"
            >
              <LayoutGrid className="h-5 w-5" strokeWidth={1.9} />
              <span className="text-sm font-medium">Apps</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
        <div className="grid grid-cols-5">
          {primaryItems.map(({ href, label, icon: Icon }) => (
            <button
              key={href}
              onClick={() => go(href)}
              aria-label={label}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                active(href) ? "text-brand-700" : "text-gray-500"
              }`}
            >
              <Icon className="h-6 w-6" strokeWidth={1.9} />
              <span className="leading-none">{label}</span>
            </button>
          ))}
          <button
            onClick={() => setOpen(true)}
            aria-label="More apps"
            aria-expanded={open}
            className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${open ? "text-brand-700" : "text-gray-500"}`}
          >
            <MoreHorizontal className="h-6 w-6" strokeWidth={1.9} />
            <span className="leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* Mobile "More" sheet — full app grid */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="All apps">
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-gray-300" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">All apps</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {items.map(({ href, label, icon: Icon, grad }) => (
                <button
                  key={href}
                  onClick={() => go(href)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-3 ${
                    active(href) ? "border-brand-300 bg-brand-50" : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <span className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${grad} text-white shadow`}>
                    <Icon className="h-6 w-6" strokeWidth={1.9} />
                  </span>
                  <span className="text-center text-[11px] font-medium leading-tight text-gray-700">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

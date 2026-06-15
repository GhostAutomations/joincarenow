"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Bell, MessageSquare } from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "@/modules/notifications/actions";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { items, unread } = await getNotifications();
      setItems(items);
      setUnread(unread);
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // poll every 30s
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.read_at) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      await markNotificationRead(n.id);
    }
    if (n.link) router.push(n.link);
  }

  async function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    await markAllNotificationsRead();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
            <span className="text-sm font-medium text-gray-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-brand-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full items-start gap-2.5 border-b border-gray-50 px-4 py-3 text-left hover:bg-gray-50 ${
                    n.read_at ? "" : "bg-blue-50/50"
                  }`}
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                    {n.body && <span className="block truncate text-xs text-gray-500">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-gray-400">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/** Shows a created invitation link with a copy button. Shared by the founder
 *  console and Settings. A welcome email is sent automatically on company
 *  creation; this link is a manual fallback (and the primary route for team
 *  invites from Settings). */
export function InviteLink({ link, email }: { link: string; email: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <p className="text-sm font-medium text-green-800">
        Invitation created for {email}
      </p>
      <p className="mt-1 text-xs text-green-700">
        Manual fallback link (expires in 14 days) — they normally get their login link
        in the &ldquo;account ready&rdquo; email you fire once setup is complete:
      </p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="block w-full rounded-md border border-green-300 bg-white px-2 py-1.5 text-xs text-gray-700"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

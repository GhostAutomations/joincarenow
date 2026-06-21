import type { NextRequest } from "next/server";

/** Agent endpoints are authenticated by a static key (AGENT_API_KEY), not a user
 *  session — the sales/comms agents call them server-to-server. Founder-scoped:
 *  they only ever touch the isolated prospect_* tables via the service role. */
export function checkAgentKey(req: NextRequest): boolean {
  const key = process.env.AGENT_API_KEY;
  if (!key) return false;
  return req.headers.get("authorization") === `Bearer ${key}`;
}

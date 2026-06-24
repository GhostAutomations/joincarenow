/** True in the deployed production environment. Used to FAIL CLOSED on webhook /
 *  cron auth: if a required secret is missing in production we reject the
 *  request, but in local/preview development we allow it so testing isn't
 *  blocked by unset secrets. */
export function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

/** Authorize a cron request by its `Authorization: Bearer <CRON_SECRET>` header.
 *  Fails closed in production if CRON_SECRET isn't set; allows it in dev so the
 *  jobs can be triggered locally. */
export function cronAuthorized(req: { headers: { get(name: string): string | null } }): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !isProduction();
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

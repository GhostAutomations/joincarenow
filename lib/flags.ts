// Feature flags. Server-only reads of env vars, so nothing leaks to the client.

/**
 * Public self-serve company signup. OFF until the Ltd is formed and the item-4
 * terms/DPA are live (a self-serve customer accepts the terms and pays with no
 * human in the loop, so the contract must be in the company's name first).
 * When ON: the /start signup flow is live and "Start free trial" becomes the
 * primary marketing CTA. Flip by setting SELF_SERVE_SIGNUP=true in the
 * environment.
 */
export function selfServeEnabled(): boolean {
  return process.env.SELF_SERVE_SIGNUP === "true";
}

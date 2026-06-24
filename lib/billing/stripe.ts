import crypto from "crypto";

const API = "https://api.stripe.com/v1";

export const BASE_URL = "https://www.joincarenow.com";

/** Stripe price IDs (set in Vercel env after creating the products in Stripe). */
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY, // £55 / month recurring
  annual: process.env.STRIPE_PRICE_ANNUAL, // £550 / year recurring
  setup: process.env.STRIPE_PRICE_SETUP, // £150 one-time
  // Add-ons come in interval variants so they can attach to either base plan
  // (Stripe forbids mixing intervals within one subscription).
  branch: process.env.STRIPE_PRICE_BRANCH, // £7.50 / month (licensed)
  branchYear: process.env.STRIPE_PRICE_BRANCH_YEAR, // £75 / year (licensed)
  sms: process.env.STRIPE_PRICE_SMS, // 8p metered, monthly
  smsYear: process.env.STRIPE_PRICE_SMS_YEAR, // 8p metered, yearly
  ai: process.env.STRIPE_PRICE_AI, // 10p metered, monthly
  aiYear: process.env.STRIPE_PRICE_AI_YEAR, // 10p metered, yearly
};

function key(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) throw new Error("Billing isn't configured (missing STRIPE_SECRET_KEY).");
  return k;
}

/** Flatten nested params into Stripe's form-encoded format (a[b][c]=v, a[0]=v). */
function encode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object") out.push(...encode(item as Record<string, unknown>, `${name}[${i}]`));
        else out.push(`${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      out.push(...encode(v as Record<string, unknown>, name));
    } else {
      out.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

async function stripeRequest<T = Record<string, unknown>>(
  path: string,
  method: "GET" | "POST" | "DELETE",
  params?: Record<string, unknown>
): Promise<T> {
  const body = params ? encode(params).join("&") : undefined;
  const url = method === "GET" && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" || method === "DELETE" ? body : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = (json as { error?: { message?: string } })?.error?.message ?? "Stripe request failed";
    throw new Error(msg);
  }
  return json as T;
}

/** Find or create the Stripe customer for a company. */
export async function ensureCustomer(opts: {
  existingId: string | null;
  companyId: string;
  name: string;
  email?: string | null;
}): Promise<string> {
  if (opts.existingId) return opts.existingId;
  const c = await stripeRequest<{ id: string }>("/customers", "POST", {
    name: opts.name,
    email: opts.email ?? undefined,
    metadata: { company_id: opts.companyId },
  });
  return c.id;
}

/** Fetch a Price (to read its product for custom-priced concessions). */
async function getPrice(priceId: string) {
  return stripeRequest<{ id: string; product: string }>(`/prices/${priceId}`, "GET");
}

/** Create (idempotently) a coupon and return its id. Stripe lets us choose the
 *  id, so the same concession reuses one coupon. */
async function ensureCoupon(id: string, params: Record<string, unknown>): Promise<string> {
  try {
    const c = await stripeRequest<{ id: string }>("/coupons", "POST", { id, ...params });
    return c.id;
  } catch (e) {
    // Already created before — reuse it.
    if (e instanceof Error && /already exists/i.test(e.message)) return id;
    throw e;
  }
}

/** Turn a parsed concession into a Stripe coupon id (free months), if any. */
async function concessionCoupon(
  interval: "month" | "year",
  freeMonths?: number
): Promise<string | undefined> {
  if (!freeMonths || freeMonths < 1) return undefined;
  if (interval === "month") {
    // 100% off for N months on a monthly plan.
    return ensureCoupon(`jcn_free_${freeMonths}m`, {
      percent_off: 100,
      duration: "repeating",
      duration_in_months: freeMonths,
      name: `${freeMonths} month${freeMonths === 1 ? "" : "s"} free`,
    });
  }
  // Annual plan: apply the equivalent share off the first year's invoice.
  const pct = Math.min(100, Math.round((freeMonths / 12) * 100));
  return ensureCoupon(`jcn_annual_off_${pct}`, {
    percent_off: pct,
    duration: "once",
    name: `${freeMonths} month${freeMonths === 1 ? "" : "s"} free (annual)`,
  });
}

/** Create a Checkout session for the base subscription (+ one-off setup fee on
 *  monthly). Metered SMS/AI items are attached so usage can be reported later.
 *  An optional sales concession adjusts the price (custom monthly price) and/or
 *  applies a discount (free months). */
export async function createCheckoutSession(opts: {
  customerId: string;
  companyId: string;
  interval: "month" | "year";
  commit?: boolean; // monthly with a 12-month commitment (no setup fee)
  concession?: { freeMonths?: number; customMonthlyPence?: number } | null;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<string> {
  const basePrice = opts.interval === "year" ? PRICES.annual : PRICES.monthly;
  if (!basePrice) throw new Error("Plan price isn't configured.");

  const committed = opts.interval === "month" && opts.commit === true;
  // Base line item — replaced by a custom recurring price if a £x/mo concession
  // was agreed (monthly plans only; annual custom pricing stays standard).
  let baseItem: Record<string, unknown> = { price: basePrice, quantity: 1 };
  if (opts.interval === "month" && opts.concession?.customMonthlyPence && opts.concession.customMonthlyPence > 0) {
    const { product } = await getPrice(basePrice);
    baseItem = {
      price_data: {
        currency: "gbp",
        product,
        unit_amount: opts.concession.customMonthlyPence,
        recurring: { interval: "month" },
      },
      quantity: 1,
    };
  }
  const lineItems: Record<string, unknown>[] = [baseItem];

  // Setup fee applies on monthly, but is waived for annual and the commitment.
  if (opts.interval === "month" && !committed && PRICES.setup) lineItems.push({ price: PRICES.setup, quantity: 1 });
  // Metered add-ons must match the base interval (Stripe forbids mixing).
  const isYear = opts.interval === "year";
  const smsPrice = isYear ? PRICES.smsYear : PRICES.sms;
  const aiPrice = isYear ? PRICES.aiYear : PRICES.ai;
  if (smsPrice) lineItems.push({ price: smsPrice });
  if (aiPrice) lineItems.push({ price: aiPrice });

  // Defensive: Stripe rejects the same recurring price twice.
  const seen = new Set<string>();
  const uniqueItems = lineItems.filter((li) => {
    const p = li.price as string | undefined;
    if (!p) return true; // price_data items are always unique
    return seen.has(p) ? false : (seen.add(p), true);
  });

  // Free-months concession → a discount coupon. (Can't combine with promo codes.)
  const coupon = await concessionCoupon(opts.interval, opts.concession?.freeMonths);

  const params: Record<string, unknown> = {
    mode: "subscription",
    customer: opts.customerId,
    line_items: uniqueItems,
    success_url: opts.successUrl ?? `${BASE_URL}/billing?status=success`,
    cancel_url: opts.cancelUrl ?? `${BASE_URL}/billing?status=cancelled`,
    subscription_data: { metadata: { company_id: opts.companyId, commitment_months: committed ? "12" : "" } },
    metadata: { company_id: opts.companyId, commitment_months: committed ? "12" : "" },
  };
  if (coupon) params.discounts = [{ coupon }];
  else params.allow_promotion_codes = true;

  const session = await stripeRequest<{ url: string }>("/checkout/sessions", "POST", params);
  return session.url;
}

/** Create a Stripe Customer Portal session so the company can manage billing.
 *  Pass `noCancel` for committed customers to use a portal configuration that
 *  doesn't allow cancellation (STRIPE_PORTAL_CONFIG_NOCANCEL). */
export async function createPortalSession(customerId: string, noCancel = false): Promise<string> {
  const params: Record<string, unknown> = { customer: customerId, return_url: `${BASE_URL}/billing` };
  const cfg = process.env.STRIPE_PORTAL_CONFIG_NOCANCEL;
  if (noCancel && cfg) params.configuration = cfg;
  const session = await stripeRequest<{ url: string }>("/billing_portal/sessions", "POST", params);
  return session.url;
}

export async function getSubscription(id: string) {
  return stripeRequest<Record<string, unknown>>(`/subscriptions/${id}`, "GET");
}

/** Cancel a subscription at the end of the current period (founder override). */
export async function cancelSubscription(id: string) {
  return stripeRequest(`/subscriptions/${id}`, "POST", { cancel_at_period_end: true });
}

export type InvoiceRow = {
  id: string;
  number: string | null;
  created: number;
  total: number; // pence
  currency: string;
  status: string | null;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
};

/** List a customer's invoices (newest first). Returns [] on any error. */
export async function listInvoices(customerId: string, limit = 24): Promise<InvoiceRow[]> {
  if (!process.env.STRIPE_SECRET_KEY) return [];
  try {
    const res = await stripeRequest<{ data: InvoiceRow[] }>("/invoices", "GET", { customer: customerId, limit });
    return res.data ?? [];
  } catch {
    return [];
  }
}

/** Report metered usage to Stripe via the Billing Meters API (per customer). */
export async function reportMeterEvent(eventName: string, customerId: string, value: number) {
  return stripeRequest("/billing/meter_events", "POST", {
    event_name: eventName,
    payload: { stripe_customer_id: customerId, value: String(value) },
  });
}

/** Set the extra-branch licensed quantity on a company's subscription. Adds the
 *  branch line item if needed, removes it when the count drops to zero. No-op if
 *  branch billing isn't configured. Best-effort. */
export async function syncBranchQuantity(subscriptionId: string | null, quantity: number) {
  if (!subscriptionId || !process.env.STRIPE_SECRET_KEY) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = (await getSubscription(subscriptionId)) as any;
  const items = sub?.items?.data ?? [];
  // Match the branch add-on interval to the plan. Detect it from the base
  // plan's recurring interval (robust — no dependency on env price-ID matching).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isYear = items.some((it: any) => it?.price?.recurring?.interval === "year");
  const branchPrice = isYear ? PRICES.branchYear : PRICES.branch;
  if (!branchPrice) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = items.find((it: any) => it?.price?.id === PRICES.branch || it?.price?.id === PRICES.branchYear);

  // If an existing branch item is on the wrong interval (e.g. a £7.50/mo item on
  // a yearly plan), swap it: remove it and re-add at the correct interval price.
  if (existing && existing.price?.id !== branchPrice) {
    await stripeRequest(`/subscription_items/${existing.id}`, "DELETE", { proration_behavior: "create_prorations" });
    if (quantity > 0) {
      await stripeRequest("/subscription_items", "POST", {
        subscription: subscriptionId,
        price: branchPrice,
        quantity,
        proration_behavior: "always_invoice",
      });
    }
    return;
  }

  if (existing) {
    const oldQty = (existing.quantity as number) ?? 0;
    if (quantity === oldQty) return;
    if (quantity > 0) {
      // Increases bill the prorated amount immediately (in advance); decreases
      // credit the unused part against the next invoice.
      const proration = quantity > oldQty ? "always_invoice" : "create_prorations";
      await stripeRequest(`/subscription_items/${existing.id}`, "POST", { quantity, proration_behavior: proration });
    } else {
      // Removed the last extra branch — drop the line item, credit next invoice.
      await stripeRequest(`/subscription_items/${existing.id}`, "DELETE", { proration_behavior: "create_prorations" });
    }
  } else if (quantity > 0) {
    // First extra branch — add the line item and charge immediately.
    await stripeRequest("/subscription_items", "POST", {
      subscription: subscriptionId,
      price: branchPrice,
      quantity,
      proration_behavior: "always_invoice",
    });
  }
}

/** Verify a Stripe webhook signature (t=…,v1=… header) over the raw body. */
export function verifyStripeSignature(rawBody: string, sigHeader: string | null, secret: string): boolean {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(
    sigHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}

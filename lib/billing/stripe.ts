import crypto from "crypto";

const API = "https://api.stripe.com/v1";

export const BASE_URL = "https://www.joincarenow.com";

/** Stripe price IDs (set in Vercel env after creating the products in Stripe). */
export const PRICES = {
  monthly: process.env.STRIPE_PRICE_MONTHLY, // £55 / month recurring
  annual: process.env.STRIPE_PRICE_ANNUAL, // £550 / year recurring
  setup: process.env.STRIPE_PRICE_SETUP, // £150 one-time
  branch: process.env.STRIPE_PRICE_BRANCH, // £7.50 / month recurring (licensed)
  sms: process.env.STRIPE_PRICE_SMS, // 8p metered
  ai: process.env.STRIPE_PRICE_AI, // 10p metered
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

/** Create a Checkout session for the base subscription (+ one-off setup fee on
 *  monthly). Metered SMS/AI items are attached so usage can be reported later. */
export async function createCheckoutSession(opts: {
  customerId: string;
  companyId: string;
  interval: "month" | "year";
}): Promise<string> {
  const basePrice = opts.interval === "year" ? PRICES.annual : PRICES.monthly;
  if (!basePrice) throw new Error("Plan price isn't configured.");

  const lineItems: { price: string; quantity?: number }[] = [{ price: basePrice, quantity: 1 }];
  // Setup fee applies on monthly; waived when committing annually.
  if (opts.interval === "month" && PRICES.setup) lineItems.push({ price: PRICES.setup, quantity: 1 });
  // Metered add-ons (monthly prices). Stripe forbids mixing billing intervals
  // in one subscription, so only attach these to the monthly plan. Annual
  // usage billing is handled separately (see report-usage / follow-up).
  if (opts.interval === "month") {
    if (PRICES.sms) lineItems.push({ price: PRICES.sms });
    if (PRICES.ai) lineItems.push({ price: PRICES.ai });
  }

  // Defensive: Stripe rejects the same recurring price twice. If env vars
  // accidentally reuse a Price ID, keep only the first occurrence.
  const seen = new Set<string>();
  const uniqueItems = lineItems.filter((li) => (seen.has(li.price) ? false : (seen.add(li.price), true)));

  const session = await stripeRequest<{ url: string }>("/checkout/sessions", "POST", {
    mode: "subscription",
    customer: opts.customerId,
    line_items: uniqueItems,
    success_url: `${BASE_URL}/billing?status=success`,
    cancel_url: `${BASE_URL}/billing?status=cancelled`,
    subscription_data: { metadata: { company_id: opts.companyId } },
    metadata: { company_id: opts.companyId },
    allow_promotion_codes: true,
  });
  return session.url;
}

/** Create a Stripe Customer Portal session so the company can manage billing. */
export async function createPortalSession(customerId: string): Promise<string> {
  const session = await stripeRequest<{ url: string }>("/billing_portal/sessions", "POST", {
    customer: customerId,
    return_url: `${BASE_URL}/billing`,
  });
  return session.url;
}

export async function getSubscription(id: string) {
  return stripeRequest<Record<string, unknown>>(`/subscriptions/${id}`, "GET");
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
  if (!subscriptionId || !PRICES.branch || !process.env.STRIPE_SECRET_KEY) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = (await getSubscription(subscriptionId)) as any;
  const items = sub?.items?.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = items.find((it: any) => it?.price?.id === PRICES.branch);
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
      price: PRICES.branch,
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

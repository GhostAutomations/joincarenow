import crypto from "crypto";

const API = "https://api.stripe.com/v1";

export const BASE_URL = "https://www.joincarenow.com";

/** Stripe price IDs (set in Vercel env after creating the products in Stripe). */
export const PRICES = {
  // Tier 1 ("core"). Monthly is used for both cancel-anytime and 12-month commit
  // (same £49 price; the commitment just waives the setup fee).
  monthly: process.env.STRIPE_PRICE_MONTHLY, // £49 / month recurring
  annual: process.env.STRIPE_PRICE_ANNUAL, // £490 / year recurring
  // Tier 2 ("poppy") — includes Poppy. Commit has its own discounted price.
  t2Monthly: process.env.STRIPE_PRICE_T2_MONTHLY, // £89 / month (cancel anytime)
  t2MonthlyCommit: process.env.STRIPE_PRICE_T2_MONTHLY_COMMIT, // £79 / month (12-month)
  t2Annual: process.env.STRIPE_PRICE_T2_ANNUAL, // £790 / year recurring
  setup: process.env.STRIPE_PRICE_SETUP, // £150 one-time (both tiers, monthly non-commit)
  // Poppy applicant overage — 75p metered, 40 included/month handled in-app.
  poppy: process.env.STRIPE_PRICE_POPPY, // 75p metered, monthly
  poppyYear: process.env.STRIPE_PRICE_POPPY_YEAR, // 75p metered, yearly
  // Add-ons come in interval variants so they can attach to either base plan
  // (Stripe forbids mixing intervals within one subscription).
  branch: process.env.STRIPE_PRICE_BRANCH, // £7.50 / month (licensed)
  branchYear: process.env.STRIPE_PRICE_BRANCH_YEAR, // £75 / year (licensed)
  sms: process.env.STRIPE_PRICE_SMS, // 8p metered, monthly
  smsYear: process.env.STRIPE_PRICE_SMS_YEAR, // 8p metered, yearly
  ai: process.env.STRIPE_PRICE_AI, // 10p metered, monthly
  aiYear: process.env.STRIPE_PRICE_AI_YEAR, // 10p metered, yearly
};

/** The base recurring price for a (tier, interval, commit) combination. */
export function basePriceFor(
  tier: "core" | "poppy",
  interval: "month" | "year",
  committed: boolean
): string | undefined {
  if (tier === "poppy") {
    if (interval === "year") return PRICES.t2Annual;
    return committed ? PRICES.t2MonthlyCommit : PRICES.t2Monthly;
  }
  return interval === "year" ? PRICES.annual : PRICES.monthly;
}

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
  tier?: "core" | "poppy"; // Tier 2 ("poppy") includes Poppy
  interval: "month" | "year";
  commit?: boolean; // monthly with a 12-month commitment (no setup fee)
  meteredOnly?: boolean; // Diamond: no base/setup, only metered SMS + AI
  concession?: { freeMonths?: number; customMonthlyPence?: number } | null;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<string> {
  const tier = opts.tier ?? "core";
  const committed = opts.interval === "month" && opts.commit === true;
  const lineItems: Record<string, unknown>[] = [];

  // Diamond skips the base plan and set-up fee entirely — the subscription is
  // just the metered SMS/AI items, so the customer pays only for usage.
  if (!opts.meteredOnly) {
    const basePrice = basePriceFor(tier, opts.interval, committed);
    if (!basePrice) throw new Error("Plan price isn't configured.");
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
    lineItems.push(baseItem);
    // Setup fee applies on monthly, but is waived for annual and the commitment.
    if (opts.interval === "month" && !committed && PRICES.setup) lineItems.push({ price: PRICES.setup, quantity: 1 });
  }
  // Metered add-ons must match the base interval (Stripe forbids mixing).
  const isYear = opts.interval === "year";
  const smsPrice = isYear ? PRICES.smsYear : PRICES.sms;
  const aiPrice = isYear ? PRICES.aiYear : PRICES.ai;
  if (smsPrice) lineItems.push({ price: smsPrice });
  if (aiPrice) lineItems.push({ price: aiPrice });
  // Tier 2 attaches the Poppy applicant overage meter (75p; first 40/month are
  // included and suppressed in-app). Never on Diamond (metered-only).
  if (tier === "poppy" && !opts.meteredOnly) {
    const poppyPrice = isYear ? PRICES.poppyYear : PRICES.poppy;
    if (poppyPrice) lineItems.push({ price: poppyPrice });
  }

  // Defensive: Stripe rejects the same recurring price twice.
  const seen = new Set<string>();
  const uniqueItems = lineItems.filter((li) => {
    const p = li.price as string | undefined;
    if (!p) return true; // price_data items are always unique
    return seen.has(p) ? false : (seen.add(p), true);
  });

  // Free-months concession → a discount coupon. (Can't combine with promo codes.)
  // Not applicable to Diamond (there's no base fee to discount).
  const coupon = opts.meteredOnly ? undefined : await concessionCoupon(opts.interval, opts.concession?.freeMonths);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pmId(v: any): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : ((v.id as string) ?? null);
}

/** Find a usable saved payment method for off-session charges. Order of trust:
 *  (1) the customer's invoice-settings default; (2) the payment method the
 *  customer's active subscription is billed on (the card Stripe already charges
 *  successfully — works even when it's a Link-wrapped card); (3) any attached
 *  payment method of any type. The subscription card is the reliable source
 *  because cards added during Checkout attach to the subscription, not always
 *  to the customer as a plain `card` type. */
async function resolveDefaultPaymentMethod(customerId: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cust = (await stripeRequest(`/customers/${customerId}`, "GET")) as any;
    const di = pmId(cust?.invoice_settings?.default_payment_method);
    if (di) return di;
  } catch {
    /* fall through */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subs = (await stripeRequest("/subscriptions", "GET", {
      customer: customerId,
      status: "active",
      limit: 1,
      "expand[]": "data.default_payment_method",
    })) as any;
    const sub = subs?.data?.[0];
    const fromSub = pmId(sub?.default_payment_method);
    if (fromSub) return fromSub;
  } catch {
    /* fall through */
  }
  try {
    // Newer endpoint returns ALL attached payment-method types (card, link, …).
    const pms = await stripeRequest<{ data: { id: string }[] }>(
      `/customers/${customerId}/payment_methods`,
      "GET",
      { limit: 1 }
    );
    return pms.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Charge a one-off amount to a customer's saved card immediately (off-session).
 *  Used for Form Store purchases. Resolves the saved card explicitly, creates an
 *  isolated draft invoice (so it can't sweep up unrelated pending items), pays it
 *  with that card, and voids it if the payment fails so nothing is left to charge
 *  later. Throws if it can't settle, so the caller never grants a purchase unpaid.
 *  Returns the paid invoice id. */
export async function chargeOneOff(
  customerId: string,
  amountPence: number,
  description: string
): Promise<{ invoiceId: string }> {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Billing isn't configured.");
  if (!Number.isInteger(amountPence) || amountPence <= 0) throw new Error("Invalid amount.");

  const paymentMethod = await resolveDefaultPaymentMethod(customerId);
  if (!paymentMethod) {
    throw new Error("No saved card on file. Add a card under Manage billing, then try again.");
  }

  // Draft invoice first, pinned to the resolved card, so the invoice item below
  // attaches only to this one.
  const inv = await stripeRequest<{ id: string }>("/invoices", "POST", {
    customer: customerId,
    collection_method: "charge_automatically",
    auto_advance: false,
    default_payment_method: paymentMethod,
    "metadata[kind]": "form_purchase",
  });
  await stripeRequest("/invoiceitems", "POST", {
    customer: customerId,
    invoice: inv.id,
    amount: amountPence,
    currency: "gbp",
    description,
  });
  await stripeRequest(`/invoices/${inv.id}/finalize`, "POST", {});

  const voidInvoice = async () => {
    try {
      await stripeRequest(`/invoices/${inv.id}/void`, "POST", {});
    } catch {
      /* best-effort cleanup */
    }
  };

  let paid: { id: string; status: string };
  try {
    paid = await stripeRequest<{ id: string; status: string }>(`/invoices/${inv.id}/pay`, "POST", {
      off_session: true,
      payment_method: paymentMethod,
    });
  } catch (e) {
    await voidInvoice();
    throw e;
  }
  if (paid.status !== "paid") {
    await voidInvoice();
    throw new Error("The payment could not be completed.");
  }
  return { invoiceId: inv.id };
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

/** Swap a subscription's base plan price (e.g. the £55→£49 change) with no
 *  mid-cycle proration — they simply pay the new price from the next invoice.
 *  Finds the flat licensed base item, excluding the branch add-on and any metered
 *  item. No-op if already on newPrice or no base item is found. */
export async function swapSubscriptionBasePrice(
  subscriptionId: string,
  newPrice: string
): Promise<{ changed: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = (await getSubscription(subscriptionId)) as any;
  const items = sub?.items?.data ?? [];
  const branchIds = [PRICES.branch, PRICES.branchYear].filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = items.find(
    (it: any) => it?.price?.recurring?.usage_type !== "metered" && !branchIds.includes(it?.price?.id)
  );
  if (!base) return { changed: false };
  if (base.price?.id === newPrice) return { changed: false };
  await stripeRequest(`/subscription_items/${base.id}`, "POST", { price: newPrice, proration_behavior: "none" });
  return { changed: true };
}

/** Move an ACTIVE subscription between tiers: swap the base price and add/remove
 *  the Poppy applicant meter to match. Base swap prorates the difference onto the
 *  next invoice. No-op branches are skipped. `committed` picks the Tier 2 12-month
 *  price where relevant. */
export async function setSubscriptionTier(
  subscriptionId: string,
  tier: "core" | "poppy",
  committed = false
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = (await getSubscription(subscriptionId)) as any;
  const items = sub?.items?.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isYear = items.some((it: any) => it?.price?.recurring?.interval === "year");
  const interval = isYear ? "year" : "month";
  const branchIds = [PRICES.branch, PRICES.branchYear].filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = items.find(
    (it: any) => it?.price?.recurring?.usage_type !== "metered" && !branchIds.includes(it?.price?.id)
  );
  const newBase = basePriceFor(tier, interval, committed);
  if (base && newBase && base.price?.id !== newBase) {
    await stripeRequest(`/subscription_items/${base.id}`, "POST", { price: newBase, proration_behavior: "create_prorations" });
  }

  const poppyPrice = isYear ? PRICES.poppyYear : PRICES.poppy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingPoppy = items.find((it: any) => it?.price?.id === PRICES.poppy || it?.price?.id === PRICES.poppyYear);
  if (tier === "poppy" && poppyPrice && !existingPoppy) {
    await stripeRequest("/subscription_items", "POST", { subscription: subscriptionId, price: poppyPrice });
  } else if (tier === "core" && existingPoppy) {
    await stripeRequest(`/subscription_items/${existingPoppy.id}`, "DELETE", {});
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

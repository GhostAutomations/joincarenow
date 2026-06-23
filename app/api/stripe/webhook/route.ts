import { createAdminClient } from "@/lib/supabase/admin";
import { verifyStripeSignature } from "@/lib/billing/stripe";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { syncExtraBranches } from "@/lib/billing/branches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });

export async function GET() {
  return new Response(JSON.stringify({ ok: true, route: "stripe-webhook", expects: "POST" }), {
    headers: { "Content-Type": "application/json" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function periodEnd(sub: any): string | null {
  const t = sub?.current_period_end;
  return typeof t === "number" ? new Date(t * 1000).toISOString() : null;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await req.text();
  if (secret && !verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) {
    return new Response("Invalid signature", { status: 403 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return ok();
  }

  const db = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj = (event.data?.object ?? {}) as any;
  const companyId: string | undefined = obj?.metadata?.company_id;

  const findCompany = async (): Promise<string | null> => {
    if (companyId) return companyId;
    const customer = obj?.customer as string | undefined;
    if (!customer) return null;
    const { data } = await db.from("companies").select("id").eq("stripe_customer_id", customer).maybeSingle();
    return (data?.id as string) ?? null;
  };

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const id = await findCompany();
      if (id) {
        const status = obj.status as string; // active, past_due, canceled, etc.
        const interval = obj?.items?.data?.[0]?.price?.recurring?.interval as string | undefined;
        await db
          .from("companies")
          .update({
            stripe_subscription_id: obj.id as string,
            billing_status: event.type === "customer.subscription.deleted" ? "canceled" : status,
            billing_interval: interval === "year" || interval === "month" ? interval : null,
            current_period_end: periodEnd(obj),
            setup_fee_paid: interval === "year" ? true : undefined,
          })
          .eq("id", id);
      }
      break;
    }
    case "checkout.session.completed": {
      const id = await findCompany();
      if (id && obj.subscription) {
        await db
          .from("companies")
          .update({ stripe_subscription_id: obj.subscription as string, billing_status: "active", setup_fee_paid: true })
          .eq("id", id);

        // Reconcile existing branches onto the new subscription (interval-matched).
        await syncExtraBranches(id);

        // Branded "subscription confirmed" email (JCN-branded platform email).
        const to = (obj.customer_details?.email as string) ?? null;
        if (to) {
          const { data: co } = await db.from("companies").select("name").eq("id", id).single();
          const name = (co?.name as string) ?? "there";
          await sendBrandedEmail(db, null, {
            to,
            subject: "Your Join Care Now subscription is active",
            text:
              `Hi ${name},\n\n` +
              `Thanks for subscribing to Join Care Now — your subscription is now active and your account is ready to use.\n\n` +
              `You can manage your plan, payment method and invoices any time from the Billing area in your dashboard.\n\n` +
              `If you have any questions, just reply to this email and we'll be glad to help.\n\n` +
              `The Join Care Now team`,
            cta: { label: "Go to Billing", url: "https://www.joincarenow.com/billing" },
            footerNote: "You're receiving this because you started a subscription on joincarenow.com.",
          });
        }
      }
      break;
    }
    case "invoice.payment_failed": {
      const id = await findCompany();
      if (id) await db.from("companies").update({ billing_status: "past_due" }).eq("id", id);
      break;
    }
    default:
      break;
  }

  return ok();
}

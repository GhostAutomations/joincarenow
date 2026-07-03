import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { StoreBrowser, type StoreCard } from "@/components/dashboard/store-browser";

type StoreForm = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_pence: number | null;
  form_fields: { count: number }[] | null;
};

export default async function StorePage() {
  const { supabase, current } = await requireCompany();
  // File Store purchases affect billing — admin-only.
  if (current.role !== "admin") redirect("/dashboard");
  const isAdmin = true;

  const [{ data: company }, { data: forms }, { data: mine }] = await Promise.all([
    supabase
      .from("companies")
      .select("billing_status, billing_comped, stripe_customer_id")
      .eq("id", current.company_id)
      .single(),
    supabase
      .from("forms")
      .select("id, name, description, category, price_pence, form_fields(count)")
      .eq("is_store", true)
      .eq("store_published", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("forms")
      .select("source_form_id")
      .eq("company_id", current.company_id)
      .not("source_form_id", "is", null),
  ]);

  const acquiredIds = new Set(
    (mine ?? []).map((m) => m.source_form_id as string).filter(Boolean)
  );

  const comped = company?.billing_comped === true;
  const status = (company?.billing_status as string) ?? "none";
  const billingReady =
    comped || ((status === "active" || status === "trialing") && !!company?.stripe_customer_id);

  const list = (forms ?? []) as unknown as StoreForm[];
  const cards: StoreCard[] = list.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    category: f.category,
    pricePence: f.price_pence ?? 0,
    fieldCount: f.form_fields?.[0]?.count ?? 0,
    acquired: acquiredIds.has(f.id),
  }));

  return (
    <div>
      <PageHeader
        title="File Store"
        subtitle="Ready-made forms. Preview, add to your Forms, or customise before adding."
      />

      <div className="mt-6">
        {cards.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            No store forms available yet.
          </div>
        ) : (
          <StoreBrowser forms={cards} isAdmin={isAdmin} billingReady={billingReady} comped={comped} />
        )}
      </div>
    </div>
  );
}

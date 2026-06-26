import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { signOut } from "@/modules/auth/actions";

/** Holding screen for a customer whose billing is done but whose account the
 *  founder is still setting up. They land here until the founder presses "Mark
 *  setup complete", which flips settings.setup_complete and emails them. Outside
 *  the dashboard layout + allowSetup so the gate can't loop. */
export default async function FinishingPage() {
  const ctx = await requireCompany({ allowSetup: true });
  const acting = "acting" in ctx && ctx.acting === true;
  if (acting || ctx.profile?.is_platform_admin) redirect("/dashboard");

  const { data: co } = await ctx.supabase
    .from("companies")
    .select("name, settings")
    .eq("id", ctx.current.company_id)
    .single();
  const setupComplete = (co?.settings as { setup_complete?: boolean } | null)?.setup_complete;
  if (setupComplete !== false) redirect("/dashboard");

  const name = (co?.name as string) ?? "your account";

  return (
    <main className="min-h-screen jcn-app-bg">
      <header className="flex h-14 items-center justify-between border-b border-white/20 bg-white/10 px-6 backdrop-blur">
        <span className="text-base font-bold text-white drop-shadow-sm">Join Care Now</span>
        <form action={signOut}>
          <button className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20">
            Sign out
          </button>
        </form>
      </header>
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl">🛠️</div>
          <h1 className="mt-4 text-xl font-semibold text-gray-900">We&apos;re finishing your account</h1>
          <p className="mt-2 text-sm text-gray-600">
            Thanks — your subscription is all set. We&apos;re now putting the finishing touches to{" "}
            <span className="font-medium">{name}</span>: your roles, workflows, forms and branding.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            We&apos;ll email you the moment it&apos;s ready and you can log straight in with full access.
            You can safely close this tab.
          </p>
        </div>
      </div>
    </main>
  );
}

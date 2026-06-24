// One-off diagnostic: is the Won auto-provisioning wired up on the LIVE db?
// Run on your Mac (it can reach Supabase):  node scripts/diag-provision.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const slug = "diag-probe-" + Date.now();
const rpc = await db.rpc("provision_prospect_company", { p_name: "Diag Probe Co", p_slug: slug, p_admin_email: null });
if (rpc.error) {
  console.log("❌ provision_prospect_company RPC:", rpc.error.message, "(code " + rpc.error.code + ")");
  console.log("   → migration 0107 is NOT applied. Run `ship` (or npx supabase db push), then re-run this.");
} else {
  console.log("✅ provision_prospect_company RPC works → created company:", JSON.stringify(rpc.data));
  if (rpc.data?.company_id) { await db.from("companies").delete().eq("id", rpc.data.company_id); console.log("   (probe company cleaned up)"); }
}

const { data: pros } = await db.from("prospect_companies")
  .select("name, stage, proposal_response, provisioned_company_id").order("updated_at", { ascending: false }).limit(8);
console.log("\nRecent prospects:"); console.table(pros);
const { data: comps } = await db.from("companies").select("name, slug, created_at").order("created_at", { ascending: false }).limit(6);
console.log("Recent companies:"); console.table(comps);
const { data: inv } = await db.from("invitations").select("email, status, created_at").order("created_at", { ascending: false }).limit(6);
console.log("Recent invitations:"); console.table(inv);

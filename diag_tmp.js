const fs=require("fs");
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")];}));
const {createClient}=require("@supabase/supabase-js");
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const rpc=await db.rpc("provision_prospect_company",{p_name:"__diag_probe__",p_slug:"__diag_probe_"+Date.now(),p_admin_email:null});
  console.log("RPC provision_prospect_company:", rpc.error? ("MISSING/ERROR -> "+rpc.error.message+" (code "+rpc.error.code+")") : ("EXISTS -> "+JSON.stringify(rpc.data)));
  if(rpc.data&&rpc.data.company_id){ await db.from("companies").delete().eq("id",rpc.data.company_id); console.log("  (probe company cleaned up)"); }
  const {data:pros}=await db.from("prospect_companies").select("name,stage,proposal_response,provisioned_company_id").order("updated_at",{ascending:false}).limit(8);
  console.log("\nRecent prospects:"); console.table(pros);
  const {data:comps}=await db.from("companies").select("name,slug,created_at").order("created_at",{ascending:false}).limit(6);
  console.log("Recent companies:"); console.table(comps);
})().catch(e=>console.error("FATAL",e.message));

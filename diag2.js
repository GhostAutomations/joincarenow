const fs=require("fs");
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")];}));
const {createClient}=require("@supabase/supabase-js");
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
(async()=>{
  const colTest=await db.from("companies").select("agreed_plan, sms_bonus").limit(1);
  console.log("0108/0109 columns present?:", colTest.error? ("NO -> "+colTest.error.message):"YES");
  const agTest=await db.from("company_agreements").select("id").limit(1);
  console.log("company_agreements table present?:", agTest.error? ("NO -> "+agTest.error.message):"YES");
  const {data:pros}=await db.from("prospect_companies").select("id,name,stage,proposal_response,provisioned_company_id").order("updated_at",{ascending:false}).limit(5);
  console.log("\nRecent prospects:"); console.table(pros);
  if(pros&&pros[0]){
    const {data:acts}=await db.from("prospect_activities").select("type,body,created_at").eq("prospect_company_id",pros[0].id).order("created_at",{ascending:false}).limit(8);
    console.log("Timeline of latest prospect ("+pros[0].name+"):"); console.table(acts);
  }
})().catch(e=>console.error("FATAL",e.message));

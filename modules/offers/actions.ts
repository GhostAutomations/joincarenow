"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { notifyApplicant } from "@/modules/comms/actions";
import { renderMergeFields } from "@/lib/comms/send";
import { formatSalary } from "@/lib/utils";

const BASE_URL = "https://www.joincarenow.com";

/** A contract/policy ready to display + sign, with merge fields already filled. */
export type SignableDoc = {
  docType: "contract" | "policy";
  sourceId: string | null;
  title: string;
  body: string;
  version: number | null;
  signatureMethod: "type" | "draw";
};

export type OfferInfo = {
  id: string;
  role: string | null;
  startDate: string | null;
  pay: string | null;
  hours: string | null;
  employmentType: string | null;
  conditional: boolean;
  conditions: string | null;
  message: string | null;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
  declineReason: string | null;
  talentPool: boolean;
  talentPoolConsentAt: string | null;
};

/** Latest offer for an application (for the pipeline panel). */
export async function getOffer(applicationId: string): Promise<OfferInfo | null> {
  const { supabase, current } = await requireCompany();
  const { data } = await supabase
    .from("offers")
    .select("id, role, start_date, pay, hours, employment_type, conditional, conditions, message, status, sent_at, responded_at, decline_reason, applicant_id")
    .eq("application_id", applicationId)
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  // Talent-pool consent lives on the applicant.
  let talentPool = false;
  let talentPoolConsentAt: string | null = null;
  if (data.applicant_id) {
    const { data: appl } = await supabase
      .from("applicants")
      .select("talent_pool, talent_pool_consent_at")
      .eq("id", data.applicant_id as string)
      .maybeSingle();
    talentPool = !!appl?.talent_pool;
    talentPoolConsentAt = (appl?.talent_pool_consent_at as string) ?? null;
  }

  return {
    id: data.id as string,
    role: (data.role as string) ?? null,
    startDate: (data.start_date as string) ?? null,
    pay: (data.pay as string) ?? null,
    hours: (data.hours as string) ?? null,
    employmentType: (data.employment_type as string) ?? null,
    conditional: !!data.conditional,
    conditions: (data.conditions as string) ?? null,
    message: (data.message as string) ?? null,
    status: data.status as string,
    sentAt: (data.sent_at as string) ?? null,
    respondedAt: (data.responded_at as string) ?? null,
    declineReason: (data.decline_reason as string) ?? null,
    talentPool,
    talentPoolConsentAt,
  };
}

export type OfferDocOptions = {
  contracts: { id: string; name: string }[];
  policies: { id: string; name: string }[];
  contractId: string | null;
  policyIds: string[];
  managers: { id: string; name: string }[];
  managerId: string | null;
};

/** Contract/policy options for the offer popup: the company's available docs,
 *  plus the defaults to pre-select (a previous offer's set if reissuing, else the
 *  job's assigned set). */
export async function getOfferDocOptions(applicationId: string): Promise<OfferDocOptions> {
  const { supabase, current } = await requireCompany();

  const [{ data: contracts }, { data: policies }, { data: app }, { data: staffRaw }] = await Promise.all([
    supabase.from("contract_templates").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase.from("policy_documents").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase.from("applications").select("job_id").eq("id", applicationId).eq("company_id", current.company_id).maybeSingle(),
    supabase
      .from("company_users")
      .select("user_id, role, profiles ( full_name, email )")
      .eq("company_id", current.company_id)
      .in("role", ["admin", "manager"]),
  ]);

  const managers = (staffRaw ?? []).map((m) => {
    const p = m.profiles as unknown as { full_name: string | null; email: string } | null;
    return { id: m.user_id as string, name: p?.full_name || p?.email || "Team member" };
  });

  // Default from the job's assigned contract + policies.
  let contractId: string | null = null;
  let policyIds: string[] = [];
  if (app?.job_id) {
    const [{ data: job }, { data: jp }] = await Promise.all([
      supabase.from("jobs").select("contract_template_id").eq("id", app.job_id).maybeSingle(),
      supabase.from("job_policies").select("policy_id").eq("job_id", app.job_id),
    ]);
    contractId = (job?.contract_template_id as string) ?? null;
    policyIds = (jp ?? []).map((r) => r.policy_id as string);
  }

  return {
    contracts: (contracts ?? []) as { id: string; name: string }[],
    policies: (policies ?? []) as { id: string; name: string }[],
    contractId,
    policyIds,
    managers,
    managerId: null,
  };
}

/** Create + send an offer. Emails the applicant a secure accept/decline link and
 *  logs it to their Conversation. */
export async function sendOffer(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const applicationId = formData.get("applicationId")?.toString();
  const role = formData.get("role")?.toString().trim() || null;
  const startDate = formData.get("startDate")?.toString() || null;
  const pay = formData.get("pay")?.toString().trim() || null;
  const hours = formData.get("hours")?.toString().trim() || null;
  const employmentTypeRaw = formData.get("employment_type")?.toString() || "";
  const employmentType = ["full_time", "part_time", "student_20"].includes(employmentTypeRaw) ? employmentTypeRaw : null;
  const conditional = formData.get("conditional") === "on";
  const conditions = formData.get("conditions")?.toString().trim() || null;
  const message = formData.get("message")?.toString().trim() || null;
  if (!applicationId) return { error: "Missing application" };

  const { supabase, user, current } = await requireCompany();

  const { data: app } = await supabase
    .from("applications")
    .select("applicant_id, job_id")
    .eq("id", applicationId)
    .eq("company_id", current.company_id)
    .single();
  if (!app?.applicant_id) return { error: "Application not found" };

  // Contract + policies to attach for signing — taken from the offer popup
  // (which pre-selects the job's set but lets the recruiter adjust).
  const contractTemplateId = formData.get("contract_template_id")?.toString() || null;
  const policyIds = formData.getAll("policy_ids").map(String).filter(Boolean);
  const managerId = formData.get("manager_id")?.toString() || null;

  const { data: offer, error } = await supabase
    .from("offers")
    .insert({
      company_id: current.company_id,
      application_id: applicationId,
      applicant_id: app.applicant_id,
      role,
      start_date: startDate,
      pay,
      hours,
      employment_type: employmentType,
      conditional,
      conditions,
      message,
      contract_template_id: contractTemplateId,
      manager_id: managerId,
      status: "sent",
      created_by: user.id,
    })
    .select("id, token")
    .single();
  if (error || !offer) return { error: "Could not create the offer. Please try again." };

  if (policyIds.length > 0) {
    await supabase
      .from("offer_policies")
      .insert(policyIds.map((policy_id) => ({ offer_id: offer.id, policy_id })));
  }

  // Email the applicant via the shared notify path (builds merge context + logs
  // to Conversation), with merge tokens for name/company/role.
  const link = `${BASE_URL}/offer/${offer.token}`;
  const body = [
    "Hi {{first_name}},",
    "",
    `{{company_name}} is delighted to offer you the ${role || "{{job_title}}"}${
      conditional ? " (conditional offer)" : ""
    }.`,
    startDate ? `Start date: ${new Date(startDate).toLocaleDateString("en-GB")}` : "",
    pay ? `Pay: ${formatSalary(pay)}` : "",
    hours ? `Hours: ${hours}` : "",
    conditional && conditions ? `Conditions: ${conditions}` : "",
    message ? `\n${message}` : "",
    "",
    "Use the button below to review and accept or decline your offer. You can also do this any time from your applicant portal.",
    "",
    "Thank you,",
    "{{company_name}}",
  ]
    .filter((l) => l !== "")
    .join("\n");

  await notifyApplicant({
    applicationId,
    channel: "email",
    subject: "Job offer from {{company_name}}",
    body,
    cta: { label: "Review your offer", url: link },
  });

  revalidatePath("/pipeline");
  return { ok: true };
}

/** Public (applicant, no login): accept or decline an offer by token. On a
 *  decline the applicant may optionally give a reason and opt in to the talent pool. */
export async function respondToOffer(
  token: string,
  response: "accepted" | "declined",
  opts?: { reason?: string; talentPool?: boolean }
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_offer_by_token", {
    p_token: token,
    p_response: response,
    p_reason: opts?.reason ?? null,
    p_talent_pool: opts?.talentPool ?? false,
  });
  if (error) return { error: error.message || "Could not record your response." };
  return { ok: true };
}

/** Build the merge context + render a doc body for an offer's token row. */
function mergeContextFromOfferRow(row: Record<string, unknown>): Record<string, string> {
  const startDate = row.start_date as string | null;
  return {
    first_name: (row.first_name as string) ?? "",
    last_name: (row.last_name as string) ?? "",
    job_title: (row.job_title as string) ?? "",
    role: (row.role as string) ?? (row.job_title as string) ?? "",
    pay: formatSalary(row.pay as string),
    hours: (row.hours as string) ?? "",
    start_date: startDate ? new Date(startDate).toLocaleDateString("en-GB") : "",
    company_name: (row.company_name as string) ?? "",
    conditions: (row.conditions as string) ?? "",
  };
}

/** Public (no login): the contract + policies attached to an offer, with merge
 *  fields filled in, ready to display and sign. */
export async function loadSignableDocs(token: string): Promise<SignableDoc[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_offer_by_token", { p_token: token });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) return [];

  const ctx = mergeContextFromOfferRow(row);
  const docs: SignableDoc[] = [];

  if (row.contract_id && row.contract_body) {
    docs.push({
      docType: "contract",
      sourceId: row.contract_id as string,
      title: (row.contract_name as string) ?? "Employment contract",
      body: renderMergeFields(row.contract_body as string, ctx),
      version: (row.contract_version as number) ?? null,
      signatureMethod: (row.contract_sig_method as string) === "draw" ? "draw" : "type",
    });
  }

  const policies =
    (row.policies as { id: string; name: string; body: string; version: number; signature_method?: string }[] | null) ?? [];
  for (const p of policies) {
    docs.push({
      docType: "policy",
      sourceId: p.id,
      title: p.name,
      body: renderMergeFields(p.body ?? "", ctx),
      version: p.version ?? null,
      signatureMethod: p.signature_method === "draw" ? "draw" : "type",
    });
  }
  return docs;
}

/** A signature captured per document (aligned by index with loadSignableDocs). */
export type DocSignature = { name: string; image: string | null };

/** Public (no login): accept an offer by signing the attached documents. Records
 *  an immutable snapshot of exactly what was agreed, then completes the hire.
 *  `signatures` aligns by index with loadSignableDocs(token). */
export async function signAndAcceptOffer(
  token: string,
  signatures: DocSignature[]
): Promise<{ ok?: boolean; error?: string }> {
  // Re-render the docs server-side (don't trust client-sent text) for the snapshot.
  const docs = await loadSignableDocs(token);
  if (docs.length === 0) return { error: "There are no documents to sign on this offer." };
  if (signatures.length !== docs.length) return { error: "Please sign every document." };

  const payload = docs.map((d, i) => {
    const sig = signatures[i] ?? { name: "", image: null };
    const name = (sig.name ?? "").trim();
    return {
      doc_type: d.docType,
      source_id: d.sourceId,
      title: d.title,
      body: d.body,
      version: d.version,
      signature_method: d.signatureMethod,
      signer_name: name,
      signature_image: d.signatureMethod === "draw" ? sig.image ?? "" : "",
    };
  });

  // Validate: typed docs need a name; drawn docs need an image.
  for (let i = 0; i < docs.length; i++) {
    const p = payload[i];
    if (docs[i].signatureMethod === "draw" && !p.signature_image) {
      return { error: `Please draw your signature on "${docs[i].title}".` };
    }
    if (!p.signer_name || p.signer_name.length < 2) {
      return { error: `Please sign "${docs[i].title}".` };
    }
  }

  const firstName = payload[0]?.signer_name ?? "Signed";

  let ip: string | null = null;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  } catch {
    ip = null;
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("sign_and_accept_offer", {
    p_token: token,
    p_signer_name: firstName,
    p_docs: payload,
    p_ip: ip,
  });
  if (error) return { error: error.message || "Could not record your signature." };
  return { ok: true };
}

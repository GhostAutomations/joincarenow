import type { SupabaseClient } from "@supabase/supabase-js";
import { buildIcs, calendarLinks, type CalEvent } from "@/lib/calendar/ics";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { autoStage } from "@/lib/prospects/auto-stage";

/** Book a demo with a prospect contact: store it, email a branded calendar
 *  invite (.ics) with the video link, log it, and move the card to Demo booked. */
export async function scheduleProspectDemo(
  db: SupabaseClient,
  opts: { prospectId: string; contactId: string; startIso: string; durationMinutes: number }
): Promise<{ ok?: boolean; error?: string }> {
  const { prospectId, contactId, startIso, durationMinutes } = opts;

  const startMs = Date.parse(startIso);
  if (Number.isNaN(startMs)) return { error: "That date/time looks invalid." };
  if (startMs <= Date.now()) return { error: "Pick a time in the future." };
  const endIso = new Date(startMs + durationMinutes * 60000).toISOString();

  const [{ data: company }, { data: contact }, { data: vlRow }, { data: clashes }] = await Promise.all([
    db.from("prospect_companies").select("name").eq("id", prospectId).single(),
    db.from("prospect_contacts").select("name, email").eq("id", contactId).single(),
    db.from("platform_settings").select("value").eq("key", "prospect_video_link").maybeSingle(),
    // Overlap: an existing demo that starts before this ends and ends after this starts.
    db.from("prospect_companies")
      .select("name, demo_at")
      .neq("id", prospectId)
      .not("demo_at", "is", null)
      .lt("demo_at", endIso)
      .gt("demo_end_at", startIso)
      .limit(1),
  ]);
  if (!contact?.email) return { error: "That contact has no email address." };
  if (clashes && clashes.length > 0) {
    const clashWhen = new Date(clashes[0].demo_at as string).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    return { error: `That time clashes with a demo for ${clashes[0].name} (${clashWhen}). Pick another slot.` };
  }

  const videoLink = ((vlRow?.value as string) || "").trim();
  const companyName = (company?.name as string) ?? "your team";
  const firstName = ((contact.name as string) ?? "").split(" ")[0] || "there";
  const when = new Date(startIso).toLocaleString("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  const event: CalEvent = {
    uid: `demo-${prospectId}-${Date.now()}`,
    title: `Join Care Now demo — ${companyName}`,
    startIso,
    durationMinutes,
    description: `A quick demo of Join Care Now.${videoLink ? `\nJoin here: ${videoLink}` : ""}`,
    location: videoLink || "Online",
  };
  const ics = Buffer.from(buildIcs(event)).toString("base64");
  const links = calendarLinks(event);

  const body =
    `Hi ${firstName},\n\n` +
    `Thanks for your time — your Join Care Now demo is booked for ${when} (${durationMinutes} minutes).\n\n` +
    (videoLink ? `Join the call here: ${videoLink}\n\n` : "") +
    `Add it to your calendar:\nGoogle: ${links.google}\nOutlook: ${links.outlook}\n\n` +
    `Looking forward to showing you around.\n\nThe Join Care Now team`;

  const res = await sendBrandedEmail(db, null, {
    to: contact.email as string,
    subject: `Your Join Care Now demo — ${when}`,
    text: body,
    cta: videoLink ? { label: "Join the demo", url: videoLink } : undefined,
    attachments: [{ filename: "demo.ics", content: ics }],
  });

  await db.from("prospect_companies").update({ demo_at: startIso, demo_end_at: endIso, demo_contact_id: contactId }).eq("id", prospectId);
  await db.from("prospect_activities").insert({
    prospect_company_id: prospectId,
    contact_id: contactId,
    type: "system",
    body: `Demo booked for ${when}${videoLink ? " (video invite sent)" : ""}.`,
    meta: { demo_at: startIso },
  });
  await autoStage(db, prospectId, "demo");

  if (!res.ok) return { error: res.error ?? "Demo saved, but the invite email didn't send." };
  return { ok: true };
}

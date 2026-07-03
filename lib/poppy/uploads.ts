import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export type PoppyAttachment = { name: string; base64: string; mediaType: string };

/** Media type Claude accepts for an uploaded file, or null if unsupported. */
function mediaTypeFor(path: string): string | null {
  const p = path.toLowerCase();
  if (p.endsWith(".pdf")) return "application/pdf";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  return null;
}

/**
 * Download the applicant's uploaded documents for the given kinds (e.g. 'dbs',
 * 'proof_of_address') so Poppy can review them. Matches by the document task's
 * doc_kind and only returns files Claude can read (PDF / image). CV is handled
 * separately via the application's cv_path.
 */
export async function gatherPoppyUploads(
  db: Admin,
  applicationId: string,
  kinds: string[] | null | undefined,
  limit = 6
): Promise<PoppyAttachment[]> {
  const wanted = (kinds ?? []).filter((k) => k && k !== "cv");
  if (wanted.length === 0) return [];

  const { data: tasks } = await db
    .from("onboarding_tasks")
    .select("doc_kind, doc_path, doc_path_back, title")
    .eq("application_id", applicationId)
    .in("doc_kind", wanted)
    .not("doc_path", "is", null);

  const out: PoppyAttachment[] = [];
  const add = async (path: string | null, label: string) => {
    if (!path || out.length >= limit) return;
    const mediaType = mediaTypeFor(path);
    if (!mediaType) return; // unsupported file type — skip
    try {
      const { data: blob } = await db.storage.from("applications").download(path);
      if (!blob) return;
      const base64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      out.push({ name: label, base64, mediaType });
    } catch {
      /* skip unreadable file */
    }
  };
  for (const t of tasks ?? []) {
    if (out.length >= limit) break;
    const name = (t.title as string) ?? (t.doc_kind as string) ?? "Document";
    await add(t.doc_path as string | null, name);
    await add(t.doc_path_back as string | null, `${name} (back)`);
  }
  return out;
}

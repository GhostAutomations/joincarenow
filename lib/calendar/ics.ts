// Build calendar artefacts for an event: an .ics file (universal — Apple/Outlook
// desktop/Google import) and one-click "add to calendar" web links.

export type CalEvent = {
  uid: string;
  title: string;
  startIso: string; // UTC ISO, e.g. 2026-07-01T09:00:00Z
  durationMinutes: number;
  description?: string;
  location?: string;
};

/** YYYYMMDDTHHMMSSZ (UTC basic) from an ISO string. */
function toBasicUtc(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function endIso(ev: CalEvent): string {
  return new Date(new Date(ev.startIso).getTime() + ev.durationMinutes * 60000).toISOString();
}

/** Escape text for an ICS field (commas, semicolons, backslashes, newlines). */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** A valid .ics calendar file for the event. */
export function buildIcs(ev: CalEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Join Care Now//Interviews//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@joincarenow.com`,
    `DTSTAMP:${toBasicUtc(new Date().toISOString())}`,
    `DTSTART:${toBasicUtc(ev.startIso)}`,
    `DTEND:${toBasicUtc(endIso(ev))}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.description ? `DESCRIPTION:${esc(ev.description)}` : "",
    ev.location ? `LOCATION:${esc(ev.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

/** One-click add-to-calendar web links (Google + Outlook). */
export function calendarLinks(ev: CalEvent): { google: string; outlook: string } {
  const start = toBasicUtc(ev.startIso);
  const end = toBasicUtc(endIso(ev));
  const q = (s: string) => encodeURIComponent(s);

  const google =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${q(ev.title)}&dates=${start}/${end}` +
    (ev.description ? `&details=${q(ev.description)}` : "") +
    (ev.location ? `&location=${q(ev.location)}` : "");

  const outlook =
    "https://outlook.office.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent" +
    `&subject=${q(ev.title)}&startdt=${q(ev.startIso)}&enddt=${q(endIso(ev))}` +
    (ev.description ? `&body=${q(ev.description)}` : "") +
    (ev.location ? `&location=${q(ev.location)}` : "");

  return { google, outlook };
}

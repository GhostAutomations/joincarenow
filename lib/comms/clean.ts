// Strip the greeting ("Hi Jane,") and sign-off ("Kind regards, Acme Care") from
// an outbound message body so it reads like a chat bubble, not a formal email.

const GREETING = /^(hi|hello|hey|dear)\b[^.!?]*,?\s*$/i;
const SIGNOFF = /^(kind regards|warm regards|best regards|best wishes|many thanks|kind thanks|regards|thanks|thank you|yours sincerely|yours faithfully|cheers|all the best|speak soon)[,!.]?\s*$/i;
const TEAM_LINE = /^the .+ team\.?$/i;

export function cleanMessageBody(body: string): string {
  let lines = (body ?? "").replace(/\r/g, "").split("\n");

  // Leading greeting line.
  while (lines.length && lines[0].trim() === "") lines.shift();
  if (lines.length && GREETING.test(lines[0].trim())) {
    lines.shift();
    while (lines.length && lines[0].trim() === "") lines.shift();
  }

  // Sign-off block — cut from the first sign-off phrase to the end.
  for (let i = 0; i < lines.length; i++) {
    if (SIGNOFF.test(lines[i].trim())) { lines = lines.slice(0, i); break; }
  }

  // Trailing "The Acme Care team" line, if any, and trailing blanks.
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length && TEAM_LINE.test(lines[lines.length - 1].trim())) lines.pop();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();

  const cleaned = lines.join("\n").trim();
  return cleaned || (body ?? "").trim();
}

# Prospect CRM ("Sales") — founder-only

A lean internal sales CRM to track prospect care companies and engage them by
email/SMS. It lives **only** in the founder/super-admin console and is fully
isolated from customer-tenant data.

## Access & isolation
- Every page lives under `/admin/sales/**` and is gated by `requirePlatformAdmin`
  (server-side). The nav item ("Sales", target icon) only renders in the founder
  dock/grid.
- All data is in `prospect_*` tables with **founder-only RLS**
  (`for all using is_platform_admin()`). Nothing references applicants,
  employees, company_users or the customer `companies` table.

## Data model (migrations 0091–0093)
- `prospect_companies` — name, setting_type, size_band, region, website, source,
  `stage` (new → contacted → engaged → demo → proposal → won → lost), notes,
  retention_until.
- `prospect_contacts` — name, role, email, phone, `consent_basis`, `opted_out`,
  `unsub_token` (one-click unsubscribe).
- `prospect_activities` — unified timeline: `type` note/message/stage_change/task/system,
  channel/direction/subject/body/status for messages, plus `needs_approval` and
  `high_risk` flags for drafts.
- `prospect_tasks` — follow-ups (title, due_date, done).
- `prospect_suppressions` — global opt-out list (email/phone); suppressed
  addresses can never be messaged.
- `prospect_sequences` / `prospect_sequence_steps` / `prospect_enrolments` —
  multi-step scheduled follow-ups.

## Comms & deliverability
- Outbound email uses a **separate sending identity** so prospecting can't harm
  customer/transactional mail. Set Vercel env **`RESEND_PROSPECT_FROM`**
  (e.g. `Join Care Now <hello@outbound.joincarenow.com>`) and verify that
  subdomain in Resend. **Until it's set, cold email is blocked.** SMS uses the
  existing Twilio number.
- Every prospect email includes a one-click opt-out (`/unsubscribe/<unsub_token>`).
  Opting out (or replying STOP to SMS) sets `opted_out` and adds the address to
  `prospect_suppressions` globally.

## Sequences
- Build in **Sales → Sequences**: ordered steps (wait days + message; mark a step
  "needs approval" to force human review). Enrol a contact from their record.
- Hourly cron `/api/cron/prospect-sequences` sends the next due step, advances,
  and **stops automatically** if the contact opts out or replies (an inbound
  message exists). High-risk / non-auto-send steps park as drafts for approval.
- Cron is secured by `CRON_SECRET` (same as the reminder cron).

## Approval queue
- **Sales → Needs approval** lists drafts created by sequences (high-risk steps)
  and by agents. The founder edits and **Approve & sends**, or **Discards**.
  Approving a sequence draft resumes that enrolment.
- Price/contract/compliance wording is auto-flagged (`detectHighRisk`) and always
  requires human approval.

## Agent API (founder-key auth)
Server-to-server endpoints, authenticated by `Authorization: Bearer <AGENT_API_KEY>`
(set the env). They only touch prospect tables via the service role.
- `GET /api/agent/prospects?stage=` — list prospects.
- `GET /api/agent/prospects/:id` — company + contacts + recent timeline (context).
- `GET /api/agent/followups` — prospects in active stages to draft follow-ups for
  (pollable by a scheduled task).
- `POST /api/agent/prospects/:id/draft` — body `{ contactId, channel?, subject?, body }`.
  Creates a draft in the approval queue (`needs_approval = true`). **Agents never
  send directly** — the founder approves. Price/compliance content is flagged.

## Required env
- `RESEND_PROSPECT_FROM` — cold-outbound sender (verify subdomain in Resend).
- `CRON_SECRET` — secures the sequence cron (already set for reminders).
- `AGENT_API_KEY` — bearer key for the agent endpoints.

## Not yet built
- Inbound reply threading (routing `/api/resend` + `/api/twilio` replies onto the
  prospect timeline) — sequences already stop if an inbound message is logged, so
  this slots in cleanly later.

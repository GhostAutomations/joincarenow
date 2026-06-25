-- Add the "Registered Individual" company role (level 3). Permissions are
-- identical to Registered Manager / Recruiter (operational access; no billing,
-- settings or team management) — the distinction is a job title/designation.
-- The existing 'manager' value is relabelled to "Registered Manager" in the UI.
alter type public.company_role add value if not exists 'registered_individual';

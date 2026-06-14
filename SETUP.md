# Join Care Now — Setup Guide (Phase 0)

Follow these steps once. After this, every new phase is just code + a migration.

## 1. Prerequisites

- [Node.js 20+](https://nodejs.org) installed (check with `node -v`)
- A free [GitHub](https://github.com) account
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account

## 2. Create the Supabase project

1. Go to supabase.com → **New project**
2. Name: `joincarenow` · Region: **West EU (London)** ← important for UK data residency
3. Choose a strong database password and store it in a password manager
4. When it finishes provisioning, open **SQL Editor**, paste the entire contents of
   `supabase/migrations/0001_foundations.sql`, and click **Run**
5. Then run `supabase/migrations/0002_invitations.sql` (invite-only access +
   invitations). Always run migrations in order.
6. (Recommended) Paste and run `supabase/tests/rls_isolation_test.sql` —
   you should see four `PASS` notices. This proves one company can never see another's data.
6. Go to **Authentication → Sign In / Up → Email** and (for now) turn **off**
   "Confirm email" so you can test sign-up without an email provider.
   We turn it back on in Phase 3 when Resend is connected.

## 3. Configure the app locally

```bash
cd joincarenow
cp .env.example .env.local
```

Fill in `.env.local` from Supabase **Project Settings → API**:

- `NEXT_PUBLIC_SUPABASE_URL` = Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `anon` `public` key
- `SUPABASE_SERVICE_ROLE_KEY` = `service_role` key (server-only — never share)

Then:

```bash
npm install
npm run dev
```

Open http://localhost:3000 and test the golden path.

**Access model:** staff never self-register. The **founder** (you) invites company
admins; admins invite managers and recruiters; only **applicants** create their
own accounts (built with the jobs phase).

1. Make yourself the founder. In the Supabase **SQL Editor**, run:
   ```sql
   update public.profiles set is_platform_admin = true
   where email = 'YOUR_EMAIL';
   ```
   (Your profile is created automatically the first time you sign in. If you have
   a leftover `company_users` row from earlier testing, delete it so you land on
   the founder console instead of a company dashboard.)
2. Sign in → you arrive at **/admin** (the founder console).
3. **Add a company**, then **Invite an administrator** — copy the invite link.
4. Open that link in a private window → set name + password → you land on the
   company dashboard as its `admin`.
5. As that admin, open **Settings → Invite a team member** to invite a manager
   or recruiter, and confirm the same accept-link flow works.

## 4. Push to GitHub & deploy to Vercel

```bash
git init && git add -A && git commit -m "Phase 0: foundations"
```

Create a GitHub repo named `joincarenow`, push, then in Vercel:

1. **Add New → Project** → import the repo
2. Add the three environment variables from `.env.local`
3. Deploy — `vercel.json` already pins functions to London (`lhr1`)
4. Add your domain `joincarenow.com` under **Settings → Domains**

## 5. Checklist (must all pass before Phase 1)

- [ ] RLS test prints 4 × PASS
- [ ] Founder console (/admin): create company → invite admin → accept link works
- [ ] Admin can invite a manager/recruiter from Settings; accept link works
- [ ] Self-signup is gone — visiting `/sign-up` redirects to `/sign-in`
- [ ] An invite link only works for the email it was sent to
- [ ] Second company's admin cannot see the first company's data
- [ ] Deployed and loading on Vercel

## What's built

| Area | What was built |
|---|---|
| Database | `profiles`, `companies`, `company_users`, `invitations`, `audit_logs` + RLS + RPCs (`create_company`, `create_invitation`, `get_invitation`, `accept_invitation`, `revoke_invitation`, `log_audit`) + isolation test |
| Access model | Invite-only staff: founder → admins → managers/recruiters. `create_company` is founder-only. Permission tiers enforced in the database. |
| Auth | Email/password sign-in, invite acceptance (account creation locked to the invited email), session middleware, route protection |
| Multi-tenancy | Membership-scoped queries; cross-company isolation enforced in the database |
| UI | Landing page, sign-in, accept-invite, no-access, founder console (`/admin`), dashboard shell, Settings with team roster + invitations |

**Next: Phase 1 — Jobs & public careers pages (incl. applicant self-signup).**

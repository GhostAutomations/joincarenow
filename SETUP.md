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
5. (Recommended) Paste and run `supabase/tests/rls_isolation_test.sql` —
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

Open http://localhost:3000 and test the golden path:

1. **Get started** → create an account
2. Create your company (e.g. your care company's name)
3. You should land on the dashboard with the sidebar
4. Open **Settings** — you appear as the company's `admin`

## 4. Push to GitHub & deploy to Vercel

```bash
git init && git add -A && git commit -m "Phase 0: foundations"
```

Create a GitHub repo named `joincarenow`, push, then in Vercel:

1. **Add New → Project** → import the repo
2. Add the three environment variables from `.env.local`
3. Deploy — `vercel.json` already pins functions to London (`lhr1`)
4. Add your domain `joincarenow.com` under **Settings → Domains**

## 5. Phase 0 checklist (must all pass before Phase 1)

- [ ] RLS test prints 4 × PASS
- [ ] Sign up → create company → dashboard works end-to-end
- [ ] Second test account cannot see the first company (sign up again in a
      private browser window — it should be sent to "Set up your company",
      and its Settings page shows only itself)
- [ ] Deployed and loading on Vercel

## What's in Phase 0

| Area | What was built |
|---|---|
| Database | `profiles`, `companies`, `company_users`, `audit_logs` + RLS policies + `create_company` / `log_audit` RPCs + isolation test |
| Auth | Email/password sign-up & sign-in (Supabase Auth), session middleware, route protection |
| Multi-tenancy | Company creation, admin role, membership-scoped queries — all enforced in the database |
| UI | Landing page, auth screens, dashboard shell with sidebar, settings page with live team roster |

**Next: Phase 1 — Jobs & public careers pages.**

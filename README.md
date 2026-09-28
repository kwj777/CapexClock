# CapexClock

Free CapEx forecaster for small rental property owners. Live at capexclock.com.

## Phase 1: early-access landing page

- Next.js (App Router), TypeScript strict, Tailwind v4, fully static
- Hosted on Netlify (Next.js runtime is auto-detected; see `netlify.toml`)
- Signups go to the Netlify Form `early-access`
- Optional PostHog analytics (`early_access_signup` event on successful signup)

```bash
cp .env.example .env.local   # optional: add a PostHog key
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

### Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project API key. Unset = analytics off. |
| `NEXT_PUBLIC_POSTHOG_HOST` | No | Defaults to `https://us.i.posthog.com`. |
| `NEXT_PUBLIC_SUPABASE_URL` | For accounts | Supabase project URL. Unset = no sign-in; the calculator still works. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For accounts | The `sb_publishable_…` key. Never use the secret key here. |

Set them in Netlify under **Project configuration → Environment variables**, then redeploy
(they're baked in at build time).

### Early-access form

Netlify can't detect forms rendered by React, so `public/__forms.html` holds a
hidden static copy that Netlify registers at deploy. `src/components/SignupForm.tsx`
POSTs to `/__forms.html` as `application/x-www-form-urlencoded`. If you change a
field in one, change it in the other.

Submissions only work on a Netlify deploy (or `netlify dev`), not `next dev`.

## Deploying to Netlify

1. **Create the site.** In Netlify, **Add new project → Import an existing project → GitHub**,
   pick `kwj777/CapexClock`, branch `main`. Build settings come from `netlify.toml`
   (`npm run build`, Node 22). Netlify applies its Next.js runtime automatically; no plugin needed.
2. **Turn on forms.** **Project configuration → Forms → Enable form detection**, then
   trigger a redeploy (**Deploys → Trigger deploy**). The `early-access` form appears under
   **Forms** after that deploy.
3. **Test it.** Submit the form once on the live site or a deploy preview and confirm the
   entry shows up.
4. **(Optional) Analytics.** Add `NEXT_PUBLIC_POSTHOG_KEY` as above and redeploy.

Every pull request gets a deploy preview at `deploy-preview-<PR number>--capexclock.netlify.app`.

## Connecting capexclock.com

1. **Domain management → Add a domain**, enter `capexclock.com`, and let Netlify also add
   `www.capexclock.com`.
2. Point DNS at Netlify, either:
   - **Netlify DNS (simplest):** choose "Set up Netlify DNS" and change the nameservers at your
     registrar to the four Netlify gives you, or
   - **External DNS:** at your registrar add an `ALIAS`/`ANAME` (or `A` to `75.2.60.5`) for the
     apex and a `CNAME` for `www` pointing to `<your-site>.netlify.app`.
3. Wait for DNS to propagate. Netlify issues the HTTPS certificate automatically; check it under
   **Domain management → HTTPS**.
4. Set `capexclock.com` as the primary domain so `www` redirects to it.

If you use your domain's DNS for email (support@capexclock.com), keep the existing `MX` and
`TXT` records when switching to Netlify DNS: re-add them under **Domains → DNS records**.

## Viewing signups

**Netlify → your project → Forms → early-access** lists every submission (email, units,
current method, biggest worry). From there you can:

- **Export to CSV** from the form's page.
- Review anything caught as spam under **Spam submissions** (the `bot-field` honeypot filters
  most bots).
- Get notified: **Project configuration → Notifications → Emails and webhooks → Form submission
  notifications → Add notification → Email notification**.

## Accounts (Supabase)

Accounts use Supabase magic-link sign-in. All data is protected by Row Level Security: each
owner can only read or change their own properties.

1. **Create the tables.** In the Supabase dashboard open **SQL Editor → New query**, paste
   `supabase/migrations/0001_init.sql`, and run it. Then run each later migration in order
   (`0002_safer_saves.sql`, …), and then `supabase/seed.sql` (the component library; safe to
   run again).
2. **Allow the sign-in links to return to the site.** Under **Authentication → URL
   Configuration**, set **Site URL** to `https://capexclock.com` and add these **Redirect URLs**:
   - `https://capexclock.com/auth/callback`
   - `https://*--capexclock.netlify.app/auth/callback` (deploy previews)
   - `http://localhost:3000/auth/callback` (local development)
3. **Environment variables.** Add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Netlify (see above) and redeploy.
4. **Email.** Supabase's built-in email sender is rate-limited and meant for testing. Before
   launch, add your own SMTP under **Authentication → Emails → SMTP Settings** (for example
   Resend or Postmark, sending from support@capexclock.com).

### Updating the database

When a new file appears in `supabase/migrations`, run it once on the live project: open
**SQL Editor → New query**, paste the whole file and click **Run**. Run them in number order.

- `0002_safer_saves.sql`: stops a save from one tab or device silently overwriting a newer
  save from another, rejects quantities and costs that aren't real numbers, and keeps service
  records tied to their own component's assets. It's safe to run again, and the site works
  both before and after it runs. If it notes that some existing rows break a rule, those rows
  are left as they are and every new save is still checked.

The component library can be edited under **Table Editor → component_library**. The calculators and
the /lifespan pages read it from Supabase and pick up edits within an hour. A new row gets its
own /lifespan page automatically (add sentence-friendly wording and notes in
`src/lib/library/phrasing.ts` and `content.ts` if you like). If Supabase can't be reached, the site
falls back to the copy in `src/lib/library/components.ts`; a test keeps that file and
`supabase/seed.sql` in sync.

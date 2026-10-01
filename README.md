# CapexClock

Free CapEx forecaster for small rental property owners. Live at capexclock.com.

## Phase 1: early-access landing page

- Next.js (App Router), TypeScript strict, Tailwind v4
- Not a static site any more: `/`, `/privacy` and `/reserve-calculator` are fully static, the
  pages built from the lifespan library (`/capex-calculator`, `/lifespan`, `/lifespan/<slug>` and
  the sitemap) are rebuilt at most once an hour (ISR), `/app` and `/auth` render on each request,
  and `src/proxy.ts` checks the session on `/app` only
- A `/lifespan/<slug>` that doesn't exist shows the 404 page, which is cached like the other
  lifespan pages. A new library row usually shows up within an hour or two, but a URL visited
  before the row existed may show the 404 once more after that. On Netlify that cache is per
  deploy, so it starts empty on every deploy
- Hosted on Netlify with the Next.js runtime (`@netlify/plugin-nextjs`), declared in `netlify.toml`
- Signups go to the Netlify Form `early-access`
- Optional PostHog analytics (product events only; `/privacy` says what is sent)

```bash
cp .env.example .env.local   # optional: add a PostHog key
npm install
npm run dev        # http://localhost:3000
npm run lint
npm test
npm run typecheck  # generates Next's route types, then runs tsc
npm run build
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
   pick `kwj777/CapexClock`, branch `main`. Build settings come from `netlify.toml` (Node 22). The
   build runs `npm run lint` and `npm test` before `npm run build`, so a failing check stops the
   deploy. The Next.js runtime is declared there as a `[[plugins]]` entry on purpose: Netlify
   didn't apply it automatically for this site, and without it deploys publish raw `.next` output
   and 404. Keep that block.
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

## Replace-now comparison

Under **At risk**, in the calculator and the property editor, "What if we replace everything at
risk now?" compares the forecast as it stands with replacing the ticked at-risk items this year.
It shows the cash needed this year, the change in the 10-year total and the monthly reserve.
Items whose install year is a guess are listed apart. Nothing changes until the owner clicks
**Apply**, and Apply can be undone.

PostHog events, with counts only: `compare_viewed` (`items`: how many items the panel lists;
once per page view, the first time it opens) and `compare_applied` (`items`: how many items
Apply turned on).

**Dashboard tile.** Add it to the `CapexClock Monday numbers` dashboard the same way as the
other tiles (that dashboard's steps come with Phase 3, step 1):

| Tile | Series (counted as) | Breakdown | Dates |
| --- | --- | --- | --- |
| Comparison | `forecast_generated`, `compare_viewed`, `compare_applied` (Unique users), with the two compare events filtered to Path name = `/capex-calculator` | none | From the day this change went live |

To filter a series, click the filter icon on it, choose **Path name**, then **equals**, and
type `/capex-calculator`. The filter matters because the comparison also runs in the property
editor, while `forecast_generated` is only sent from the public calculator. The plan's goal is
met when `compare_viewed` is at least a tenth of `forecast_generated`.

**Awaiting Kevin's answer:** the optional "Emergency replacements cost __% more" box adds the
percent to the next replacement of every ticked item on the "if you wait" side, including items
that are past end of life or due this year, which are paid this year either way. With 20% on
the example property, the cash needed this year "if you wait" goes from $30,000 to $36,000. If
the percent should only apply to items due in the next 2 years, tell Claude; it's a small
change. The box is empty by default, so nothing changes until an owner types a percent.

## Accounts (Supabase)

Accounts use Supabase magic-link sign-in. All data is protected by Row Level Security: each
owner can only read or change their own properties.

1. **Create the tables.** In the Supabase dashboard open **SQL Editor → New query**, paste
   `supabase/migrations/0001_init.sql`, and run it. Then run each later migration in order
   (`0002_safer_saves.sql`, then `0003_library_checks.sql`, …), and then `supabase/seed.sql` (the
   component library; safe to run again).
2. **Allow the sign-in links to return to the site.** Under **Authentication → URL
   Configuration**, set **Site URL** to `https://capexclock.com` and add these **Redirect URLs**.
   They need the `/**` ending: the sign-in link comes back to `/auth/callback?next=…`, and an
   entry without it doesn't match that query string, so the link would land on the production
   home page instead.
   - `https://capexclock.com/**`
   - `https://*--capexclock.netlify.app/**` (deploy previews)
   - `http://localhost:3000/**` (local development)
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
- `0003_library_checks.sql`: makes the table editor refuse a component library row the site
  can't use (a slug with capitals or spaces, or a name or category with no letters or numbers)
  instead of saving it and leaving it off the site. It's safe to run again. If it notes that
  some existing rows break a rule, fix them under **Table Editor → component_library**; until
  then the site skips them and logs why.
- `0004_condition_notes.sql`: lets the site save each component's condition, notes and the
  "Guess" tick next to its install year. Run it before merging the pull request that adds them
  (Phase 3, step 3). Until it runs, everything else still saves, and after a save that has a
  condition, notes or a ticked Guess the property editor says "Your database needs update 0004.
  Condition and notes weren't saved." in place of "Saved". It needs 0002 first, and stops with
  "Run 0002_safer_saves.sql first" if that hasn't run. It's safe to run again. Don't run 0002
  again after it: that brings back the old save, which ignores condition and notes. If that
  happens, run 0004 again.

The component library can be edited under **Table Editor → component_library**. The calculators and
the /lifespan pages read it from Supabase and pick up edits within an hour. A new row gets its
own /lifespan page automatically (add sentence-friendly wording and notes in
`src/lib/library/phrasing.ts` and `content.ts` if you like). If Supabase can't be reached, the site
falls back to the copy in `src/lib/library/components.ts`; a test keeps that file and
`supabase/seed.sql` in sync.

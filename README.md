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
| `NEXT_PUBLIC_TEST_BUTTONS` | No | `off` hides the three paid-idea test buttons. Unset = shown. See [Paid-idea test buttons](#paid-idea-test-buttons). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | Cloudflare Turnstile **site** key for the sign-in check. Unset = no check. The secret key goes in Supabase, never here. See [Sign-in CAPTCHA](#sign-in-captcha-cloudflare-turnstile). |

Set them in Netlify under **Project configuration → Environment variables**, then redeploy
(they're baked in at build time).

### Netlify forms (early access and paid interest)

Netlify can't detect forms rendered by React, so `public/__forms.html` holds a
hidden static copy of each form that Netlify registers at deploy:

- `early-access`, posted by `src/components/SignupForm.tsx`
- `paid-interest` (email, units, idea, where), posted by `src/components/paid/TellMeFirstForm.tsx`

Both POST to `/__forms.html` as `application/x-www-form-urlencoded`. If you change a
field in one copy, change it in the other (a test checks `paid-interest`).

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
current method, biggest worry). **Forms → paid-interest** lists the "tell me first" sign-ups
from the paid-idea buttons (email, units, which idea, and the page: `calculator` or
`property`). The paid-interest form appears after the first deploy that includes it. From
either form you can:

- **Export to CSV** from the form's page.
- Review anything caught as spam under **Spam submissions** (the `bot-field` honeypot filters
  most bots).
- Get notified: **Project configuration → Notifications → Emails and webhooks → Form submission
  notifications → Add notification → Email notification**. Pick the form (`paid-interest`, say)
  under **Form**, or leave it on "Any form".

On an older Netlify plan, going over 100 form entries a month (both forms together) turns on a
paid add-on automatically. Check **Netlify → Billing** if sign-ups pick up.

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

The component library can be edited under **Table Editor → component_library**. The calculators and
the /lifespan pages read it from Supabase and pick up edits within an hour. A new row gets its
own /lifespan page automatically (add sentence-friendly wording and notes in
`src/lib/library/phrasing.ts` and `content.ts` if you like). If Supabase can't be reached, the site
falls back to the copy in `src/lib/library/components.ts`; a test keeps that file and
`supabase/seed.sql` in sync.

## Paid-idea test buttons

Three buttons test paid ideas before any of them is built. Each is marked **Idea**, and the
first click opens a panel on the page that says "Not built yet. We're deciding what to build
next." with an email box (filled in for signed-in owners) and a units picker. Sign-ups go to the
`paid-interest` Netlify form.

| Idea | Button | Where |
| --- | --- | --- |
| `reminders` | Email me before these are due | The Monthly reserve card and the At risk list |
| `report` | Condition report for lenders and buyers | Next to Download PDF |
| `photo` | Add from a photo of the label | The add-a-component area |

They show in the public calculator (`where` = `calculator`) and the property editor
(`where` = `property`). To hide them all, set `NEXT_PUBLIC_TEST_BUTTONS` to `off` in Netlify and
redeploy. Delete the setting (or set it to `on`) and redeploy to bring them back.

PostHog events, all with `{idea, where}` and never the email or unit count:
`paid_idea_seen` (once per page view per idea, once the button is actually on screen),
`paid_idea_clicked` (once per page view per idea) and `paid_idea_signup`.

**The photo offer.** The photo idea's real test is a free offer (plan section 2): its panel says
"Want it now? Email a photo of the label to support@capexclock.com and we'll fill in the row for
you, free." The address opens an email with the subject "Photo of a label", and a click sends
`photo_offer_clicked` (`{idea, where}` only). When a photo arrives:

1. Forward it to the CapexClock thread. Claude reads the label and drafts the row: the item, its
   install year (the made-on date from the label or serial number, marked a guess), and the brand
   and model for the notes.
2. Check the draft and reply to that one person, from support@capexclock.com.
3. Delete the photo within 30 days of replying, as /privacy says.

Count the photos you get each week in the Monday numbers.

The pay question after an export keeps its wording. A Yes or Maybe now asks "Which would you
use first?" and sends `pay_question_first_pick` with `pick` (`reminders`, `report`, `photo` or
`other`). Every pay-question event now has `version` = `2`; events from before this change have
no `version` but the same question and the same once-per-browser rule.

## Sign-in CAPTCHA (Cloudflare Turnstile)

The sign-in form can show a Cloudflare Turnstile check so bots can't use up the sign-in email
quota. It's off until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set, and the script loads only on the
sign-in page. **Do these steps in this order.** If Supabase starts asking for the check before
the site shows it, every sign-in fails.

1. **Create the widget.** In the Cloudflare dashboard (a free account is fine), open
   **Turnstile → Add widget**. Name it `CapexClock sign-in`. Under **Hostnames** add
   `capexclock.com` and `netlify.app` (the second covers deploy previews). Leave **Widget mode**
   on **Managed** and pre-clearance off, then **Create**. Copy the **Site key** and the
   **Secret key**. If Cloudflare won't accept `netlify.app`, add `capexclock.netlify.app`
   instead; deploy previews then say the check isn't working, but still sign in until step 3.
2. **Put the site key in Netlify and deploy.** **Project configuration → Environment
   variables → Add a variable**: key `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, value the site key, same
   value for every deploy context. Then **Deploys → Trigger deploy → Deploy project**. When it's
   live, open `https://capexclock.com/auth/sign-in`: the check appears above the button and turns
   into a tick. Send yourself a link to make sure sign-in still works.
3. **Only then switch it on in Supabase.** **Authentication → Attack Protection → Enable CAPTCHA
   protection**, provider **Cloudflare Turnstile**, paste the **secret key**, **Save**. Sign in
   once more to check.

The secret key goes only in Supabase, never in Netlify. If sign-ins break after step 3, switch
CAPTCHA protection off in Supabase (it takes effect at once) and tell Claude. To remove the
check later, do it the other way round: switch it off in Supabase first, then delete the Netlify
setting and redeploy.

## Monday numbers

Each Monday, paste these in the thread (about 10 minutes). Claude keeps the tally.

1. **PostHog:** the numbers on the dashboard below (a screenshot of each tile is fine).
2. **Netlify:** **Forms → paid-interest** and **Forms → early-access**: how many new entries
   since last Monday.
3. **Your inbox:** how many people emailed a photo of a label since last Monday (the photo
   offer), and how many of those you answered.
4. **Supabase:** the weekly query below.
5. **Once a month, Search Console:** see [Google Search Console](#google-search-console).

### Build the PostHog dashboard (once, about 20 minutes)

1. In PostHog, open **Dashboards → New dashboard → Blank dashboard**, name it
   `CapexClock Monday numbers` and create it.
2. For each tile below: on the dashboard click **Add insight → New insight**, pick **Trends**,
   then set it up as the table says:
   - **Series:** click the event picker and type the event name. **+ Add graph series** adds
     the next event.
   - **Counted as:** the dropdown next to each event: **Total count** or **Unique users**.
   - **Breakdown:** **+ Add breakdown → Event properties** and pick the property.
   - **Dates:** the date picker above the chart. "Since step 1" means **Custom → from** the day
     this change went live; "Since the review fix" means from the day PR #12's review fixes went
     live (merged on September 28, 2026).
   - **Chart:** the chart-type dropdown above the chart. Pick the one that shows one total per
     line (called **Total value** or **Bar chart (total value)**, depending on the version).
   - Name the insight (click the title), then **Save** (it lands on the dashboard).

| Tile | Series (counted as) | Breakdown | Dates |
| --- | --- | --- | --- |
| Pay question | `pay_question_shown`, `pay_question_answered`, `pay_question_dismissed` (Total count) | none | Since the review fix |
| Pay question answers | `pay_question_answered` (Total count) | `answer` | Since the review fix |
| Which would you use first | `pay_question_first_pick` (Total count) | `pick` | Since step 1 |
| Idea buttons | `paid_idea_seen`, `paid_idea_clicked`, `paid_idea_signup`, `photo_offer_clicked` (Total count) | `idea` | Since step 1 |
| People who saw each idea | `paid_idea_seen` (Unique users) | `idea` | Since step 1 |
| This week | `calculator_started`, `forecast_generated`, `pdf_exported`, `csv_exported`, `account_created`, `property_saved` (Total count) | none | Last 7 days |

A new event shows up in the event picker only after it has happened once on the live site. If
one is missing, open the site, use that button once, wait a few minutes and try again. Later
steps (Buy now, import, the comparison and the quick estimate) add their own tiles; each of
those changes says what to add.

### Weekly Supabase query

In Supabase, open **SQL Editor → New query**, paste this, click **Run** and copy the row. It only
counts rows and changes nothing. Save it (**Save → name it `Monday numbers`**) to reuse it.

```sql
-- CapexClock Monday numbers. Read-only.
select
  (select count(*) from auth.users) as accounts,
  (select count(*) from auth.users where created_at >= now() - interval '7 days') as new_accounts_this_week,
  (select count(*) from public.properties) as properties_saved,
  (select count(*) from public.properties where created_at >= now() - interval '7 days') as properties_saved_this_week,
  (select count(distinct user_id) from public.properties) as owners_with_a_property,
  -- Owners who came back and saved a property in a later calendar month than they created it.
  (select count(distinct user_id) from public.properties
     where date_trunc('month', updated_at) > date_trunc('month', created_at)) as owners_who_came_back,
  (select count(distinct user_id) from public.properties
     where date_trunc('month', updated_at) > date_trunc('month', created_at)
       and updated_at >= now() - interval '7 days') as came_back_this_week;
```

A property only remembers its latest save, so "came back" counts an owner once, however many
months they returned. Deleted properties drop out of every count.

## Google Search Console

Do this once, then check it once a month.

1. Go to <https://search.google.com/search-console> and sign in with your Google account.
2. **Add property → Domain**, type `capexclock.com`, **Continue**. Google shows a TXT record
   starting `google-site-verification=`. Copy it.
3. Add it to your DNS. With Netlify DNS: **Netlify → Domains → capexclock.com → DNS records →
   Add new record**, type **TXT**, name `@` (or leave it blank), value the text you copied,
   **Save**. If your DNS is at your registrar, add the same TXT record there.
4. Back in Search Console, click **Verify**. If it isn't verified yet, wait an hour and try
   again (DNS can take up to a day).
5. Open **Sitemaps**, type `sitemap.xml` under **Add a new sitemap** and click **Submit**. The
   status should say **Success**.

Once a month, paste from **Performance → Search results** (last 28 days): total clicks, total
impressions, and the top pages. **Indexing → Pages** shows how many pages Google has indexed.

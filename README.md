# CapexClock

Free CapEx forecaster for small rental property owners. Live at capexclock.com.

## Phase 1: early-access landing page

- Next.js (App Router), TypeScript strict, Tailwind v4
- Not a static site any more: `/`, `/pricing`, `/terms`, `/privacy` and `/thanks/*` are fully
  static, the pages built from the component library (`/capex-calculator`, `/reserve-calculator`,
  `/capex-spreadsheet-template`, `/lifespan`, `/lifespan/<slug>` and
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
| `NEXT_PUBLIC_POSTHOG_HOST` | No | Leave unset on Netlify, so analytics go through the site's relay (see [Analytics relay](#analytics-relay)). Set it to `https://us.i.posthog.com` when running without Netlify. |
| `NEXT_PUBLIC_SUPABASE_URL` | For accounts | Supabase project URL. Unset = no sign-in; the calculator still works. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | For accounts | The `sb_publishable_…` key. Never use the secret key here. |
| `NEXT_PUBLIC_TEST_BUTTONS` | No | `off` hides the three paid-idea test buttons. Unset = shown. See [Paid-idea test buttons](#paid-idea-test-buttons). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | Cloudflare Turnstile **site** key for the sign-in check. Unset = no check. The secret key goes in Supabase, never here. See [Sign-in CAPTCHA](#sign-in-captcha-cloudflare-turnstile). |
| `NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP` | No | Stripe Payment Link for the $12/month founding membership (`https://buy.stripe.com/…`). Only used when `NEXT_PUBLIC_STRIPE_PORTAL_LINK` is valid too and from the same Stripe mode (both test-mode links, with `test_` in them, or both live), so members can always cancel online. Unset (or no matching portal link) = the reminders panel keeps its email form and /pricing says "Not on sale right now". See [Pre-orders](#pre-orders-stripe-payment-links). |
| `NEXT_PUBLIC_STRIPE_LINK_REPORT` | No | Stripe Payment Link for the $29 condition report (`https://buy.stripe.com/…`). Unset = the report panel keeps its email form. |
| `NEXT_PUBLIC_STRIPE_PORTAL_LINK` | No | Stripe customer portal **login link** (`https://billing.stripe.com/p/login/…`), where members cancel. Unset = no "Manage or cancel membership" link, and the membership isn't on sale (the report still can be). |
| `OWNER_EMAILS_MODE` | No | Server only. `off` (or unset) = no member emails. `preview` = every member's emails go to support@capexclock.com, whatever the date. `live` = members get them on schedule. See [Member emails](#member-emails). |
| `RESEND_API_KEY` | For member emails | Server only. A Resend API key with sending access to capexclock.com. |
| `SUPABASE_SECRET_KEY` | For member emails | Server only. The `sb_secret_…` key, read only by the daily email function. Never put it in a `NEXT_PUBLIC_` variable. |

Set them in Netlify under **Project configuration → Environment variables**, then redeploy
(they're baked in at build time).

The three Stripe settings only accept `https://` links on Stripe's own addresses: Payment Links
on `buy.stripe.com` and the portal on `billing.stripe.com`. Anything else (a typo, an `http://`
link, a link pasted in the wrong box) is ignored as if it were blank, so the site falls back to
the email form instead of sending buyers somewhere wrong. The membership link is also ignored
until the portal link is valid, because "Cancel any time online" sits next to its Buy now. Each
time a link is ignored, the build prints a warning starting `[CapexClock]` in the Netlify deploy
log (and `npm run dev` prints it too). There are no Stripe keys anywhere in the site.

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
4. **(Optional) Analytics.** Add `NEXT_PUBLIC_POSTHOG_KEY` as above and redeploy. Leave
   `NEXT_PUBLIC_POSTHOG_HOST` unset so analytics go through the relay below.

### Analytics relay

Safari's private windows and ad blockers block PostHog's own domains, so the browser sends
analytics to `capexclock.com/clockwork/…` instead, and a Netlify edge function
(`netlify/edge-functions/posthog-relay.ts`) passes them on to PostHog's US cloud. It passes on
only the headers PostHog's script sends it plus the visitor's IP (for rough location), never this
site's cookies, so the Supabase sign-in never reaches PostHog. The privacy page says so; keep it in
step if the relay changes. The path is deliberately not a tracker
word like `/ingest` or `/posthog`, which blocklists catch. If you change it, change `RELAY_PATH`
in `src/lib/analytics.ts` and both paths in the edge function together (a test checks they match).

To check it after a deploy, open the site, then in the browser's developer tools **Network** tab
look for requests to `/clockwork/…` returning 200. In PostHog, new events carry
`$lib_custom_api_host` = `/clockwork`. The relay only runs on Netlify, so `npm run dev` needs
`NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` to send analytics.

PostHog counts go up from the day the relay goes live, because visitors whose browsers used to
block PostHog are now counted. Note that date for the Monday tally, and don't read that week's
rise as growth or compare raw counts across it. Ratios such as the import finish rate are mostly
unaffected. Events from before the relay have no `$lib_custom_api_host`.

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

## How the numbers are worked out

The forecast math lives in `src/engine`: plain TypeScript that knows nothing about rentals,
pages or the database, and takes the current year as an input. `src/verticals/landlord` turns a
rental property into engine inputs, passes the site's rules (10 years shown, 30-year look-ahead,
no inflation) and adds the per-unit figures. Pages and downloads import only
`@/verticals/landlord`; lint stops them reaching the engine directly. [ENGINE.md](src/engine/ENGINE.md)
lists the engine's inputs and outputs and how another kind of building would plug in.
`npm run test:engine` runs its tests (90% coverage or more) and `npm run typecheck:engine` checks it
on its own.

## Replace-now comparison

Under **At risk**, in the calculator and the property editor, "What if we replace everything at
risk now?" compares the forecast as it stands with replacing the ticked at-risk items this year.
It shows the cash needed this year, the change in the 10-year total and the monthly reserve.
Items whose install year is a guess are listed apart. Nothing changes until the owner clicks
**Apply**, and Apply can be undone.

PostHog events, with counts only: `compare_viewed` (`items`: how many items the panel lists;
once per page view, the first time it opens) and `compare_applied` (`items`: how many items
Apply turned on).

**Dashboard tile.** The **Comparison** row of the [Monday numbers](#monday-numbers) dashboard.

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
- `0005_typical_costs.sql`: adds a typical cost range to each component in the library
  (`typical_cost_low`, `typical_cost_high`, and `typical_cost_per`: `apartment` or `sq_ft`) and
  fills in the 25 built-in components. The quick estimate on /reserve-calculator uses them, and
  the calculator shows them as gray hints under a per-apartment or per-sq-ft cost field (only for
  items the library counts per unit or per sq ft, never building-wide ones); they're
  never used in a forecast or saved to a property. It fills in costs only on the run that adds the
  columns, so running it again changes no costs and never puts back one edited or blanked in the
  dashboard. Until it runs the site uses the same numbers from
  `src/verticals/landlord/library/typical-costs.ts`.
  Leave all three cells blank on a row to leave it out; with every row blank, the quick estimate
  says it isn't available and no hints show. Kevin approved the numbers, and spreading each
  replacement over its lifespan range for the year built, on October 2, 2026 (sources in
  `typical-costs.md`, phase 3 project files); `SPREAD_REPLACEMENTS` in
  `src/verticals/landlord/quick-estimate.ts` switches the method.
- `0007_safety_buffer.sql`: lets a saved property keep its safety buffer (none, +10% or +20%
  on the monthly reserve). Run it before merging the pull request that adds the buffer. Until it
  runs, everything else still saves and a saved property's buffer goes back to none. It needs
  0002 and 0004 first. It's safe to run again. Don't run 0002 or 0004 again after it: that
  brings back a save that ignores the buffer. If that happens, run 0007 again.

The component library can be edited under **Table Editor → component_library**. The calculators and
the /lifespan pages read it from Supabase and pick up edits within an hour. A new row gets its
own /lifespan page automatically (add sentence-friendly wording and notes in
`src/verticals/landlord/library/phrasing.ts` and `content.ts` if you like). If Supabase can't be
reached, the site falls back to the copy in `src/verticals/landlord/library/components.ts`; a test
keeps that file and `supabase/seed.sql` in sync.

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

Once a Stripe link is set (see [Pre-orders](#pre-orders-stripe-payment-links)), the reminders
and report panels show **Buy now** in place of the email form (the reminders panel only once the
portal link is set too). The photo idea always keeps its email form. Hiding the buttons hides
those Buy now buttons too, but /pricing keeps selling.

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

**The done-for-you import.** Next to the import on /capex-spreadsheet-template, and above the
importer on My properties once "Import a spreadsheet" is open, a box says "Rather not do it
yourself? Email your spreadsheet to support@capexclock.com and we'll set up your buildings for
you, free for early users." The address opens an email with the subject "Set up my buildings",
and a click sends `setup_offer_clicked` (`{where}` only: `template_page` or `my_properties`).
When a sheet arrives, follow the checklist in the project files
(`import-offer/handling-checklist.md`): Claude turns it into a CapexClock Excel file with a
Building column, you check it and send it back, and the owner imports it. Delete the sheet within
30 days of sending it back, as /privacy says. No price shows on the site until the first 10 sheets
are done.

The pay question after an export keeps its wording. A Yes or Maybe now asks "Which would you
use first?" and sends `pay_question_first_pick` with `pick` (`reminders`, `report`, `photo` or
`other`). Every pay-question event now has `version` = `2`; events from before this change have
no `version` but the same question and the same once-per-browser rule.

## Pre-orders (Stripe Payment Links)

Two paid ideas can be bought before they're built, and you fill each order by hand: the
**founding membership** ($12 every month until canceled: reminder emails, a yearly budget
summary and a yearly condition report) and the **condition report** ($29 once, made within 2
business days). The site has no payment code: Buy now is a plain link to a Stripe Payment Link,
and Stripe takes the card, sends receipts and runs the cancel page.

Until the links are set, nothing changes for visitors: the panels keep their email forms and
/pricing says "Not on sale right now". The pages that go with this are always live:

- `/pricing`: Free ("Free today, with no limits during early access") next to the two offers,
  a short FAQ and the [sample report](public/sample-condition-report.pdf). In the sitemap and
  the header.
- `/terms`: what each offer includes, renewal and canceling, the 30-day refund, the report's
  label, who may rely on a report, the liability cap and the founding promise.
- `/thanks/membership` and `/thanks/report`: where Stripe sends buyers after paying. Hidden from
  search and not in the sitemap. They say what happens next and how to email a sheet or export,
  and the membership page links to the cancel page.
- The footer gets Pricing, Terms and, once `NEXT_PUBLIC_STRIPE_PORTAL_LINK` is set, **Manage or
  cancel membership**. /privacy says Stripe processes payments and we never see card numbers.

**Before you paste the live links, read every page a buyer sees:**

- [/terms](https://capexclock.com/terms) and [/privacy](https://capexclock.com/privacy) (the
  Payments section);
- the [sample report](https://capexclock.com/sample-condition-report.pdf);
- [/pricing](https://capexclock.com/pricing), including its questions and answers;
- the two thank-you pages, [/thanks/membership](https://capexclock.com/thanks/membership) and
  [/thanks/report](https://capexclock.com/thanks/report). Opening them yourself before the live
  links go in is fine: the Monday tiles count from that day.

They make promises you'll have to keep by hand:

- each new member hears from support@capexclock.com within 2 business days;
- each member gets an email before each replacement comes due, plus a yearly budget summary
  and a yearly condition report;
- each report goes out within 2 business days of getting the owner's details;
- anyone who asks within 30 days of a payment gets it back in full;
- if reminders aren't built, every founding membership is canceled and every payment refunded;
- files people email you are deleted 30 days after you deliver.

Tell Claude anything you want changed. Ask your accountant about sales tax first, and optionally
have a lawyer review /terms (an hour, about $200–500) and say whether to sell as yourself or
through an LLC.

### Set up Stripe (once, about an hour)

Do everything in **test mode** first (the **Test mode** switch in the Stripe dashboard, or a
**Sandbox** if your dashboard offers that instead). Nothing real is charged there.

0. **Check support@capexclock.com gets email.** From another email account, send a test email to
   support@capexclock.com and check it reaches you. Buyers, refunds, Stripe receipts and the
   sheets owners send all use this address. If it doesn't arrive, set up forwarding to your inbox
   (ImprovMX works with any DNS; Cloudflare Email Routing works if your DNS is on Cloudflare;
   both are free), or get a mailbox (Google Workspace is about $7–8 a month), and test again.
1. **Open the account.** Sign up at stripe.com and fill in what Stripe asks for: your business
   (or you as an individual), your details and the bank account for payouts.
2. **Public details.** **Settings → Business → Public details**: support email
   `support@capexclock.com`, website `https://capexclock.com`, terms of service
   `https://capexclock.com/terms`, privacy policy `https://capexclock.com/privacy`. Set the
   statement descriptor to `CAPEXCLOCK` so card statements say who charged them.
3. **Receipts.** **Settings → Customer emails** (under Business): turn on emails for
   **Successful payments** and **Refunds**.
4. **Customer portal** (where members cancel). **Settings → Billing → Customer portal**:
   - Turn on **Cancel subscriptions**, set to cancel **at the end of the billing period** (that's
     what /terms promises), and turn on updating payment methods and invoice history. Leave
     switching plans off.
   - Save, then turn on the **Login link** and copy it (it starts
     `https://billing.stripe.com/p/login/`).
5. **The membership link.** **Payment Links → New** (or **+ Create payment link**):
   - Add a new product: name `CapexClock founding membership`, price **$12.00 USD**,
     **Recurring**, **Monthly**. Description: `Reminder emails before replacements come due, a
     yearly budget summary and a yearly condition report. Sent by hand for now.`
   - **Options**: turn on **Limit the number of payments** and set it to **20**. Turn on
     **Require customers to accept your terms of service**. Turn off promotion codes. Turn on
     **Add custom text**, and in the text shown near the pay button (Stripe may call it the
     submit button) paste exactly: `$12 every month until you cancel. Cancel any time online.`
   - **After payment**: **Don't show confirmation page → Redirect customers to your website**:
     `https://capexclock.com/thanks/membership`
   - **Create link** and copy it (it starts `https://buy.stripe.com/`).
6. **The report link.** The same way: product `CapexClock condition report`, price **$29.00
   USD**, **One time**. Limit to **20** payments, require the terms, custom text near the pay
   button: `$29 once. Made by hand within 2 business days of getting your details.` Redirect to
   `https://capexclock.com/thanks/report`. Copy the link.
7. **Paste the three links into Netlify.** **Project configuration → Environment variables →
   Add a variable**, same value for every deploy context:
   - `NEXT_PUBLIC_STRIPE_LINK_MEMBERSHIP`: the membership link
   - `NEXT_PUBLIC_STRIPE_LINK_REPORT`: the report link
   - `NEXT_PUBLIC_STRIPE_PORTAL_LINK`: the portal login link (from step 4, not the address of
     the portal's settings page). The membership only goes on sale when this one is right, and
     from the same mode as the membership link: both test-mode links (they have `test_` in
     them) or both live.

   Then **Deploys → Trigger deploy → Deploy project**. Open the deploy's log and search for
   `[CapexClock]`: there should be no matches. A match names the setting that was ignored and why.
8. **Buy once of each with Stripe's test card.** On the live site, open /pricing: both offers
   show **Buy now** with "Stripe test mode: no real payment is taken." under them. Click Buy now,
   pay with card `4242 4242 4242 4242`, any future date, any CVC and any ZIP, tick the terms box,
   and check you land on the right thank-you page. Then open **Manage or cancel membership** at
   the bottom of the page, sign in with the email you used, and cancel the test membership.
   Stripe doesn't email receipts in test mode, so check **Payments** in the dashboard instead.
   The panels in the calculator (**Email me before these are due** and **Condition report for
   lenders and buyers**) show the same Buy now. Visitors see these test buttons too while you
   test, but no one can be charged in test mode, so keep it short. Your test clicks reach
   PostHog; the Monday tiles count from the day the live links go in.
9. **Make the live ones.** Switch test mode off and repeat steps 3–6 in live mode (test-mode
   products, links and portal settings don't carry over; a product page's **Copy to live mode**
   saves retyping the product). Replace the three Netlify values with the live links and redeploy.
   Check the deploy log has no `[CapexClock]` warnings. Then open capexclock.com/pricing and
   check:
   - both offers show **Buy now**, and the "test mode" line under them is gone;
   - **Manage or cancel membership** is at the bottom of the page, and opens Stripe's sign-in
     page for your **live** portal (its address has no `test_` in it).

   If the membership says "Not on sale right now", the `[CapexClock]` line in the deploy log says why:
   usually `NEXT_PUBLIC_STRIPE_PORTAL_LINK` is missing, or is still the test-mode link. Fix it
   and redeploy.

   That's the start of the six-week check-in.

To pause sales, delete the two `NEXT_PUBLIC_STRIPE_LINK_…` settings and redeploy: the panels go
back to the email form and /pricing says "Not on sale right now". Keep `NEXT_PUBLIC_STRIPE_PORTAL_LINK`
while anyone is still a member, so they can cancel online. After 20 payments Stripe switches a
link off by itself; Buy now then reaches Stripe's "no longer available" page, so delete that
setting and redeploy when it happens.

### Filling orders by hand

Turn on Stripe's email to you for each successful payment (your Stripe **profile → Communication
preferences**). Then for each order:

1. Forward Stripe's email to the CapexClock thread. Claude drafts the reply; you check it and
   send it from support@capexclock.com, to that one person only.
2. **Membership:** the first email repeats "$12 every month until you cancel" and includes the
   cancel link (your portal login link). Ask them to sign in and save their buildings (or send
   their sheet so we can set it up), then make them a member (see [Member emails](#member-emails)):
   their reminders, budget summary and condition report go out automatically from then on.
3. **Report:** when the owner emails their sheet or export, forward it to the thread. Claude
   drafts the report (the sample's layout, with the same label on the cover); you check it and
   send it within 2 business days.
4. **Refunds:** anyone who asks within 30 days of a payment gets it back in full: **Payments →
   the payment → Refund**. For a member, also cancel the subscription (**Customers → the customer
   → the subscription → Cancel**, immediately). If reminders aren't built after the check-in,
   cancel every membership and refund every payment, as /terms promises.
5. **Photos (the free photo offer):** forward each photo of a label to the thread. Claude drafts
   the row from it; you check it and reply to that one person. Delete the photo within 30 days of
   replying. See [The photo offer](#paid-idea-test-buttons).
6. Delete files people emailed you 30 days after you deliver, as /privacy says.

The sample report is made from the calculator's example building by a script. After changing the
report's layout or the example (or in a new year, so its dates stay current), run
`npm run sample-report` and commit `public/sample-condition-report.pdf`.

## Member emails

Founding members get three emails, made from the properties they save in My properties:

| Email | When (Central time) | What's in it |
| --- | --- | --- |
| Replacement reminders | From January 2 for everything due that year; after that, the day something newly due is saved. At most one a week. | Each component past its end of life, ending this year or marked Replace now, once per year it's due. |
| Yearly budget summary | From November 2 | Next year's replacements, the 10-year total and the monthly reserve, per property and in all. |
| Yearly condition report | From January 8 | The condition report PDF for each property. |

A Netlify scheduled function (`netlify/functions/owner-emails.mts`) runs once a day at 15:00 UTC
on the live site and sends through Resend from reminders@capexclock.com, with replies going to
support@capexclock.com. Each email sent is logged in `email_log`, so none goes twice and a failed
day is caught up the next day. Members switch each email off under Email settings in My properties,
or with the Unsubscribe link in any of them (Gmail's and Apple Mail's own unsubscribe button works too).

**Make someone a member:** Supabase → Table editor → `memberships` → Insert row: `user_id` = their
id from Authentication → Users, `active` = true. To stop their emails, set `active` to false.
They need an account with at least one saved property; there's nothing to send otherwise.

**Turn it on (once):**

1. Run `supabase/migrations/0006_owner_emails.sql` in the SQL editor.
2. Resend → API Keys → Create (sending access, domain capexclock.com). In Netlify add
   `RESEND_API_KEY`, `SUPABASE_SECRET_KEY` (Supabase → Project Settings → API Keys → secret key)
   and `OWNER_EMAILS_MODE` = `preview`, then redeploy.
3. Make your own account a member. Netlify → Logs → Functions → owner-emails → **Run now**.
   Every email for every member lands in support@ with "[Preview for …]" in the subject.
4. When they look right, set `OWNER_EMAILS_MODE` to `live` and redeploy. In preview mode the
   previews repeat every day, so don't leave it there.

The function's log shows counts only (sent, failed, left for tomorrow), never addresses.

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

Each Monday, paste these in the thread (about 10 minutes). Claude keeps the tally. Counts step up
the week the [analytics relay](#analytics-relay) goes live, so compare across that week with care.

1. **PostHog:** the numbers on the dashboard below (a screenshot of each tile is fine).
2. **Netlify:** **Forms → paid-interest** and **Forms → early-access**: how many new entries
   since last Monday.
3. **Your inbox:** how many people emailed a photo of a label since last Monday (the photo
   offer), and how many of those you answered.
4. **Supabase:** the weekly query below.
5. **Stripe** (once the links are live): for each Payment Link, the payments since last Monday
   and any refunds (**Payment Links → the link**, or **Payments**). For memberships, also the
   number under **Billing → Subscriptions → Active**. Stripe is the real count of sales.
6. **Once a month, Search Console:** see [Google Search Console](#google-search-console).

### Leave your own visits out

Open any page with `?count-me=off` on the end (for example `https://capexclock.com/?count-me=off`)
once in each browser you use: Safari on your iPhone, and each browser on your Mac. That browser
then never loads PostHog, so none of its pageviews, clicks or events are counted, and the footer
says "Analytics off in this browser". `?count-me=on` turns it back on. It's remembered in that
browser only, and clearing the site's data (or a private window) forgets it. It doesn't remove
anything already recorded.

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
     live (merged on September 28, 2026). "Since step 2" means from the day the Stripe links went
     live.
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
| Buy now | `presale_checkout_clicked`, `presale_completed` (Total count) | `offer` | Since step 2 |
| Pricing page | `$pageview` (Unique users), with a filter on the series: **Current URL** contains `/pricing` | none | Since step 2 |
| Import | `import_started`, `import_completed` (Total count) | none | Since step 4 |
| Import problems | `import_failed` (Total count) | `reason` | Since step 4 |
| Template page | `template_downloaded` (Total count) | `file` | Since step 5 |
| Done-for-you import | `setup_offer_clicked` (Total count) | `where` | From the day this went live |
| Component list downloads | `component_list_exported` (Total count) | `where` | Since step 5 |
| Comparison | `forecast_generated`, `compare_viewed`, `compare_applied` (Unique users), with the two compare events filtered to Path name = `/capex-calculator` | none | Since step 6 |
| Quick estimate | A **Funnels** insight (not Trends): step 1 `quick_estimate_shown`, step 2 `$pageview` filtered to Path name = `/capex-calculator` (Unique users, conversion window 1 hour) | none | Since step 7 |

A new event shows up in the event picker only after it has happened once on the live site. If
one is missing, open the site, use that button once, wait a few minutes and try again. Later
Phase 3 steps add their own rows to this table.

On the **Buy now** tile, `presale_checkout_clicked` counts trips to Stripe: once per click that
leaves for Stripe (a double click is one), and once per Buy now opened in a new tab with a middle,
Ctrl, Cmd or Shift click. Opening it from the right-click menu isn't counted. One click can
count without a trip: in the property editor with unsaved changes, the browser asks "Leave site?"
first, and the click counts even if the owner stays. `presale_completed` counts the thank-you
pages, once per visit. Stripe is the real count of sales; these only rank the two offers.

On the **Import** tile, `import_started` counts imports that got data (rows pasted or a file
chosen), once each time the import panel is used, and `import_completed` counts the ones the
owner added. Import is working when `import_completed` is at least 6 in 10 of `import_started`.
On **Import problems**, `reason` says why a sheet couldn't be read: `too_big` (over 2,000 rows
or 5 MB), `no_header` (no heading row found, or an empty file), `unsupported` (an old .xls, .ods
or Numbers file, or a password-locked one), `forecast_file` (the forecast CSV, which can't be
read back; the owner is told to use the component list instead) or `unreadable`. The events carry
counts and these labels only, never anything from the sheet. To see where imports come from, add
a breakdown on the Import tile: `source` is `paste`, `file` (CSV) or `xlsx`, and `where` is
`calculator`, `editor`, `template_page` or `portfolio` (My properties). Every import event carries
both, so the finish rate can be read for each page. On My properties, `import_completed` is sent
once, when the first property of an import is created: on Create, or on a later "Retry failed"
if the first try saved none (then it has `retry` = true). An import that creates nothing sends no
`import_completed`. Each "Retry failed" also sends `import_retried`, so each import counts once.

On **Template page**, `file` is `template` (the blank template) or `example` (the filled-in
example), and `format` is `xlsx` (Excel) or `csv`. The page itself is checked in Search Console
(below): it should show up in Google results by the check-in. **Component list downloads** counts
"Download component list (Excel)" and "Download component list (CSV)"; `where` is `downloads`
(next to the forecast downloads) or `components` (next to Import), and `format` is `xlsx` or
`csv`. Downloads from before the Excel files were added have no `format`; they were all CSV.

On **Comparison**, filter each compare series: click the filter icon on it, choose **Path name**,
then **equals**, and type `/capex-calculator`. The filter matters because the comparison also
runs in the property editor, while `forecast_generated` is only sent from the public calculator.
The comparison is working when `compare_viewed` is at least a tenth of `forecast_generated`.

**Quick estimate** shows how many people who got a quick estimate on /reserve-calculator went on
to the CapEx calculator in the same visit. In **New insight**, pick **Funnels** instead of
Trends. Add `quick_estimate_shown` as step 1 and `$pageview` as step 2, then filter step 2 to
**Path name** equals `/capex-calculator`. Open **Funnel settings** (below the steps, closed at
first) and set **Conversion window limit** to **1 hour**. The quick estimate is working when at least 1 in 5 people reach step 2.
`quick_estimate_shown` goes once per page view, after an estimate has been on screen for 2
seconds, and carries only `systems`, how many systems were ticked.

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
Also paste `https://capexclock.com/capex-spreadsheet-template` into the **Inspect any URL** box
at the top: "URL is on Google" means the template page is in Google results.

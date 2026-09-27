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

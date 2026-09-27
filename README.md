# CapexClock

Free CapEx forecaster for small rental property owners. Live at capexclock.com.

## Phase 1: early-access landing page

- Next.js (App Router), TypeScript strict, Tailwind v4
- Hosted on Netlify (Next.js runtime is auto-detected; see `netlify.toml`)
- Signups go to the Netlify Form `early-access`

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

### Early-access form

Netlify can't detect forms rendered by React, so `public/__forms.html` holds a
hidden static copy that Netlify registers at deploy. `src/components/SignupForm.tsx`
POSTs to `/__forms.html` as `application/x-www-form-urlencoded`. If you change a
field in one, change it in the other.

Submissions only work on a Netlify deploy (or `netlify dev`), not `next dev`.

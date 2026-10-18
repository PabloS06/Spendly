# Spendly

A minimal, mobile-first budget planner for university students. The home screen answers one question: how much can I spend today, and for the rest of the month?

**Stack:** Next.js 15 (App Router, static export) · TypeScript · Tailwind CSS 4 · Supabase (Auth, Postgres, row-level security) · Lucide icons · Geist font.

The app is fully client-side. It talks to Supabase directly from the browser with the public anon key, and row-level security (`user_id = auth.uid()`) on every table does the access control. The build is a static site (`out/`) you can host anywhere.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Supabase credentials the app runs in **demo mode**: the login screen offers *Try the demo* (fresh start with onboarding) and *Explore with sample data* (six months of realistic student spending). Demo data stays in that browser's localStorage.

`npm run build:preview` bundles the demo into one self-contained file, `preview/dist/spendly.html`, that opens with sample data (used for the shareable preview).

Other scripts: `npm run build` (static export to `out/`), `npm test` (unit tests for budget maths, dates, money parsing, import and CSV), `npm run typecheck`.

## Connect Supabase

1. Create a project at supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql` (tables, indexes, RLS policies, and the `delete_my_account()` function).
3. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project settings → API).
4. Authentication → URL configuration: set the Site URL to where the app runs and add `<site>/auth/callback/` to the redirect URLs.
5. Google sign-in: Authentication → Providers → Google, paste a Google Cloud OAuth client ID and secret, and add Supabase's callback URL to the Google client.

Email sign-up sends a confirmation email by default (Supabase setting).

## How it fits together

| Path | What it is |
| --- | --- |
| `src/lib/types.ts` | Row types (money is integer cents everywhere) |
| `src/lib/budget.ts` | Pure budget maths: period summary, safe-to-spend per day, 80%/over status, suggested split, upcoming fixed costs, description memory |
| `src/lib/dates.ts` | Budget periods with a configurable month start day; DD/MM/YYYY formatting |
| `src/lib/insights.ts` | Rule-based observations and 6-month totals |
| `src/lib/importer.ts`, `csv.ts` | Header detection, column mapping, date/amount parsing; CSV export |
| `src/lib/backend.ts` | `Backend` interface with Supabase and demo (localStorage) implementations |
| `src/lib/data.tsx` | In-memory snapshot, optimistic saves, first-login bootstrap, month rollover |
| `src/app/*` | Screens: login, onboarding (also used to edit income/fixed/savings/plan from Settings), home, activity, insights, rollover, settings, import |

**Month rollover.** On load, if the current period has no month row, one is created and the latest plan is copied into it. If the previous month hasn't been summarised, the app shows its summary (under/over per category, total saved) and asks whether the leftover goes to savings or into this month (`months.carry_in`).

**Remaining this month** = plan total + carry-in − spent this period. Fixed costs and savings are reserved before the plan, so they don't count against it. **Per day** = remaining ÷ days left including today.

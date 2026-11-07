# Crazy Rep—AI calorie tracker

Snap a photo of your meal and get calories, protein, carbs, fat, fiber, sugar, saturated fat, sodium and cholesterol in seconds. Built with Next.js 16, Tailwind CSS v4, shadcn/ui, Zod, Supabase (auth, Postgres and storage) and Google Gemini Flash. It runs on the web (Vercel) and installs from the browser as an app on Android and iPhone (PWA).

📐 **How it works:** see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for diagrams of the system, meal lookup, coach and data model.

## Features

- **AI meal logging** (`/scan`): only the meal name is required. Portion, notes and a photo are optional; a photo improves accuracy. You get per-item and total nutrition, a health score, a confidence score and tips, and can rename the meal, change servings, remove wrong items and choose the meal type before logging it.
- **Meal lookup (no photo):** exact saved result → similar saved result (pgvector vector search plus word checks) → [USDA FoodData Central](https://fdc.nal.usda.gov) → Gemini. `analysis_cache` is the single source of truth, and every USDA and AI answer is saved back with an embedding. Photo analyses always use Gemini.
- **Activity, weight and water:** log workouts (calories from 2024 Compendium MET values × your weight), daily weigh-ins (which keep your profile weight current) and water. The dashboard shows burned and net calories.
- **Coach** (`/coach`): a chat assistant that answers questions about your own data using read-only tools (profile, summaries, meals, activities, weights) that run under your login, so row-level security applies. Limited to `CHAT_DAILY_LIMIT` messages per day.
- **Today dashboard** (`/dashboard`): a calorie ring against your goal, macro progress bars, % daily value for the other nutrients, meals grouped by breakfast, lunch, dinner and snack, plus a day picker. Tap a meal to edit servings or meal type, or to delete it.
- **History** (`/history`): 7d, 30d, 90d, 1y and 5y ranges, computed in the database by `history_summary()` (day, week or month buckets in your timezone): calories against your goal, weight trend, burned calories, water and a breakdown table.
- **Profile and goals** (`/profile`): enter sex, age, height, weight, activity level and goal, then apply recommended calorie and macro targets (Mifflin–St Jeor). You can also sign out or permanently delete your account.
- **Auth**: email and password sign-up with email confirmation, password reset, and optional Google sign-in.
- **PWA**: installable from the browser on Android and iPhone, with app icons and a manifest.
- **Profile in tabs**: Body (including diet), Targets, Prefs (reminders and themes) and Account, with a sticky tab bar, a profile header and a big calorie control with a live macro split. The tab you're on is kept in the address (`?tab=targets`).
- **Onboarding**: new users answer five quick questions (goal, sex, body numbers, activity, diet) and get a daily plan to confirm. Most steps are one tap and the body numbers start from typical values. Nobody can use the app until it's done (`ProfileGate`).
- **Tabs ready ahead**: a couple of seconds after the app opens, the other tabs' code and first data (History's default range, Log meal's name suggestions, the coach list and latest chat) load quietly in the background, one request at a time. Skipped offline, on a slow connection or with Data Saver on.
- **Log for another day**: a "Logging for Today" chip on the Log meal screen opens a date picker. Add buttons on a past day of the dashboard pass that day along, and a meal for an earlier day is saved at a usual time for its type.
- **Add missed items**: on the results screen (and when editing a logged meal), type an item the way you'd say it ("2 rotis", "1 cup rice", "paneer 100g"). It's looked up like the meal name: saved results, vector search, USDA, then AI.
- **Meal reminders**: push notifications at breakfast, lunch and dinner (times are set per user in Profile, in their own timezone). Skipped when that meal is already logged. Sent by `pg_cron` calling the app once an hour. Needs one-time setup, see below.
- **Offline reading**: the app opens without a connection and shows the last data it fetched (today, the last 7 days of history, saved coach chats, the profile). Logging, editing and the coach are paused until the connection returns. Themes still work offline.
- **Landing page** (`/`): what the app does today, plus a **Request access** form. Requests are saved to `access_requests` (one per email, server-only); approve someone by adding their email to the `sign-in-users` flag.

## Project layout

```
app/
  page.tsx                 Marketing landing page
  login/, reset-password/  Auth screens
  (tracker)/               Signed-in app (dashboard, scan, history, profile)
  api/analyze/route.ts     Verifies the session; photo → Gemini, name only → cache or Gemini
  api/account/route.ts     Deletes the user, their photos and data
  auth/confirm/route.ts    Email confirmation and password-reset landing
  manifest.ts, icons/      PWA manifest and generated PNG icons
components/
  ui/                      shadcn/ui components (Tailwind)
  form-fields.tsx          react-hook-form + zod fields built on shadcn Field
lib/
  schemas.ts               Zod schemas: forms, API input, AI output, database writes
  gemini.ts                Photo and text prompts, model fallback chain, response validation
  vector-lookup.ts         Hybrid pgvector + text search over analysis_cache
  embeddings.ts            Gemini embeddings (768 dims)
  usda.ts                  USDA FoodData Central lookup with strict matching and portion mapping
  meal-lookup.ts           Exact → similar (vector) → USDA → AI pipeline for meals without a photo
  coach.ts                 Coach tools, timezone handling and tool-calling loop
  activities.ts            Activity types and MET values
  analysis-cache.ts        Saved text-only results (server-only, uses the secret key)
  nutrition.ts             Goal calculator and nutrient math
  supabase/                Browser, server and proxy clients
proxy.ts                   Refreshes the session and protects app routes
supabase/migrations/        Versioned schema (tables, RLS, storage bucket, triggers)
public/sw.js               Service worker (caches pages and app files so the app opens offline)
lib/offline.ts             Online hook and the on-device copy of fetched data (localStorage)
```

---

## 1. Create your Supabase project and keys

1. Go to <https://supabase.com>, sign in and click **New project**. Choose a name, a strong database password and the region closest to your users. Wait about 2 minutes for it to provision.
2. **Create the tables with migrations:** see [Database migrations](#database-migrations) below. The first migration creates:
   - `profiles`: one row per user, with goals and body metrics (created automatically on sign-up)
   - `meals`: every logged meal with full nutrition and detected items
   - `meal-images`: a private storage bucket, with one folder per user
   - Row-level security policies, so each user can only read or write their own data
3. **Get the API keys:** open **Project Settings → API Keys** (or click **Connect** at the top).
   - Copy the **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`.
   - Copy the **Publishable key** (`sb_publishable_…`) into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Older projects can use the legacy **anon** key.
   - Copy the **Secret key** (`sb_secret_…`) into `SUPABASE_SECRET_KEY`. Older projects can use **service_role**. Keep it server-only; never prefix it with `NEXT_PUBLIC_`.
4. **Configure auth URLs:** open **Authentication → URL Configuration**.
   - **Site URL**: `http://localhost:3001` for now. Change it to your Vercel URL after deploying.
   - **Redirect URLs**: add `http://localhost:3001/**` and later `https://YOUR-APP.vercel.app/**`.
5. *(Optional)* To skip email confirmation while testing, turn off **Confirm email** under **Authentication → Sign In / Providers → Email**. Supabase's built-in email sender is rate-limited, so for production add custom SMTP (for example Resend) under **Authentication → Emails → SMTP Settings**.

### Database migrations

The schema is managed with the [Supabase CLI](https://supabase.com/docs/guides/deployment/database-migrations), which is installed as a dev dependency. Migrations live in `supabase/migrations/` and are applied straight to your hosted project. Docker isn't needed.

**One-time setup:**

```bash
npm run db:login   # opens the browser to authorize the CLI
npm run db:link    # pick your project; enter the database password when asked
```

**Apply migrations:**

```bash
npm run db:status  # shows local vs remote migrations
npm run db:push    # applies any migrations the remote database doesn't have yet
```

**Change the schema later:**

```bash
npm run db:new add_water_tracking   # creates supabase/migrations/<timestamp>_add_water_tracking.sql
# write your SQL in that file, then:
npm run db:push
```

Never edit a migration that has already been pushed; always add a new one.

**Automatic deploys (GitHub Actions):** `.github/workflows/supabase-migrations.yml` runs `supabase db push` whenever a change under `supabase/migrations/` lands on `main`. Add these repository secrets under **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens> → **Generate new token** |
| `SUPABASE_PROJECT_ID` | The project ref: the `abcd…` part of `https://abcd….supabase.co` |
| `SUPABASE_DB_PASSWORD` | The database password you set when creating the project |

## 2. Create your Gemini API key (free tier)

1. Go to <https://aistudio.google.com/apikey> and sign in with a Google account.
2. Click **Create API key**, then choose or create a Google Cloud project. No billing is needed for the free tier.
3. Copy the key into `GEMINI_API_KEY`.

> Free-tier limits are per project and change from time to time; check them at <https://ai.google.dev/gemini-api/docs/rate-limits>. When the limit is hit, the app shows "The AI is busy right now…". To use different models later, set `GEMINI_MODEL` (default `gemini-3.8-flash`) and `GEMINI_FALLBACK_MODELS` (tried in order when the main model is busy, used up for the day or retired).
>
> Each model has its own free quota, so a longer list is more capacity. On the free tier the full Flash models allow only about 20 requests a day and 5 a minute, while the Flash Lite models allow 500 a day and 15 a minute. That is why the defaults try the full Flash models first and fall back to Flash Lite. The coach makes several calls per message, so it has its own list (`COACH_MODEL`, `COACH_FALLBACK_MODELS`) that starts on Flash Lite. Check your own limits in Google AI Studio under Rate limits.
>
> On the free tier, Google may use prompts and images to improve its products. Mention this in your privacy policy, or enable billing (the paid tier) to opt out.

## 2b. Create your USDA FoodData Central key (free)

1. Go to <https://fdc.nal.usda.gov/api-key-signup>, enter your name and email, and submit.
2. The key arrives by email. Copy it into `USDA_API_KEY`. The default limit is 1,000 requests per hour.

Without a key, the app uses the shared `DEMO_KEY` (30 requests per hour) and falls back to Gemini when it runs out. USDA data is public domain (CC0); the app shows "Source: USDA FoodData Central" as USDA requests.

## 3. Run locally

```bash
cp .env.example .env.local   # then fill in the 4 keys
npm install
npm run dev                  # http://localhost:3001
```

Sign up, complete your profile, then go to **Scan** and upload a meal photo.

## 4. Deploy to Vercel

1. Push this repo to GitHub.
2. At <https://vercel.com/new>, import the repo. The framework is detected as Next.js automatically.
3. Under **Environment Variables**, add the same keys from `.env.local`:
   - Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `USDA_API_KEY`
   - Optional: `GEMINI_MODEL`, `GEMINI_FALLBACK_MODELS`, `COACH_MODEL`, `COACH_FALLBACK_MODELS`, `EMBEDDING_MODEL`, `CHAT_DAILY_LIMIT`, `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH`
4. Click **Deploy**.
5. Back in Supabase, open **Authentication → URL Configuration**, set **Site URL** to `https://YOUR-APP.vercel.app` and add `https://YOUR-APP.vercel.app/**` to **Redirect URLs**.

The analysis route sets `maxDuration = 60`, which fits the Vercel Hobby plan. Photos are resized in the browser to 1280 px JPEG before upload, so requests stay well under Vercel's 4.5 MB body limit.

## Meal reminders

Reminders are Web Push notifications. They work in the installed app on Android, and on iPhone (iOS 16.4 or later) once the app is added to the Home Screen.

One-time setup:

1. Generate the push keys: `npx web-push generate-vapid-keys`.
2. Add these in Vercel (and `.env.local` to try it locally), then redeploy:
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (a `mailto:` address) and `REMINDERS_SECRET` (any long random string, for example `openssl rand -hex 32`).
3. Push the migration (the GitHub Action does this on merge). It creates the tables, turns on `pg_cron` and `pg_net`, and schedules a job named `meal-reminders` that runs once an hour, plus a daily job (`cron-history-cleanup`) that keeps only the last 3 days of `cron.job_run_details` so the history never bloats.
4. Tell the database where the app is. Run this once in the Supabase SQL editor (the secret must match `REMINDERS_SECRET`; both values live in Vault, never in the repo):

   ```sql
   select vault.create_secret('https://YOUR-DOMAIN/api/reminders/send', 'reminders_url');
   select vault.create_secret('THE-SAME-VALUE-AS-REMINDERS_SECRET', 'reminders_secret');
   ```

   Until both exist the job quietly does nothing. To change one later, update it in Dashboard → Vault.

Check it: in the app, open Profile → Meal reminders, switch it on and tap **Send a test**. To see the scheduler working, look at `select * from cron.job_run_details order by start_time desc limit 5;` and `select * from net._http_response order by created desc limit 5;`.

How it works: once an hour `pg_cron` calls `/api/reminders/send` with the secret. The app (`lib/reminders-run.ts`) finds users whose reminder time has arrived in their own timezone, skips meals they've already logged today, and sends the push. Because the job runs once an hour, a reminder arrives on the first run at or after its time, so up to an hour late. A reminder is still sent for up to 90 minutes after its time, so one missed run doesn't lose it, and `last_sent` stops it going out twice in a day.

## 5. Optional: Google sign-in

1. In the Google Cloud Console, go to **APIs & Services → Credentials → Create credentials → OAuth client ID**, application type **Web application**.
   - **Authorized redirect URI**: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
2. In Supabase, open **Authentication → Sign In / Providers → Google**, enable it and paste the client ID and secret.
3. Set `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true` in Vercel and redeploy.

## 5b. Optional: LaunchDarkly feature flags

Two flags control who can use the app and who is an admin, without a redeploy. Without LaunchDarkly keys, everyone can sign in and nobody is an admin.

1. Create a free account at <https://launchdarkly.com>. In **Project settings → Environments**, copy the **Client-side ID** and the **SDK key** for your environment.
2. Add them to `.env.local` (and Vercel): `NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID` and `LAUNCHDARKLY_SDK_KEY`. Restart `npm run dev`.
3. Create these boolean flags with the exact keys, and tick **SDKs using Client-side ID** on both.

| Flag key | Serve `true` to | When `false` |
| --- | --- | --- |
| `sign-in-users` | Users allowed to sign up and use the app (master switch) | Sign-up is refused and the person is sent to **Request access** on the landing page with their email filled in. Someone already signed in is signed out and sent there too. |
| `admin-users` | Admins | No **API test** tab in the sidebar; its page and API return "not allowed" |

Every signed-in user is sent to LaunchDarkly as a `user` context: the key is their Supabase user ID, and `email` is private (usable in rules, not stored). Examples:
- Allow only some people: set `sign-in-users` to serve `false` by default, with a rule "email is one of …" serving `true`.
- Make admins: in `admin-users`, add a rule "email is one of …" serving `true`.

Before creating an account, the sign-up form asks `/api/signup-check`. People without an account are evaluated with a hashed-email key, so **target them by email**, not by user key. After sign-in, the flag is checked on every page and API request (`proxy.ts`) and live in the browser, which also covers Google sign-in. Keep yourself in both flags' `true` rules so you can't lock yourself out.

## 6. Install as an app

The web app is a PWA, so people can install it from the browser and it opens full-screen like a normal app:
- **Android (Chrome):** open your Vercel URL, then **⋮ → Install app** (or **Add to Home screen**).
- **iPhone (Safari):** open your Vercel URL, then **Share → Add to Home Screen**.

Updates ship automatically with each Vercel deploy.

## Filling the food cache (10,000+ dishes)

The repo ships dish data in `data/`. One script loads it into `analysis_cache` with embeddings, so most meals never need an AI call.

```bash
npm run db:push                                        # applies the vector-search migration (pgvector)
npm run cache:enrich -- --dry-run                      # shows what would be added
npm run cache:enrich                                   # seed real data, AI nutrition for the catalogue, embed all rows
npm run cache:enrich -- --steps generate --target 10000   # add AI-generated regional dish names
npm run cache:enrich -- --steps nutrition,embed        # then estimate and embed them
```

| Step | What it does | AI cost |
| --- | --- | --- |
| `seed` | 1,014 INDB dishes and IFCT 2017 foods (fruit, dairy, oils, nuts, sugar) | None |
| `generate` | Asks Gemini for regional dish names (about 47 cuisines × 8 courses) until the catalogue reaches `--target` | ~1 call per cuisine and course |
| `nutrition` | Gemini estimates one typical serving for each uncached dish, 40 per call | ~1 call per 40 dishes |
| `embed` | Embeds every row without an embedding, 50 per call | Free tier allows ~1,000 rows a day |

Options: `--limit N` (dishes per run), `--batch 40`, `--rpm 10` (AI calls per minute), `--force` (overwrite), `--dry-run`.

The script is safe to stop and re-run; finished rows are skipped. If the daily Gemini quota runs out it stops cleanly, so run it again after the quota resets (midnight Pacific time).

To refresh the source data: `npm run data:build` (downloads INDB, IFCT 2017, the Archana's Kitchen dataset and Wikipedia's list of Indian dishes, then rewrites `data/*.json`).

**Data sources:** [Indian Nutrient Databank (INDB)](https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-), Vijayakumar et al., *Curr Dev Nutr* 2024 · [IFCT 2017](https://github.com/ifct2017/compositions), ICMR-NIN · [6000+ Indian Food Recipes Dataset](https://github.com/kanishk307/IndianFoodDatasetGeneration), Archana's Kitchen (names only) · [Wikipedia, List of Indian dishes](https://en.wikipedia.org/wiki/List_of_Indian_dishes) (CC BY-SA 4.0). Check each source's terms before commercial use.

## Environment variables

| Variable | Where to get it | Exposed to browser |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API Keys | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Publishable (or anon) key | Yes |
| `SUPABASE_SECRET_KEY` | Supabase → Secret (or service_role) key | **No** |
| `GEMINI_API_KEY` | Google AI Studio | **No** |
| `GEMINI_MODEL` | Optional, default `gemini-3.8-flash` | No |
| `GEMINI_FALLBACK_MODELS` | Optional, comma-separated, default `gemini-3.6-flash,gemini-3.1-flash-lite,gemini-3.5-flash-lite` | No |
| `COACH_MODEL` | Optional, the coach's first model, default `gemini-3.1-flash-lite` | No |
| `COACH_FALLBACK_MODELS` | Optional, comma-separated, default `gemini-3.5-flash-lite,gemini-3.8-flash,gemini-3.6-flash` | No |
| `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` | `true` once Google is configured | Yes |
| `EMBEDDING_MODEL` | Optional, default `gemini-embedding-001` (768 dims; re-embed if you change it) | No |
| `USDA_API_KEY` | <https://fdc.nal.usda.gov/api-key-signup> (free) | **No** |
| `CHAT_DAILY_LIMIT` | Optional, default `30` coach messages per user per day | No |
| `NEXT_PUBLIC_LAUNCHDARKLY_CLIENT_ID` | Optional, LaunchDarkly → Project settings → Environments → Client-side ID | Yes (public by design) |
| `LAUNCHDARKLY_SDK_KEY` | Optional, LaunchDarkly → Project settings → Environments → SDK key | **No** |

## Scripts

```bash
npm run dev     # local dev server
npm run build   # production build
npm run start   # serve the production build
npm run lint    # ESLint
```

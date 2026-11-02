# Architecture

Crazy Rep is one Next.js app on Vercel. It uses Supabase for login, data and photos, Gemini for AI, and USDA for free nutrition data. The same web app runs in the browser and as an installed app (PWA).

## The big picture

```mermaid
flowchart LR
    U["📱 User<br/>Browser · installed PWA"]

    subgraph Vercel["Vercel · Next.js 16"]
        P["proxy.ts<br/>refreshes session,<br/>guards app pages"]
        UI["App pages<br/>Today · History · Log · Coach · Profile"]
        API["API routes<br/>/api/analyze · /api/chat · /api/account"]
    end

    subgraph Supabase
        AUTH["Auth"]
        DB[("Postgres<br/>+ row-level security")]
        ST[("Storage<br/>meal photos")]
    end

    G["🤖 Google Gemini"]
    USDA["🏛 USDA FoodData Central"]

    U --> P --> UI
    UI -- "reads and writes own data" --> DB
    UI -- "uploads photos" --> ST
    UI --> API
    API --> AUTH
    API --> DB
    API --> G
    API --> USDA
```

**Rule of thumb:** simple reads and writes go straight from the browser to Supabase, where row-level security keeps each user to their own rows. Anything that needs a secret key (Gemini, USDA, account deletion) goes through an API route.

## Logging a meal

The meal name is required; the portion, notes and photo are optional. `analysis_cache` is the **single source of truth**: every answer from USDA or the AI is saved back with an embedding, so the cache keeps growing and AI calls keep shrinking.

```mermaid
flowchart TD
    A["User submits meal"] --> B{"Photo?"}
    B -- Yes --> G1["Gemini reads the photo"]
    B -- No --> C{"Exact saved result?<br/>same name, portion, notes"}
    C -- Yes --> R["Result"]
    C -- No --> V{"Similar saved result?<br/>pgvector + text search + word checks"}
    V -- Yes --> R
    V -- No --> D{"Confident USDA match?"}
    D -- Yes --> S["Save to analysis_cache<br/>+ embedding (after response)"]
    D -- No --> G2["Gemini estimates from the text"]
    G2 --> S
    S --> R
    G1 --> R
    R --> E["User reviews and logs the meal"]
```

**Similar results** use hybrid matching, because similarity alone can't tell chicken biryani from mutton biryani:

1. Vector neighbours (`match_analysis_cache`, cosine, HNSW index) plus rows whose name or aliases contain the typed text.
2. A row is reused only if every typed word is present (small typos allowed), there's no key-ingredient clash (chicken vs mutton), and similarity ≥ 0.70 or the name or alias matches exactly.
3. Close calls between different dishes count as ambiguous and fall through to USDA or the AI.
4. The stored serving is scaled to the user's portion ("2 bowls", "150 g").

### Filling the cache in bulk

```mermaid
flowchart LR
    INDB["INDB<br/>1,014 Indian dishes"] --> B1["npm run data:build"]
    IFCT["IFCT 2017<br/>NIN raw foods"] --> B1
    AK["Archana's Kitchen<br/>6,800 recipes"] --> B1
    W["Wikipedia<br/>Indian dishes"] --> B1
    B1 --> F["data/*.json<br/>(committed)"]
    F --> E["npm run cache:enrich"]
    GEN["Gemini: more regional<br/>dish names"] --> E
    E -- "seed (real data) · nutrition (AI, batched) · embed" --> DB[("analysis_cache")]
```

## Coach chat

The coach answers questions using read-only tools that run **under the user's own login**, so it can only ever see that user's data.

```mermaid
sequenceDiagram
    participant U as User
    participant C as /api/chat
    participant G as Gemini
    participant DB as Supabase (as the user)

    U->>C: "How is my weight trending?"
    C->>C: check login and daily limit
    C->>G: question, recent messages of this chat, tool list
    G-->>C: call list_weights(Oct 1–31)
    C->>DB: select weight_logs
    DB-->>C: rows (own data only)
    C->>G: tool result
    G-->>C: final answer (markdown)
    C->>DB: save both messages (a new chat is created with the first answer)
    C-->>U: answer
```

Tools: `get_profile`, `get_summary`, `list_meals`, `list_activities` and `list_weights`.

The profile's `diet` (vegetarian by default, or eggetarian, non-vegetarian or vegan) is in the coach's instructions, so every food or recipe it suggests fits. The same setting picks the starter dish ideas on the scan screen and drives a gentle heads-up when a logged meal contains something the diet rules out. It also shapes a meal's insights: photo analyses are told the diet, and text analyses (whose results are cached and shared) have their tips fitted to the diet on each response, so one person's diet never reaches another person's tips.

Each user can keep several conversations (`chat_threads`). The coach only sees the messages of the open conversation, the daily message limit counts across all of them, and deleting a conversation deletes its messages.

## Data model

```mermaid
erDiagram
    USERS ||--|| PROFILES : has
    USERS ||--o{ MEALS : logs
    USERS ||--o{ ACTIVITY_LOGS : logs
    USERS ||--o{ WEIGHT_LOGS : logs
    USERS ||--o{ WATER_LOGS : logs
    USERS ||--o{ CHAT_THREADS : starts
    CHAT_THREADS ||--o{ CHAT_MESSAGES : contains

    PROFILES {
        text diet
        int calorie_goal
        int protein_goal_g
        numeric weight_kg
        int water_goal_ml
    }
    MEALS {
        text name
        text meal_type
        numeric calories
        jsonb items
        text image_path
        text source
    }
    ACTIVITY_LOGS {
        text activity
        text intensity
        int duration_min
        numeric calories_burned
    }
    WEIGHT_LOGS {
        date logged_on
        numeric weight_kg
    }
    WATER_LOGS {
        timestamptz logged_at
        int ml
    }
    CHAT_THREADS {
        text title
        timestamptz updated_at
    }
    CHAT_MESSAGES {
        text role
        text content
    }
    ANALYSIS_CACHE {
        text cache_key
        jsonb analysis
        text source
        vector embedding
    }
    ACCESS_REQUESTS {
        text email
        text name
        text status
    }
```

- `analysis_cache` isn't tied to a user, and only the server can access it.
- `access_requests` holds emails from the landing page **Request access** form (one row per email). Only the server can read or write it.
- `history_summary()` adds up meals, activity, water and weight per **day, week or month** in the user's timezone. That's how History covers 5 years quickly.
- A trigger keeps `profiles.weight_kg` in step with the latest weigh-in.
- Schema changes live in `supabase/migrations/` and are applied with `npm run db:push` (or automatically by the GitHub Action).

## Security at a glance

| Layer | What protects it |
| --- | --- |
| Pages | `proxy.ts` sends signed-out users to `/login` |
| Data | Row-level security on every user table |
| Photos | Private bucket; one folder per user |
| Secrets | Gemini, USDA and Supabase secret keys stay on the server |
| Input | Zod on every form, API body and AI response |
| AI quota | Model fallback, a daily chat limit and saved results |
| Admin tools | The **API test** tab (`/api-test`) is visible only to admins (`admin-users` flag); its API returns 403 for everyone else |
| Feature flags | LaunchDarkly `sign-in-users` (who can use the app, checked in `proxy.ts` on every request) and `admin-users` (who sees and can call admin tools). Users are sent as a `user` context keyed by user ID; email is private and used in targeting rules. |

## Where things live

```
app/
  (tracker)/       signed-in app: dashboard, scan, history, coach, profile
  api/             analyze, chat, account, admin/food-test
  login/ …         auth screens, privacy, landing page
components/ui/     shadcn/ui components
lib/
  schemas.ts       all Zod schemas
  meal-lookup.ts   exact → similar (vector) → USDA → Gemini
  vector-lookup.ts hybrid pgvector + text matching
  embeddings.ts    Gemini embeddings (768 dims)
  usda.ts          USDA matching and portions
  gemini.ts        prompts and model fallback
  coach.ts         coach tools and chat loop
  flags.ts         LaunchDarkly flag keys, defaults and user context (flags-server.ts for API routes)
  supabase/        browser, server and proxy clients
supabase/migrations/   database schema history
scripts/               data builders and the cache enrich script
data/                  dish catalogue and Indian food data (inputs for enrich)
```

## Tech stack

Next.js 16 · React 19 · Tailwind CSS v4 · shadcn/ui · Zod · react-hook-form · Supabase · Google Gemini · USDA FoodData Central · LaunchDarkly · Vercel

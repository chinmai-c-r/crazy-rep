import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { backfillMeals, isConfigured } from "@/lib/google-health";
import { createClient } from "@/lib/supabase/server";

const BATCH = 20;
// How far back to look: a number of days, or null for everything
const bodySchema = z.object({ days: z.number().int().min(1).max(3650).nullable() });

const since = (days: number | null) => (days === null ? null : new Date(Date.now() - days * 86_400_000).toISOString());

async function pending(supabase: Awaited<ReturnType<typeof createClient>>, from: string | null) {
  let q = supabase.from("meals").select("id", { count: "exact", head: true }).is("google_health_id", null);
  if (from) q = q.gte("eaten_at", from);
  return (await q).count ?? 0;
}

/** How many meals in the range haven't been sent to Google Health yet. */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("days");
  const parsed = bodySchema.safeParse({ days: raw === "all" ? null : Number(raw) });
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json({ pending: await pending(supabase, since(parsed.data.days)) });
}

/** Sends one batch of unsent meals. The browser calls this until `pending` reaches 0. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ error: "Google Health sync isn't set up." }, { status: 503 });

  const from = since(parsed.data.days);
  // Read through the user's session so row-level security proves the meals are theirs
  const unsent = () => {
    let q = supabase.from("meals").select("*").is("google_health_id", null);
    if (from) q = q.gte("eaten_at", from);
    return q;
  };

  const result = await backfillMeals(
    userId,
    async (limit) => (await unsent().order("eaten_at", { ascending: true }).limit(limit)).data ?? [],
    BATCH,
  );
  if (result === null) return NextResponse.json({ error: "Google Health isn't connected." }, { status: 409 });
  if (result === "busy") return NextResponse.json({ error: "A sync is already running." }, { status: 429 });

  return NextResponse.json({ ...result, pending: await pending(supabase, from) });
}

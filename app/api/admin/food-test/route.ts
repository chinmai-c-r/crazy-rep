import { NextResponse } from "next/server";
import { boolFlag } from "@/lib/flags-server";
import { cacheKey, getCachedAnalysis } from "@/lib/analysis-cache";
import { providerOf } from "@/lib/meal-lookup";
import { analyzeFieldsSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import { debugUsda } from "@/lib/usda";
import { debugVector } from "@/lib/vector-lookup";

/** Admin-only: runs every lookup step for a meal without calling the AI or writing anything. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!(await boolFlag("admin-users", { id: auth.claims.sub, email: auth.claims.email }))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = analyzeFieldsSchema.safeParse({ name: body?.name ?? "", portion: body?.portion, notes: body?.notes });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const ctx = parsed.data;

  const started = Date.now();
  const [exact, vector, usda] = await Promise.all([getCachedAnalysis(cacheKey(ctx), { touch: false }), debugVector(ctx), debugUsda(ctx)]);
  const appWouldUse = exact
    ? `Saved result (exact) · ${providerOf(exact.source, exact.model)}`
    : vector.match
      ? `Saved result (similar: ${vector.match.matchedName}) · ${providerOf(vector.match.source)}`
      : usda.match
        ? "USDA"
        : "AI (Gemini)";

  return NextResponse.json({
    appWouldUse,
    tookMs: Date.now() - started,
    exact: exact ? { source: exact.source, calories: exact.analysis.totals.calories } : null,
    vector,
    usda,
  });
}

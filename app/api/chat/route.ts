import { NextResponse } from "next/server";
import { coachReply, type ChatTurn } from "@/lib/coach";
import { chatRequestSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const maxDuration = 60;

/** Messages per user per rolling 24 hours (protects the free AI quota). */
const DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT) || 30;
const HISTORY_TURNS = 12;

export async function POST(request: Request) {
  const db = await createClient();
  const { data: auth } = await db.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Please sign in to chat." }, { status: 401 });

  const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message." }, { status: 400 });
  }
  const { message, tz } = parsed.data;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from("chat_messages").select("id", { count: "exact", head: true }).eq("role", "user").gte("created_at", since);
  const used = count ?? 0;
  if (used >= DAILY_LIMIT) {
    return NextResponse.json({ error: `You've reached today's limit of ${DAILY_LIMIT} messages. Try again tomorrow.`, remaining: 0 }, { status: 429 });
  }

  const [{ data: recent }, { data: profile }] = await Promise.all([
    db.from("chat_messages").select("role, content").order("created_at", { ascending: false }).limit(HISTORY_TURNS),
    db.from("profiles").select("*").maybeSingle(),
  ]);
  const history = ((recent ?? []) as ChatTurn[]).reverse();

  let reply: string;
  try {
    reply = await coachReply({ db, tz, profile: profile as Profile | null, history, message });
  } catch (err) {
    console.error("coach failed", err);
    const status = (err as { status?: number }).status;
    const busy = status === 429 || status === 503 || ["TimeoutError", "AbortError"].includes((err as Error).name);
    return NextResponse.json(
      { error: busy ? "The coach is busy right now. Please try again in a minute." : "Something went wrong. Please try again." },
      { status: busy ? 429 : 502 },
    );
  }

  const now = Date.now();
  const { data: saved, error } = await db
    .from("chat_messages")
    .insert([
      { user_id: userId, role: "user", content: message, created_at: new Date(now).toISOString() },
      { user_id: userId, role: "assistant", content: reply.slice(0, 20000), created_at: new Date(now + 1).toISOString() },
    ])
    .select("id, role, content, created_at");
  if (error) console.error("chat save failed", error.message);

  return NextResponse.json({ messages: saved ?? [], reply, remaining: DAILY_LIMIT - used - 1 });
}

import { connection, NextResponse } from "next/server";
import { z } from "zod";
import { isPushEndpoint } from "@/lib/push-server";
import { createAdmin, createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint, "Not a push service address"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Saves this device's push subscription for the signed-in user. */
export async function POST(request: Request) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid subscription" }, { status: 400 });

  // The server writes it so a device that was last used by someone else moves to this account
  const { error } = await createAdmin()
    .from("push_subscriptions")
    .upsert(
      { user_id: data.user.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth, user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null },
      { onConflict: "endpoint" },
    );
  if (error) return NextResponse.json({ error: "Couldn't save this device." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** Forgets this device (the user's own rows only, enforced by row-level security). */
export async function DELETE(request: Request) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}

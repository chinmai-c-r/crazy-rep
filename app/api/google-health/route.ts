import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/google-health";
import { createAdmin, createClient } from "@/lib/supabase/server";

async function userId() {
  const { data } = await (await createClient()).auth.getClaims();
  return data?.claims?.sub ?? null;
}

/** Whether Google Health sync is available, and whether this user has connected it. */
export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isConfigured()) return NextResponse.json({ configured: false, connected: false });

  const { data } = await createAdmin().from("google_health_connections").select("user_id").eq("user_id", id).maybeSingle();
  return NextResponse.json({ configured: true, connected: Boolean(data) });
}

/** Disconnects Google Health. Meals already synced stay in Google Health. */
export async function DELETE() {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createAdmin();
  const { error } = await admin.from("google_health_connections").delete().eq("user_id", id);
  if (error) return NextResponse.json({ error: "Could not disconnect. Please try again." }, { status: 500 });
  // Without a connection the stored entry ids are no use
  await admin.from("meals").update({ google_health_id: null }).eq("user_id", id).not("google_health_id", "is", null);
  return NextResponse.json({ ok: true });
}

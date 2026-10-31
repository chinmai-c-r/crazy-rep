import { NextResponse } from "next/server";
import { accessRequestSchema } from "@/lib/schemas";
import { createAdmin } from "@/lib/supabase/server";

/** Public: saves an access request from the landing page. Same answer for new and repeat emails. */
export async function POST(request: Request) {
  const parsed = accessRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { email, name, message, website } = parsed.data;
  // Bots fill the hidden field; pretend it worked
  if (website) return NextResponse.json({ ok: true });

  const { error } = await createAdmin()
    .from("access_requests")
    .upsert({ email, name: name || null, message: message || null }, { onConflict: "email", ignoreDuplicates: true });
  if (error) {
    console.error("access request failed", error.message);
    return NextResponse.json({ error: "Couldn't save your request. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

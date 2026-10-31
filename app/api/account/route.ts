import { NextResponse } from "next/server";
import { createAdmin, createClient } from "@/lib/supabase/server";

/** Permanently deletes the signed-in user, their photos and (via cascade) all their data. */
export async function DELETE() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const admin = createAdmin();
  const bucket = admin.storage.from("meal-images");
  for (;;) {
    const { data: files } = await bucket.list(userId, { limit: 100 });
    if (!files?.length) break;
    const { error } = await bucket.remove(files.map((f) => `${userId}/${f.name}`));
    if (error) break;
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("delete user failed", error);
    return NextResponse.json({ error: "Could not delete account. Please try again." }, { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}

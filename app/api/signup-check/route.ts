import { NextResponse } from "next/server";
import { canSignUp } from "@/lib/flags-server";
import { signupCheckSchema } from "@/lib/schemas";

/** Public: whether an email may create an account (sign-in-users flag). The login page calls it before signing up. */
export async function POST(request: Request) {
  const parsed = signupCheckSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email." }, { status: 400 });
  }
  return NextResponse.json({ allowed: await canSignUp(parsed.data.email) });
}

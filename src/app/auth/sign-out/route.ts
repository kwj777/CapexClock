import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Without accounts set up there's no session to end (and no sign-in page).
  if (!supabaseEnv()) return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  // The sign-in page says "You're signed out", so it's clear it worked.
  return NextResponse.redirect(new URL("/auth/sign-in?signed_out=1", request.nextUrl.origin), { status: 303 });
}

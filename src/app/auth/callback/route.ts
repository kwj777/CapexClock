import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

// The magic link lands here with a one-time code, which becomes a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let destination = new URL(next, origin);
      // safeNext already keeps us on this site; check again before redirecting.
      if (destination.origin !== origin) destination = new URL("/app", origin);
      // First confirmation of this email means a new account (used for analytics).
      const user = data.user;
      if (user?.email_confirmed_at && user.last_sign_in_at) {
        const gap = Math.abs(Date.parse(user.last_sign_in_at) - Date.parse(user.email_confirmed_at));
        if (gap < 60_000) destination.searchParams.set("welcome", "1");
      }
      return NextResponse.redirect(destination);
    }
  }

  const retry = new URL("/auth/sign-in", origin);
  retry.searchParams.set("error", "link");
  retry.searchParams.set("next", next);
  return NextResponse.redirect(retry);
}

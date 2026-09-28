import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { isFirstSignIn, WELCOMED_KEY } from "@/lib/welcome";

// The magic link lands here with a one-time code, which becomes a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  // Accounts aren't set up on this deployment.
  if (!supabaseEnv()) return NextResponse.redirect(new URL("/", origin));
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let destination = new URL(next, origin);
      // safeNext already keeps us on this site; check again before redirecting.
      if (destination.origin !== origin) destination = new URL("/app", origin);
      // First successful sign-in on a new account (used for analytics). The
      // flag in the user's metadata makes sure it's only counted once, even
      // when an earlier link was opened in another browser and failed.
      if (data.user && isFirstSignIn(data.user)) {
        const { error: flagError } = await supabase.auth.updateUser({
          data: { [WELCOMED_KEY]: new Date().toISOString() },
        });
        if (!flagError) destination.searchParams.set("welcome", "1");
      }
      return NextResponse.redirect(destination);
    }
  }

  const retry = new URL("/auth/sign-in", origin);
  retry.searchParams.set("error", "link");
  retry.searchParams.set("next", next);
  return NextResponse.redirect(retry);
}

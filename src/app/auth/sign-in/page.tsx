import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { safeNext } from "@/lib/safe-next";
import { supabaseEnv } from "@/lib/supabase/env";
import SignInForm from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in | CapexClock",
  robots: { index: false },
};

/** True when the visitor came from the calculator's "Save to my account". */
function fromCalculator(next: string): boolean {
  const to = new URL(next, "https://capexclock.invalid");
  return to.pathname === "/app/properties/new" && to.searchParams.get("from") === "calculator";
}

export default async function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  // Accounts aren't set up on this deployment (same as the /app layout).
  if (!supabaseEnv()) notFound();
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const linkFailed = params.error === "link";
  // Set by /auth/sign-out, so signing out visibly worked.
  const signedOut = params.signed_out === "1";
  const saving = fromCalculator(next);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-md px-4 pb-24 pt-10 sm:px-6">
          {signedOut && (
            <p role="status" className="mb-6 rounded-lg bg-slate-100 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              You&apos;re signed out.
            </p>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {saving ? "Save your calculator work" : "Sign in or create a free account"}
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            {saving
              ? "Enter your email and we'll send a link. New here? That creates your free account."
              : "We'll email you a link. No password needed, and it's free."}
          </p>
          <div className="mt-8">
            <SignInForm next={next} linkFailed={linkFailed} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

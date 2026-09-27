import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { safeNext } from "@/lib/safe-next";
import SignInForm from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in | CapexClock",
  robots: { index: false },
};

export default async function SignInPage({ searchParams }: PageProps<"/auth/sign-in">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const linkFailed = params.error === "link";

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-md px-4 pb-24 pt-10 sm:px-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Sign in to CapexClock
          </h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            We&apos;ll email you a link. No password needed, and it&apos;s free.
          </p>
          {linkFailed && (
            <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-300">
              That sign-in link didn&apos;t work. It may have expired or been opened in a different
              browser. Send yourself a new one below.
            </p>
          )}
          <div className="mt-8">
            <SignInForm next={next} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

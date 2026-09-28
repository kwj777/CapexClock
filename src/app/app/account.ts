import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** The signed-in account, read once per request. The proxy has already sent everyone else to sign in. */
export const getAccount = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  return {
    id: typeof claims?.sub === "string" ? claims.sub : null,
    email: typeof claims?.email === "string" ? claims.email : null,
  };
});

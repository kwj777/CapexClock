import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Signed-in pages only; public pages stay static and never touch auth.
export const config = {
  matcher: ["/app/:path*"],
};

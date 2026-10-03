import { NextResponse, type NextRequest } from "next/server";
import { readUnsubscribeLink, UNSUBSCRIBE_PATH } from "@/lib/owner-emails/kinds";
import { unsubscribe } from "@/lib/owner-emails/unsubscribe";

// One-click unsubscribe (RFC 8058): Gmail, Yahoo and Apple Mail POST here, with
// "List-Unsubscribe=One-Click" in the body, from the List-Unsubscribe header of
// every automatic email. The link's token is the only proof needed.

export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const link = readUnsubscribeLink(searchParams.get("t"), searchParams.get("k"));
  if (!link) return new NextResponse("Unknown link", { status: 400 });
  const result = await unsubscribe(link.token, link.kind);
  if (result === "error") return new NextResponse("Try again", { status: 503 });
  // A token that matches nothing has nothing left to turn off, which is what was asked.
  return new NextResponse(null, { status: 200 });
}

// Opened in a browser: show the page that asks first.
export function GET(request: NextRequest) {
  const url = new URL(UNSUBSCRIBE_PATH, request.nextUrl.origin);
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url, { status: 303 });
}

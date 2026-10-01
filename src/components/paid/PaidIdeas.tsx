"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { firstTimeEach, paidIdeaEvent, testButtonsOn, type PaidIdea, type PaidWhere } from "@/lib/paid-ideas";

// Baked in at build time. Netlify setting NEXT_PUBLIC_TEST_BUTTONS=off hides every button.
const ENABLED = testButtonsOn(process.env.NEXT_PUBLIC_TEST_BUTTONS);

interface PaidIdeasContext {
  enabled: boolean;
  where: PaidWhere;
  /** The signed-in owner's email for the "tell me first" box; empty when unknown. */
  ownerEmail: string;
  /** Called when a panel opens, so the public calculator can look up a signed-in owner's email. */
  wantOwnerEmail: () => void;
  /** paid_idea_seen, once per page view per idea. */
  seen: (idea: PaidIdea) => void;
  /** paid_idea_clicked, once per page view per idea. */
  clicked: (idea: PaidIdea) => void;
  /** Ideas signed up for on this page, so every button for that idea shows it. */
  signedUp: ReadonlySet<PaidIdea>;
  markSignedUp: (idea: PaidIdea) => void;
}

// Without a provider the buttons stay hidden.
const Context = createContext<PaidIdeasContext>({
  enabled: false,
  where: "calculator",
  ownerEmail: "",
  wantOwnerEmail: () => {},
  seen: () => {},
  clicked: () => {},
  signedUp: new Set(),
  markSignedUp: () => {},
});

export function usePaidIdeas(): PaidIdeasContext {
  return useContext(Context);
}

/**
 * Holds the paid-idea buttons' shared state for one page view: which ideas
 * have been seen and clicked (so each event goes once), and which were
 * signed up for.
 */
export default function PaidIdeasProvider({
  where,
  ownerEmail,
  lookUpOwnerEmail = false,
  children,
}: {
  where: PaidWhere;
  /** The signed-in owner's email when the page already knows it (the property editor). */
  ownerEmail?: string | null;
  /** Look the email up in this browser's session when a panel first opens (the public calculator). */
  lookUpOwnerEmail?: boolean;
  children: ReactNode;
}) {
  const [firstSeen] = useState(() => firstTimeEach());
  const [firstClick] = useState(() => firstTimeEach());
  const [signedUp, setSignedUp] = useState<ReadonlySet<PaidIdea>>(() => new Set());
  const [foundEmail, setFoundEmail] = useState("");
  const lookedUp = useRef(false);

  const wantOwnerEmail = useCallback(() => {
    if (ownerEmail || !lookUpOwnerEmail || lookedUp.current) return;
    lookedUp.current = true;
    // Loaded only now, so the public calculator doesn't carry the sign-in code.
    import("@/lib/supabase/client")
      .then(({ createClient }) => createClient().auth.getSession())
      .then(({ data }) => setFoundEmail(data.session?.user.email ?? ""))
      .catch(() => {
        // Not signed in, or accounts are off: the box starts empty.
      });
  }, [ownerEmail, lookUpOwnerEmail]);

  const value = useMemo<PaidIdeasContext>(
    () => ({
      enabled: ENABLED,
      where,
      ownerEmail: ownerEmail || foundEmail,
      wantOwnerEmail,
      seen: (idea) => {
        if (firstSeen(idea)) void track("paid_idea_seen", paidIdeaEvent(idea, where));
      },
      clicked: (idea) => {
        if (firstClick(idea)) void track("paid_idea_clicked", paidIdeaEvent(idea, where));
      },
      signedUp,
      markSignedUp: (idea) => setSignedUp((s) => new Set(s).add(idea)),
    }),
    [where, ownerEmail, foundEmail, wantOwnerEmail, firstSeen, firstClick, signedUp],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

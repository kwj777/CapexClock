"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { NOT_BUILT_TEXT, PAID_IDEA_TEXT, type PaidIdea } from "@/lib/paid-ideas";
import { usePaidIdeas } from "./PaidIdeas";
import TellMeFirstForm from "./TellMeFirstForm";

/** "dark" for a button on the dark reserve card. */
type Tone = "light" | "dark";

const buttonClass: Record<Tone, string> = {
  light:
    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800",
  dark: "inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-medium text-white ring-1 ring-white/30 hover:bg-white/10",
};

const badgeClass: Record<Tone, string> = {
  light:
    "shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  dark: "shrink-0 rounded-full bg-amber-400 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-950",
};

/** Calls onSeen once at least half the element has been on screen. */
function useSeenOnScreen(element: HTMLElement | null, onSeen: (() => void) | null) {
  useEffect(() => {
    if (!element || !onSeen || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        onSeen();
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, onSeen]);
}

/**
 * A test button for a paid idea and the panel it opens, handed to `children`
 * to place: the panel can sit apart from the button (below the reserve
 * cards, say). Both are null when the buttons are switched off.
 */
export function PaidIdeaDisclosure({
  idea,
  tone = "light",
  children,
}: {
  idea: PaidIdea;
  tone?: Tone;
  children: (button: ReactNode, panel: ReactNode) => ReactNode;
}) {
  const { enabled, seen, clicked, wantOwnerEmail } = usePaidIdeas();
  const [open, setOpen] = useState(false);
  // In state, not a ref, so the check for being on screen starts whenever the button appears.
  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panelId = `${useId()}-panel`;
  // paid_idea_seen goes once per page view per idea (the provider makes sure).
  const onSeen = useMemo(() => (enabled ? () => seen(idea) : null), [enabled, seen, idea]);
  useSeenOnScreen(buttonEl, onSeen);

  // A panel that opens below the fold is scrolled into view; focus stays on the button.
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  if (!enabled) return children(null, null);

  function toggle() {
    if (!open) {
      clicked(idea);
      wantOwnerEmail();
    }
    setOpen(!open);
  }

  function close() {
    setOpen(false);
    buttonEl?.focus();
  }

  const button = (
    <button
      ref={setButtonEl}
      type="button"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={toggle}
      className={buttonClass[tone]}
    >
      <span>{PAID_IDEA_TEXT[idea].button}</span>
      <span className="sr-only">, </span>
      <span className={badgeClass[tone]}>Idea</span>
    </button>
  );
  const panel = open ? <PaidIdeaPanel id={panelId} panelRef={panelRef} idea={idea} onClose={close} /> : null;
  return children(button, panel);
}

/** The button with its panel right below it. */
export default function PaidIdeaButton({ idea, className }: { idea: PaidIdea; className?: string }) {
  return (
    <PaidIdeaDisclosure idea={idea}>
      {(button, panel) =>
        button && (
          <div className={className}>
            {button}
            {panel && <div className="mt-3">{panel}</div>}
          </div>
        )
      }
    </PaidIdeaDisclosure>
  );
}

/** What the first click shows: it isn't built, and a "tell me first" list. */
function PaidIdeaPanel({
  id,
  panelRef,
  idea,
  onClose,
}: {
  id: string;
  panelRef: RefObject<HTMLElement | null>;
  idea: PaidIdea;
  onClose: () => void;
}) {
  const { where, ownerEmail, signedUp, markSignedUp } = usePaidIdeas();
  const headingId = `${id}-heading`;
  // Signed up from this panel just now (not from another button for the same idea).
  const [justSignedUp, setJustSignedUp] = useState(false);
  const thanks = useRef<HTMLParagraphElement>(null);

  // The form goes away on success, so move focus to the message instead of
  // letting it drop to the top of the page.
  useEffect(() => {
    if (justSignedUp) thanks.current?.focus();
  }, [justSignedUp]);

  return (
    <section
      ref={panelRef}
      id={id}
      aria-labelledby={headingId}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      // ph-no-capture: PostHog's click capture skips the email box.
      className="ph-no-capture rounded-xl bg-amber-50 p-4 text-left text-slate-900 ring-1 ring-amber-200 sm:p-5 dark:bg-slate-900 dark:text-white dark:ring-amber-500/40"
    >
      <div className="flex items-start justify-between gap-3">
        <p id={headingId} className="text-sm font-semibold">
          {NOT_BUILT_TEXT}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-m-1 shrink-0 p-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        {PAID_IDEA_TEXT[idea].pitch} Want to hear first if we build it?
      </p>
      {/* Always in the panel, so screen readers announce the message when it appears. */}
      <div role="status">
        {signedUp.has(idea) && (
          <p
            ref={thanks}
            tabIndex={-1}
            className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200 focus:outline-none dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
          >
            You&apos;re on the list. We&apos;ll email you first if we build it.
          </p>
        )}
      </div>
      {!signedUp.has(idea) && (
        <TellMeFirstForm
          idea={idea}
          where={where}
          defaultEmail={ownerEmail}
          onSignedUp={() => {
            markSignedUp(idea);
            setJustSignedUp(true);
          }}
        />
      )}
    </section>
  );
}

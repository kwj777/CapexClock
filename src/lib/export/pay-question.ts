// Remembers, per browser, that the pay question has been asked, so it's shown
// once and never again, whether it was answered, dismissed or ignored.

import type { FirstPick } from "@/lib/paid-ideas";

const STORAGE_KEY = "capexclock:pay-question:v1";

/**
 * Sent as `version` with every pay-question event, so answers to a changed
 * question or flow can be counted apart. Events from before this tag (the
 * review fix, which first sent pay_question_shown) have the same wording and
 * the same once-per-browser rule. Version 2 adds the "Which would you use
 * first?" follow-up. Change it whenever the wording or the flow changes.
 */
export const PAY_QUESTION_VERSION = "2";

/** A pay-question event's properties, with the version added. */
export function versioned<T extends Record<string, string>>(properties: T): T & { version: string } {
  return { ...properties, version: PAY_QUESTION_VERSION };
}

type Store = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** True once the question has been shown in this browser. */
export function alreadyAsked(store: Store | null = browserStorage()): boolean {
  try {
    return store?.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

/** Records that the question was shown, or how it was answered. */
export function remember(value: string, store: Store | null = browserStorage()): void {
  try {
    store?.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked: the question may show again, which is fine.
  }
}

/** The pay question's answers. */
export const PAY_ANSWERS = ["Yes", "Maybe", "No"] as const;
export type PayAnswer = (typeof PAY_ANSWERS)[number];

/**
 * What the pay question shows next:
 * - "question" until it's answered or dismissed;
 * - "first_pick", "Which would you use first?", after a Yes or Maybe;
 * - "thanks" after a No, or once a first pick is chosen or skipped;
 * - "none" once it's dismissed.
 */
export function nextStep(
  answer: PayAnswer | "dismissed" | null,
  pick: FirstPick | "skipped" | null,
): "question" | "first_pick" | "thanks" | "none" {
  if (answer === null) return "question";
  if (answer === "dismissed") return "none";
  if (answer === "No") return "thanks";
  return pick === null ? "first_pick" : "thanks";
}

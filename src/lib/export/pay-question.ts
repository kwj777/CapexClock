// Remembers, per browser, that the pay question has been asked, so it's shown
// once and never again, whether it was answered, dismissed or ignored.

const STORAGE_KEY = "capexclock:pay-question:v1";

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

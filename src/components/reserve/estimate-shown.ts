/** How long an estimate has to stay on screen before quick_estimate_shown goes. */
export const SHOWN_AFTER_MS = 2000;

/**
 * What quick_estimate_shown carries once the estimate has stayed on screen for
 * SHOWN_AFTER_MS, or null when there's nothing to wait for: no estimate, the
 * Quick estimate tab isn't the one showing, or it already went on this page
 * view. A range restored from last time counts once its tab is showing.
 */
export function shownEvent(systems: number | null, tabShown: boolean, sent: boolean): { systems: number } | null {
  return systems !== null && tabShown && !sent ? { systems } : null;
}

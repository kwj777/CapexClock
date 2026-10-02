/**
 * How tall to draw the calculator's placeholder while its code loads, so the
 * page below doesn't jump when it appears. Null means "use the empty
 * calculator's height" (set in CSS). A saved draft makes it taller: a lower
 * bound measured from the real page, so what's left to grow happens below the
 * fold, where it doesn't count as a shift.
 *
 * It also runs as an inline script before first paint (via toString), so it
 * must stay self-contained: no imports, nothing from outside its body.
 */
export function placeholderHeight(saved: string | null, width: number): number | null {
  let draft: unknown;
  try {
    draft = JSON.parse(saved ?? "null");
  } catch {
    return null;
  }
  if (typeof draft !== "object" || draft === null) return null;
  const { rows, yearBuilt } = draft as { rows?: unknown; yearBuilt?: unknown };
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  // A row with a name, a cost and a year shows the forecast section.
  const showsForecast = rows.some((row: unknown) => {
    if (typeof row !== "object" || row === null) return false;
    const r = row as { name?: unknown; costEach?: unknown; installYear?: unknown };
    return text(r.name) !== "" && text(r.costEach) !== "" && (text(r.installYear) !== "" || text(yearBuilt) !== "");
  });

  // [cards without rows, each row, forecast section] at phone, tablet (640px+) and desktop (1024px+) widths.
  // On wide screens each row has a second line for condition and notes.
  const sizes = width >= 1024 ? [502, 160, 600] : width >= 640 ? [532, 300, 900] : [632, 420, 1150];
  return sizes[0] + sizes[1] * rows.length + (showsForecast ? sizes[2] : 0);
}

/** The inline script that sizes the placeholder right before it (see placeholderHeight). */
export function placeholderScript(storageKey: string): string {
  return `(function(){try{var el=document.currentScript.previousElementSibling;var h=(${placeholderHeight.toString()})(localStorage.getItem(${JSON.stringify(storageKey)}),window.innerWidth);if(h)el.style.height=h+"px";}catch(e){}})();`;
}

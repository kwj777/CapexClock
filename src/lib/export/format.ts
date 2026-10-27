import { toCents, type ExportRow } from "./rows";

const wholeDollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const withCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Area prices can go below a cent ($0.125 per sq ft), so keep what was entered.
const exactPrice = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

/** A price as entered: "$1,400", "$0.25", "$0.125". */
export function formatPrice(value: number): string {
  return Number.isInteger(value) ? wholeDollars.format(value) : exactPrice.format(value);
}

/** Cost each with its unit, e.g. "$4/sq ft". */
export function formatCostEach(row: Pick<ExportRow, "costEach" | "unit">): string {
  if (row.costEach === null) return "";
  return row.unit === "sq ft" ? `${formatPrice(row.costEach)}/sq ft` : formatPrice(row.costEach);
}

/** Quantity with its unit, e.g. "9,600 sq ft" or "12". */
export function formatQuantity(row: Pick<ExportRow, "quantity" | "unit">): string {
  if (row.quantity === null) return "";
  const text = row.quantity.toLocaleString("en-US");
  return row.unit === "sq ft" ? `${text} sq ft` : text;
}

/**
 * Formatter for a column of amounts: whole dollars, unless some amount has
 * cents, in which case every amount shows cents so the column adds up.
 */
export function moneyColumn(values: number[]): (value: number) => string {
  const cents = values.some((v) => !Number.isInteger(toCents(v)));
  const format = cents ? withCents : wholeDollars;
  return (value) => format.format(toCents(value));
}

/**
 * The most room one character can take in the PDF's font, in em: DejaVu Sans has no
 * basic Latin or Latin-1 character wider than 1em, and nothing at all wider than 1.75em.
 */
function widestEm(character: string): number {
  return (character.codePointAt(0) ?? 0) <= 0xff ? 1 : 1.75;
}

/**
 * Breaks a run of characters without a space (a pasted link, say) that's too long
 * for one line into lines that fit, with line breaks between them, so the PDF wraps
 * it without the hyphen it would add, which would change a link. `lineEms` is the
 * line's width in em. Shorter words and the spaces and line breaks between words
 * stay as they are, and characters are never split in half.
 */
export function breakLongWords(text: string, lineEms: number): string {
  return text
    .split(/([ \n]+)/)
    .map((word) => {
      const characters = Array.from(word);
      if (characters.reduce((sum, c) => sum + widestEm(c), 0) <= lineEms) return word;
      let line = "";
      let width = 0;
      const lines: string[] = [];
      for (const c of characters) {
        if (line !== "" && width + widestEm(c) > lineEms) {
          lines.push(line);
          [line, width] = ["", 0];
        }
        line += c;
        width += widestEm(c);
      }
      return [...lines, line].join("\n");
    })
    .join("");
}

/**
 * A long name cut at its last whole word before `maxCharacters`, with "…", for a
 * one-line spot such as the PDF's footer. A name without a break near the end is
 * cut where it is.
 */
export function shortName(text: string, maxCharacters: number): string {
  const characters = Array.from(text.trim());
  if (characters.length <= maxCharacters) return characters.join("");
  const cut = characters.slice(0, maxCharacters - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace >= cut.length / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

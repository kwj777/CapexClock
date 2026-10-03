import type { ReplacementCycle } from "./types";

function assertRenewal(sinceYear: number, life: number, currentYear: number, giveOrTakeYears: number): void {
  if (!Number.isInteger(sinceYear) || !Number.isInteger(currentYear)) {
    throw new RangeError("Years must be whole years.");
  }
  if (!Number.isInteger(life) || life < 1 || life > 100) {
    throw new RangeError("Useful life must be a whole number of years from 1 to 100.");
  }
  if (!Number.isInteger(giveOrTakeYears) || giveOrTakeYears < 0) {
    throw new RangeError("Give-or-take years must be a whole number, 0 or more.");
  }
}

/**
 * When a component lasting `life` years, installed in sinceYear and replaced on
 * schedule ever since, is next due after currentYear: the chance of each year,
 * adding up to 1. Each replacement lands up to g = min(giveOrTakeYears, life − 1)
 * years early or late, each shift equally likely; a replacement landing on or
 * before currentYear is replaced again. With giveOrTakeYears 0 it is exactly
 * every `life` years. Nothing is ever due on or before currentYear.
 */
export function nextDueDistribution(
  sinceYear: number,
  life: number,
  currentYear: number,
  giveOrTakeYears: number,
): Map<number, number> {
  assertRenewal(sinceYear, life, currentYear, giveOrTakeYears);
  const giveOrTake = Math.min(giveOrTakeYears, life - 1);
  const ways = 2 * giveOrTake + 1;
  const replaced = new Array<number>(Math.max(currentYear - sinceYear + 1, 1)).fill(0);
  replaced[0] = 1;
  const due = new Map<number, number>();
  for (let i = 0; i < replaced.length; i++) {
    if (replaced[i] === 0) continue;
    for (let shift = -giveOrTake; shift <= giveOrTake; shift++) {
      const next = i + life + shift;
      const chance = replaced[i] / ways;
      if (sinceYear + next <= currentYear) replaced[next] += chance;
      else due.set(sinceYear + next, (due.get(sinceYear + next) ?? 0) + chance);
    }
  }
  return due;
}

/**
 * A component split across schedules: each life in `lives` gets an equal part,
 * split again by when it is next due (nextDueDistribution).
 */
export function replacementCycles(
  lives: readonly number[],
  sinceYear: number,
  currentYear: number,
  giveOrTakeYears: number,
): ReplacementCycle[] {
  return lives.flatMap((life) =>
    [...nextDueDistribution(sinceYear, life, currentYear, giveOrTakeYears)].map(([due, chance]) => ({
      life,
      due,
      share: chance / lives.length,
    })),
  );
}

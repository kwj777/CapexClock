/** Years shown and totalled when horizonYears is not given. */
export const DEFAULT_HORIZON_YEARS = 10;
/** Years after the start year the monthly reserve looks at when reserveHorizonYears is not given. */
export const DEFAULT_RESERVE_HORIZON_YEARS = 30;
/** A component is at risk when it is this many years or fewer from end of life (or past it). */
export const AT_RISK_YEARS = 2;
/** Upper bound for horizonYears and reserveHorizonYears: a guard against typos and runaway loops. */
export const MAX_HORIZON_YEARS = 100;
/** Longest a planned expense can be from now. */
export const MAX_YEARS_UNTIL_DUE = 100;
/** Highest inflation rate accepted, as a decimal (1 = 100% a year); anything above is almost surely a percent typed as a whole number. */
export const MAX_INFLATION_RATE = 1;
/** Highest contingency rate accepted, as a decimal (1 = double the reserve); anything above is almost surely a percent typed as a whole number. */
export const MAX_CONTINGENCY_RATE = 1;

# The forecasting engine

## What it is

`src/engine` works out when things wear out, what replacing them costs year by year, and how much to save each month so the money is never short. It is plain TypeScript: no React, Next.js, Supabase, internet calls, clock or locale. The current year is an input, never read from the computer's clock. It imports only its own files.

That is enforced three ways: lint (the `engine/boundary` rules in `eslint.config.mjs`), `npm run typecheck:engine` (no browser or Node types), and a test that fails if an audience word such as a building's tenants gets into the engine.

## Inputs

`computeForecast(input)` takes a `ForecastInput`: a list of components plus options. Nothing is rounded on the way in.

| Field | Spec name | Meaning | Default |
|---|---|---|---|
| `components[].id`, `name`, `category` | | Identifies a component; yearly totals are also split by `category` | required |
| `components[].quantity` | `quantity` | How many, priced each. Any number above 0, so it can be an area | required |
| `components[].installYear` | `install_year` | Whole year it was installed or last replaced | required |
| `components[].usefulLifeYears` | `useful_life_years` | Whole years it lasts, 1 to 100 | required |
| `components[].replacementCostEach` | `replacement_cost_each` | Cost to replace one, in start-year dollars | required |
| `components[].scenario` | | `"run_to_failure"`, or `"replace_now"` to replace it in the first year | run to failure |
| `components[].estimated` | `is_estimate` flags | Which inputs are guesses; carried through to the outputs, never changes a number | none |
| `startYear` | `start_year` | First forecast year, normally the current year | required |
| `horizonYears` | `horizon_years` | Years shown and totalled | 10 |
| `reserveHorizonYears` | | Years after the start year the monthly amount looks ahead | 30 |
| `atRiskYears` | | A component is at risk within this many years of end of life | 2 |
| `inflationRate` | `inflation_rate` | Decimal from 0 to 1 (0.03 is 3%), compounded yearly from the start year | 0 |
| `currentReserveBalance` | `current_reserve_balance` | Money already saved | 0 |
| `adjustments` | | One-off amounts added to a year's total | none |
| `contingencyRate` | | Safety margin on the monthly amount, decimal from 0 to 1 (0.1 is 10%). Only `monthlyReserve` grows | 0 |

## Outputs

A `ForecastResult`. Every amount is unrounded; rounding for display is the caller's job.

| Field | Meaning |
|---|---|
| `years` | One entry per horizon year: `total`, `byCategory`, `adjustment` and the `replacements` in it |
| `horizonTotal` | Sum of the horizon's yearly totals |
| `neededNow` | The first year's total, paid now rather than saved for |
| `monthlyReserve` | The smallest level monthly deposit, from the second year on, that never lets the balance go below zero over the look-ahead, times (1 + `contingencyRate`) |
| `monthlyReserveBeforeContingency` | That deposit before the safety margin; equals `monthlyReserve` when the rate is 0 |
| `tightestYear` | The year that sets `monthlyReserve` (earliest on a tie), or null when nothing needs saving |
| `shortfallNow`, `carriedForward` | What the balance can't cover in the first year, and what it carries toward later years |
| `savingAhead` | Replacements after the horizon that set the monthly amount |
| `reserveYearTotals` | Every year's total the monthly amount was worked out from |
| `replacements` | Every replacement in the horizon, in year order |
| `atRisk` | Components past or near end of life, most urgent first (ties keep input order) |
| `nextReplacements` | Each component's next replacement year, not limited to the horizon |
| `startYear`, `endYear`, `horizonYears`, `reserveFromYear`, `reserveThroughYear`, `currentReserveBalance` | The window the figures cover |

Other entry points: `compareScenarios` (two forecasts side by side), `forecastAssetGroups` and `rollupForecasts` (several groups and their sums), `planExpenses` (a list of lump sums due some years out), `nextReplacementReserve` (one component), `componentLife` and `findAtRisk`, `nextDueDistribution` and `replacementCycles` (when something replaced on schedule is next due). The formulas and every error message are in the doc comments of `summarize.ts`, `reserve.ts` and `validate.ts`.

## Adding a vertical

A vertical is one audience's view of the engine. The landlord vertical in `src/verticals/landlord` is the worked example.

1. Make `src/verticals/<name>/`.
2. Implement `Vertical` from `src/verticals/vertical.ts`: labels (the audience's words), a library of components with life ranges, `defaultLife`, `rules`, `derivedMetrics` and `rollupMetrics` (landlord: reserve per unit). Check it with `satisfies Vertical<…>`, as `src/verticals/landlord/index.ts` does.
3. Write adapters from that audience's inputs to `Component` and `AssetGroup`.
4. Call only `"@/engine"`, passing your rules on every call rather than relying on the defaults (the landlord's are in `src/verticals/landlord/rules.ts`). Lint allows a vertical to import only `"@/engine"`, `"@/verticals/..."` and its own files.
5. Have your pages import only `@/verticals/<name>`, never the engine; lint refuses anything else. Export functions that do the math rather than engine functions themselves (a test in `landlord/__tests__/public-api.test.ts` checks this for the landlord).

What the engine assumes today, so the next vertical knows before it starts: savings earn no interest; the only funding goal is "never run short" (no threshold or percent-funded goal, no deposits that rise each year); the monthly amount saves from the second year, and first-year costs are shown as needed now; the at-risk window and the look-ahead are inputs. A vertical that needs otherwise adds an optional engine input whose default keeps every current number, with a test proving it. Metrics that need component ages (such as percent funded) can read them from `VerticalGroup.group.components`.

## Commands

- `npm run test:engine`: the engine's tests, failing below 90% coverage.
- `npm run typecheck:engine`: type-checks the engine on its own, with no browser or Node types.
- `npm run lint`: includes the engine's import and purity rules.

To move it into its own package later: copy the folder with its tests, replace the `extends` in `src/engine/tsconfig.json` with a standalone config (the same compiler options written out), and use the package name instead of the `"@/engine"` alias. Engine files already import each other by relative path.

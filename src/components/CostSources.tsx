import type { CostSource } from "@/verticals/landlord";

/** A link to a cost guide or other source, opening in a new tab. */
export function SourceLink({ source }: { source: CostSource }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
      {source.name}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * "Source: HomeAdvisor" under a typical cost, as the quick estimate and the
 * lifespan chart show it. Nothing when the cost has no source listed.
 */
export function CostSources({ sources }: { sources: readonly CostSource[] | undefined }) {
  if (!sources?.length) return null;
  return (
    <span className="block text-xs text-slate-500 dark:text-slate-400">
      {sources.length === 1 ? "Source: " : "Sources: "}
      {sources.map((source, i) => (
        <span key={source.url}>
          {i > 0 && ", "}
          <SourceLink source={source} />
        </span>
      ))}
    </span>
  );
}

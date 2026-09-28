import type { Metadata } from "next";

/** The share image drawn by src/app/opengraph-image.tsx. */
export const OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "CapexClock: Know when every system in your building runs out.",
  type: "image/png",
};

/**
 * Open Graph fields every page shares. Next merges metadata shallowly, so a page
 * that sets its own openGraph replaces the root layout's whole object, image and
 * site name included. Spreading this keeps them.
 */
export const SHARED_OPEN_GRAPH = {
  siteName: "CapexClock",
  type: "website",
  images: [OG_IMAGE],
} satisfies Metadata["openGraph"];

export const SHARED_TWITTER = {
  card: "summary_large_image",
  images: [OG_IMAGE],
} satisfies Metadata["twitter"];

/** Title, description, canonical URL and share cards for one public page. */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { ...SHARED_OPEN_GRAPH, title, description, url: path },
    twitter: { ...SHARED_TWITTER, title, description },
  };
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PlanEveryReplacement from "@/components/lifespan/PlanEveryReplacement";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { formatPostDate, livePost, livePosts, markdownToHtml } from "@/lib/blog";
import { pageMetadata } from "@/lib/metadata";
import { SITE_URL } from "@/lib/site";

// Posts dated today or earlier are built with the site. A future-dated post is deployed but 404s until
// its date; after that the first visit renders it, and the index and sitemap pick it up within the hour.
export const revalidate = 3600;

export function generateStaticParams() {
  return livePosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = livePost((await params).slug);
  if (!post) return {};
  const meta = pageMetadata({ title: post.title, description: post.description, path: `/blog/${post.slug}` });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: post.date } };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const post = livePost((await params).slug);
  if (!post) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.updated ?? post.date,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    author: { "@type": "Organization", name: "CapexClock" },
    publisher: { "@type": "Organization", name: "CapexClock" },
  };
  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <article className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6">
          <p className="text-sm">
            <Link href="/blog" className="text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400">
              ← All posts
            </Link>
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-slate-950 sm:text-4xl dark:text-white">
            {post.title}
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          </p>
          {/* Our own Markdown, rendered with everything but a small subset escaped (src/lib/blog.ts). */}
          <div className="blog-body mt-8" dangerouslySetInnerHTML={{ __html: markdownToHtml(post.body) }} />
          <PlanEveryReplacement className="mt-12" />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}

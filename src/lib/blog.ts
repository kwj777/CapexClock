import posts from "./blog-posts.json";

/**
 * The blog. Posts are Markdown files in content/blog/<slug>.md with title, description and date
 * (YYYY-MM-DD) front matter. scripts/build-blog-data.mjs copies them into blog-posts.json, which is
 * bundled with the pages, so a post dated in the future is already deployed but hidden: the blog
 * pages revalidate hourly and show it from the morning of its date (US Central).
 */
export type BlogPost = { slug: string; title: string; description: string; date: string; updated?: string; body: string };

const ALL: BlogPost[] = posts as BlogPost[];

/** Today's date in US Central time, as YYYY-MM-DD. */
export function todayInCentral(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
}

/** Posts dated today or earlier, newest first. */
export function livePosts(today = todayInCentral(), all: BlogPost[] = ALL): BlogPost[] {
  return all.filter((p) => p.date <= today).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
}

export function livePost(slug: string, today = todayInCentral(), all: BlogPost[] = ALL): BlogPost | undefined {
  return livePosts(today, all).find((p) => p.slug === slug);
}

export function formatPostDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const LINK = "text-amber-700 underline underline-offset-2 hover:text-amber-800 dark:text-amber-400";

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text: string, href: string) => {
    const external = /^https?:\/\//.test(href);
    return `<a href="${href}" class="${LINK}"${external ? ' rel="noopener"' : ""}>${text}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-950 dark:text-white">$1</strong>');
  out = out.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
  return out;
}

/**
 * A small Markdown subset: # and ## headings (h2), ### (h3), paragraphs, - and 1. lists, > quotes,
 * **bold**, *italic* and [links](url). Everything else is escaped, so a post can't inject HTML.
 */
export function markdownToHtml(md: string): string {
  const html: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const flushQuote = () => {
    if (!quote.length) return;
    const paras = quote.join("\n").split(/\n\s*\n/).map((q) => q.replace(/\n/g, " ").trim()).filter(Boolean);
    html.push(`<blockquote>${paras.map((q) => `<p>${inline(q)}</p>`).join("")}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) {
      flushAll();
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      flushAll();
      const level = Math.max(m[1].length, 2);
      html.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/) ?? line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      flushQuote();
      const tag = /^\s*\d/.test(line) ? "ol" : "ul";
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push(m[1]);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara();
      flushList();
      quote.push(m[1]);
    } else if (list && /^\s{2,}\S/.test(raw)) {
      const items: string[] = list.items;
      items[items.length - 1] += " " + line.trim();
    } else {
      flushList();
      flushQuote();
      para.push(line.trim());
    }
  }
  flushAll();
  return html.join("\n");
}

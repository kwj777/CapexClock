import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import posts from "@/lib/blog-posts.json";
import { livePost, livePosts, markdownToHtml, todayInCentral, type BlogPost } from "@/lib/blog";
import BlogPostPage from "../[slug]/page";
import BlogIndex from "../page";

const post = (slug: string, date: string): BlogPost => ({ slug, title: slug, description: "d", date, body: "Hi" });

describe("blog", () => {
  it("renders the Markdown subset and escapes HTML", () => {
    const html = markdownToHtml("# Head\n\n### Sub\n\nA **bold** [link](/lifespan).\n\n- one\n- two\n\n1. first\n\n> a\n>\n> b\n\n<script>x</script>");
    expect(html).toContain("<h2>Head</h2>");
    expect(html).toContain("<h3>Sub</h3>");
    expect(html).toMatch(/<strong[^>]*>bold<\/strong>/);
    expect(html).toMatch(/<a href="\/lifespan"[^>]*>link<\/a>/);
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>first</li></ol>");
    expect(html).toContain("<blockquote><p>a</p><p>b</p></blockquote>");
    expect(html).not.toContain("<script>");
  });

  it("uses the US Central date", () => {
    expect(todayInCentral(new Date("2026-11-10T04:00:00Z"))).toBe("2026-11-09");
    expect(todayInCentral(new Date("2026-11-10T07:00:00Z"))).toBe("2026-11-10");
  });

  it("hides a post until its date", () => {
    const all = [post("old", "2026-01-01"), post("soon", "2026-12-01")];
    expect(livePosts("2026-11-09", all).map((p) => p.slug)).toEqual(["old"]);
    expect(livePost("soon", "2026-11-30", all)).toBeUndefined();
    expect(livePost("soon", "2026-12-01", all)?.slug).toBe("soon");
  });

  it("has blog-posts.json in step with content/blog (run node scripts/build-blog-data.mjs)", () => {
    const dir = join(process.cwd(), "content/blog");
    const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
    expect((posts as BlogPost[]).map((p) => `${p.slug}.md`)).toEqual(files);
    for (const p of posts as BlogPost[]) {
      const text = readFileSync(join(dir, `${p.slug}.md`), "utf8");
      expect(text).toContain(`date: ${p.date}`);
      expect(text).toContain(`title: ${p.title}`);
      expect(text.trim().endsWith(p.body.trim())).toBe(true);
      expect(p.description.length).toBeLessThanOrEqual(200);
    }
  });

  it("follows the copy rules: no prices for CapexClock, no paid plans, no tagged or off-site CapexClock links", () => {
    for (const p of posts as BlogPost[]) {
      const text = `${p.title} ${p.description} ${p.body}`;
      expect(text).not.toMatch(/paid plan|buy now|utm_|netlify\.app|go\.capexclock\.com/i);
    }
  });

  it("renders the index and a live post", async () => {
    const live = livePosts();
    const index = renderToStaticMarkup(BlogIndex());
    for (const p of live) expect(index).toContain(`/blog/${p.slug}`);
    if (live[0]) {
      const html = renderToStaticMarkup(await BlogPostPage({ params: Promise.resolve({ slug: live[0].slug }), searchParams: Promise.resolve({}) }));
      expect(html).toContain("BlogPosting");
      expect(html).toContain("/capex-calculator");
    }
  });
});

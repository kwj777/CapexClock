#!/usr/bin/env node
// Copies the blog posts in content/blog/*.md into src/lib/blog-posts.json, which the blog pages
// bundle. Runs at the start of every Netlify build (netlify.toml), and the tests check the committed
// JSON matches the Markdown, so run it after adding or editing a post:
//
//   node scripts/build-blog-data.mjs
//
// Every post goes into the JSON, future ones included; the pages hide a post until its date.

import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function parsePost(file, text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, "$1");
  }
  const slug = file.replace(/\.md$/, "");
  for (const key of ["title", "description", "date"]) if (!data[key]) throw new Error(`${file}: front matter needs ${key}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error(`${file}: date must be YYYY-MM-DD`);
  if (data.updated && !/^\d{4}-\d{2}-\d{2}$/.test(data.updated)) throw new Error(`${file}: updated must be YYYY-MM-DD`);
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`${file}: file name must be lowercase-with-hyphens`);
  const post = { slug, title: data.title, description: data.description, date: data.date, body: m[2].trim() + "\n" };
  if (data.updated) post.updated = data.updated;
  return post;
}

export function readPosts(dir = join(root, "content/blog")) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parsePost(f, readFileSync(join(dir, f), "utf8")));
}

export function postsJson(posts = readPosts()) {
  return JSON.stringify(posts, null, 2) + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const posts = readPosts();
  writeFileSync(join(root, "src/lib/blog-posts.json"), postsJson(posts));
  console.log(`Blog: ${posts.length} post(s) written to src/lib/blog-posts.json.`);
}

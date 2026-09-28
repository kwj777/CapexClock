import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Analytics from "@/components/Analytics";
import { SHARED_OPEN_GRAPH, SHARED_TWITTER } from "@/lib/metadata";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

// "optional" keeps the fallback font on slow first loads instead of swapping
// late, which would push back Largest Contentful Paint.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
});

// Defaults for every page. Titles, descriptions and URLs stay out of the share
// cards here: a page without its own openGraph gets them from its own title and
// description, never the home page's. Public pages set theirs with pageMetadata.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: SHARED_OPEN_GRAPH,
  twitter: SHARED_TWITTER,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

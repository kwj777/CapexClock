import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "CapexClock: Know when every system in your building runs out";
const description =
  "A free CapEx forecaster for small rental property owners. Turn your roofs, HVAC, and water heaters into a 10-year replacement forecast and a monthly reserve number.";

export const metadata: Metadata = {
  metadataBase: new URL("https://capexclock.com"),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "CapexClock",
    type: "website",
  },
  twitter: { card: "summary", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}

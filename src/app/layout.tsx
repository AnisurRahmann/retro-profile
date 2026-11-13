import type { Metadata, Viewport } from "next";
import { Barlow, IBM_Plex_Mono } from "next/font/google";
import localFont from "next/font/local";
import { flights, meta, profile } from "@/content";
import { Runtime } from "@/components/Runtime";
import { bootScript } from "@/lib/boot";
import "./globals.css";

// Big Shoulders Display 900: Google now ships it as "Big Shoulders" with an optical-size axis.
// The file is the latin instance pinned at opsz 72, wght 900 (14 kB instead of the 58 kB variable font),
// fetched once from the Google Fonts CSS2 API and self-hosted. Licence: SIL OFL 1.1.
const big = localFont({
  src: "../assets/big-shoulders-display-900.woff2",
  weight: "900",
  variable: "--font-big",
  display: "swap",
  adjustFontFallback: false,
});
const barlow = Barlow({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-barlow", display: "swap" });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-plex", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(profile.site),
  title: meta.title,
  description: profile.summary,
  alternates: { canonical: "/" },
  authors: [{ name: profile.name, url: profile.site }],
  openGraph: {
    type: "profile",
    url: "/",
    siteName: `${profile.name} (${profile.alias})`,
    title: meta.title,
    description: profile.summary,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: meta.title }],
  },
  twitter: { card: "summary_large_image", title: meta.title, description: profile.summary, images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F2EC" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0F11" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${big.variable} ${barlow.variable} ${plex.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        {children}
        <Runtime flightIds={flights.map((flight) => flight.id)} />
      </body>
    </html>
  );
}

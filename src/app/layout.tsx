import type { Metadata, Viewport } from "next";
import { Barlow, Big_Shoulders, IBM_Plex_Mono } from "next/font/google";
import { flights, meta, profile } from "@/content";
import { Runtime } from "@/components/Runtime";
import { bootScript } from "@/lib/boot";
import "./globals.css";

// "Big Shoulders Display" now ships as the Big Shoulders family with an optical-size axis.
const big = Big_Shoulders({ subsets: ["latin"], weight: "variable", axes: ["opsz"], variable: "--font-big", display: "swap", adjustFontFallback: false });
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

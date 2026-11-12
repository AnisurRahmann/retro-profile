import type { Metadata, Viewport } from "next";
import { Archivo, Caveat, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { meta, profile, SITE_URL, ui } from "@/content";
import { Frame, TopBar } from "@/components/frame";
import { SvgDefs } from "@/components/primitives";
import { PAPER } from "@/lib/palette";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
  adjustFontFallback: false,
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-caveat",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: meta.title,
  description: meta.description,
  authors: [{ name: profile.name, url: SITE_URL }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    url: SITE_URL,
    title: meta.title,
    description: meta.description,
    siteName: profile.name,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: meta.title, description: meta.description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: PAPER.paper,
  colorScheme: "light dark",
};

/**
 * Runs before first paint: applies the saved theme and redline state so there is
 * no flash, and marks the document as scripted so the drafting animations arm.
 */
const BOOT = `(function(){var d=document.documentElement;d.classList.add("js");try{if(localStorage.getItem("ds-theme")==="blueprint")d.dataset.theme="blueprint";if(localStorage.getItem("ds-redlines")==="off")d.dataset.redlines="off"}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="paper"
      data-redlines="on"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} ${caveat.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <a className="skip" href="#drawing">
          {ui.skipLink}
        </a>
        <SvgDefs />
        <TopBar />
        <Frame />
        {children}
      </body>
    </html>
  );
}

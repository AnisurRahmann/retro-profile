import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Header } from "@/components/Header";
import { SkyBackdrop } from "@/components/sky/SkyBackdrop";
import { firstPaintScript } from "@/lib/sky/first-paint";
import { SKY_DEBUG, SKY_PREVIEW_BADGE, SKY_PRODUCTION } from "@/lib/sky/store";
import { brand } from "@/lib/brand";
import { links, profile, ui } from "@/site";
import "./globals.css";

const description = `${profile.oneLiner} ${profile.summary}`;

export const metadata: Metadata = {
  metadataBase: new URL(links.site),
  title: { default: ui.meta.title, template: `%s · ${profile.name}` },
  description,
  alternates: { canonical: "/" },
  authors: [{ name: profile.legalName, url: links.site }],
  openGraph: {
    type: "website",
    url: links.site,
    siteName: profile.name,
    title: ui.meta.title,
    description,
  },
  twitter: { card: "summary_large_image", title: ui.meta.title, description },
};

const INPUT_MODALITY = `(()=>{const d=document.documentElement,o={capture:true,passive:true};addEventListener("pointerdown",()=>{d.dataset.input="pointer"},o);addEventListener("keydown",e=>{if(e.key==="Tab")d.dataset.input="keyboard"},o)})()`;

const SKY_FIRST_PAINT = firstPaintScript(SKY_DEBUG, SKY_PRODUCTION, SKY_PREVIEW_BADGE ? ui.sky.preview : "");

export const viewport: Viewport = {
  themeColor: brand.ink,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-input="keyboard"
      suppressHydrationWarning
    >
      <head>
        {/* Input modality for focus rings: Tab → keyboard, pointer → pointer. See globals.css. */}
        <script dangerouslySetInnerHTML={{ __html: INPUT_MODALITY }} />
        {/* Sylhet Sky: the right gradient before first paint (src/lib/sky/first-paint.ts). */}
        <script dangerouslySetInnerHTML={{ __html: SKY_FIRST_PAINT }} />
      </head>
      <body className="flex min-h-dvh flex-col text-text">
        <SkyBackdrop />
        <Header />
        {children}
      </body>
    </html>
  );
}

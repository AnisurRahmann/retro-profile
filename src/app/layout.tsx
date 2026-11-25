import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Header } from "@/components/Header";
import { SignalFieldMount } from "@/components/signal-field/SignalFieldMount";
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
      </head>
      <body className="flex min-h-dvh flex-col text-text">
        <div aria-hidden="true" className="depth">
          <div className="depth-light" />
          <div className="depth-vignette" />
          <div className="depth-grain" />
        </div>
        <SignalFieldMount />
        <Header />
        {children}
      </body>
    </html>
  );
}

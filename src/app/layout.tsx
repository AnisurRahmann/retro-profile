import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Header } from "@/components/Header";
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

export const viewport: Viewport = {
  themeColor: "#0B1220",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-dvh flex-col bg-ink text-text">
        <Header />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { legalDoc } from "@/lib/legal";

const doc = legalDoc("fb-privacy");

export const metadata: Metadata = {
  title: doc.title,
  description: doc.description,
  alternates: { canonical: "/fb-privacy/" },
  openGraph: { title: doc.title, description: doc.description, url: "/fb-privacy/" },
};

export default function Page() {
  return <LegalPage doc={doc} />;
}

import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { legalDoc } from "@/lib/legal";

const doc = legalDoc("fb-data-deletion");

export const metadata: Metadata = {
  title: doc.title,
  description: doc.description,
  alternates: { canonical: "/fb-data-deletion/" },
  openGraph: { title: doc.title, description: doc.description, url: "/fb-data-deletion/" },
};

export default function Page() {
  return <LegalPage doc={doc} />;
}

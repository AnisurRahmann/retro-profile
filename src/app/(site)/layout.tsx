import { Footer } from "@/components/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main id="main" className="column flex-1 pt-8 sm:pt-14">
        {children}
      </main>
      <Footer />
    </>
  );
}

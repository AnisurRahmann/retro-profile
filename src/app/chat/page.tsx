import type { Metadata } from "next";
import { getChatAvailability } from "@/agent/availability";
import { Chat } from "@/components/chat/Chat";
import { Portrait } from "@/components/Portrait";
import { allowedLinkHosts, links, ui } from "@/site";

export const metadata: Metadata = {
  title: ui.meta.chatTitle,
  description: ui.meta.chatDescription,
  alternates: { canonical: "/chat" },
  openGraph: { title: ui.meta.chatTitle, description: ui.meta.chatDescription, url: "/chat" },
  twitter: { card: "summary_large_image", title: ui.meta.chatTitle, description: ui.meta.chatDescription },
};

/**
 * Rendered per request so the page and /api/chat always agree: both call getChatAvailability().
 * Not enabled → the kill-switch state (book-a-call card + email, no input).
 */
export const dynamic = "force-dynamic";

export default function ChatPage() {
  const { enabled } = getChatAvailability();
  return (
    <main id="main" className="column flex-1">
      <Chat
        copy={ui.chat}
        labels={{ inBuild: ui.home.statusInBuild, built: ui.home.statusBuilt }}
        email={links.email}
        calendar={links.calendar}
        allowedHosts={allowedLinkHosts}
        enabled={enabled}
        portrait={<Portrait size={64} priority />}
        portraitSmall={<Portrait size={36} />}
        avatar={<Portrait size={24} />}
      />
    </main>
  );
}

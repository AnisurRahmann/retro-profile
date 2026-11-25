import type { Metadata } from "next";
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

/** Static page. The kill switch is read at build time (redeploy to flip); /api/chat also checks it per request. */
const enabled = process.env.CHAT_ENABLED !== "false";

export default function ChatPage() {
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

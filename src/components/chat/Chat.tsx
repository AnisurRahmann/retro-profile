"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createEventParser, type ErrorCode } from "@/agent/protocol";
import type { ToolEventResult } from "@/agent/tools";
import type { StatusLabels } from "@/lib/project";
import { Markdown } from "./Markdown";
import { BookCard, ToolCard } from "./ToolCards";
import type { ChatCopy } from "./types";

type UIMessage =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      tools: ToolEventResult[];
      status: "streaming" | "done" | "error";
      error?: ErrorCode;
    };

type Props = {
  copy: ChatCopy;
  labels: StatusLabels;
  email: string;
  calendar: string;
  allowedHosts: string[];
  enabled: boolean;
  portrait: ReactNode;
  portraitSmall: ReactNode;
  avatar: ReactNode;
};

const MAX_CHARS = 2000;
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()));

/** Builds the alternating text history the API expects. Failed turns are dropped with their question. */
function toHistory(messages: UIMessage[]): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== "user") continue;
    const reply = messages[i + 1];
    if (reply?.role !== "assistant") continue;
    const text = reply.text.trim() || (reply.tools[0] ? `[showed ${reply.tools[0].kind.replace("_", " ")}]` : "");
    if (reply.status === "error" || !text) continue;
    out.push({ role: "user", content: m.text }, { role: "assistant", content: text.slice(0, MAX_CHARS) });
  }
  return out;
}

function Ring({ spinning, size, children }: { spinning: boolean; size: number; children: ReactNode }) {
  const c = size / 2;
  return (
    <div className="relative grid flex-none place-items-center" style={{ width: size, height: size }}>
      <svg aria-hidden="true" className="ring-spin absolute inset-0" data-spinning={spinning} viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={c} cy={c} r={c - 1} fill="none" stroke="var(--graphite)" strokeWidth="1.25" strokeDasharray="1 5" strokeLinecap="round" />
      </svg>
      {children}
    </div>
  );
}

/** Maps an error code to what the visitor sees. Every branch leaves a next action. */
function ErrorReply({ code, copy, email, calendar }: { code?: ErrorCode; copy: ChatCopy; email: string; calendar: string }) {
  const text =
    code === "rate_limited" || code === "budget"
      ? copy.rateLimited
      : code === "unavailable"
        ? copy.disabled.replace("{email}", email)
        : copy.broken.replace("{email}", email);
  return (
    <div className="space-y-3" data-error={code ?? "upstream"}>
      <p className="text-graphite">{text}</p>
      <BookCard url={calendar} copy={copy} />
    </div>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 12V2M7 2L2.5 6.5M7 2l4.5 4.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
      <rect x="2" y="2" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function Chat({ copy, labels, email, calendar, allowedHosts, enabled, portrait, portraitSmall, avatar }: Props) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- client-only values read once after hydration */
    setSessionId(uid());
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setDraft(q.slice(0, MAX_CHARS));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Autosize the textarea (96px min, 240px max, set in CSS).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [draft, messages.length]);

  // Follow the stream only while the visitor is at the bottom.
  useEffect(() => {
    const onScroll = () => {
      stickToBottom.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 120;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (stickToBottom.current) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const patchLast = useCallback((fn: (m: Extract<UIMessage, { role: "assistant" }>) => Partial<UIMessage>) => {
    setMessages((prev) => {
      const last = prev.at(-1);
      if (!last || last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, ...fn(last) } as UIMessage];
    });
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX_CHARS);
      if (!text || streaming || !enabled) return;
      const history = [...toHistory(messages), { role: "user" as const, content: text }].slice(-30);
      const userMsg: UIMessage = { id: uid(), role: "user", text };
      const agentMsg: UIMessage = { id: uid(), role: "assistant", text: "", tools: [], status: "streaming" };
      setMessages((prev) => [...prev, userMsg, agentMsg]);
      setDraft("");
      setStreaming(true);
      stickToBottom.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      let finished = false;
      const fail = (code: ErrorCode) => {
        finished = true;
        patchLast(() => ({ status: "error", error: code }));
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId || undefined, messages: history }),
          signal: controller.signal,
        });
        if (!res.body) throw new Error("no body");
        const parser = createEventParser((event) => {
          if (event.type === "text") patchLast((m) => ({ text: m.text + event.delta }));
          else if (event.type === "tool") patchLast((m) => ({ tools: [...m.tools, event.result] }));
          else if (event.type === "done") {
            finished = true;
            patchLast(() => ({ status: "done" }));
          } else if (event.type === "error") fail(event.code);
        });
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.push(decoder.decode(value, { stream: true }));
        }
        parser.end();
        if (!finished) fail(res.status === 429 ? "rate_limited" : res.status === 503 ? "unavailable" : "upstream");
      } catch {
        if (controller.signal.aborted) patchLast(() => ({ status: "done" }));
        else fail("upstream");
      } finally {
        abortRef.current = null;
        setStreaming(false);
        inputRef.current?.focus();
      }
    },
    [enabled, messages, patchLast, sessionId, streaming],
  );

  const stop = () => abortRef.current?.abort();
  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setDraft("");
    setSessionId(uid());
    inputRef.current?.focus();
  };

  const empty = messages.length === 0;

  const composer = enabled ? (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send(draft);
      }}
      className="composer glass relative"
    >
      <label htmlFor="chat-input" className="sr-only">
        {copy.inputLabel}
      </label>
      <textarea
        id="chat-input"
        ref={inputRef}
        value={draft}
        maxLength={MAX_CHARS}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send(draft);
          }
        }}
        placeholder={copy.placeholder}
        rows={3}
        className="block max-h-[240px] min-h-24 w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-base leading-6 text-text placeholder:text-graphite"
      />
      {streaming ? (
        <button
          type="button"
          onClick={stop}
          aria-label={copy.stop}
          className="absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-text text-ink"
        >
          <StopIcon />
        </button>
      ) : (
        <button
          type="submit"
          aria-label={copy.send}
          disabled={!draft.trim()}
          className="absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-text text-ink transition-opacity duration-150 disabled:opacity-40"
        >
          <SendIcon />
        </button>
      )}
    </form>
  ) : null;

  if (empty) {
    return (
      <div className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center pt-4 pb-16 text-center">
        <Ring spinning={false} size={84}>
          {portrait}
        </Ring>
        <h1 className="mt-6 text-[32px] leading-10 font-medium tracking-[-0.02em] text-text">{copy.heading}</h1>
        <p className="mt-2 max-w-[44ch] text-[15px] leading-6 text-graphite">{copy.sub}</p>
        <div className="mt-8 w-full text-left">
          {enabled ? (
            <>
              {composer}
              <ul className="mt-4 flex flex-wrap justify-center gap-2">
                {copy.chips.map((chip) => (
                  <li key={chip}>
                    <button
                      type="button"
                      onClick={() => void send(chip)}
                      className="rounded-full border border-hairline px-3.5 py-1.5 text-sm text-graphite transition-colors duration-150 hover:bg-surface-2 hover:text-text"
                    >
                      {chip}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="space-y-3">
              <BookCard url={calendar} copy={copy} />
              <p className="text-center text-sm text-graphite">{copy.disabled.replace("{email}", email)}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const history = toHistory(messages);

  return (
    <div className="flex min-h-[calc(100dvh-64px)] flex-col">
      <div className="flex items-center justify-between pt-4 pb-6">
        <Ring spinning={streaming} size={48}>
          {portraitSmall}
        </Ring>
        <button type="button" onClick={reset} className="font-mono text-xs text-graphite transition-colors duration-150 hover:text-text">
          {copy.newChat}
        </button>
      </div>

      <ol className="flex-1 space-y-8 pb-8" aria-live="polite" aria-busy={streaming}>
        {messages.map((m) =>
          m.role === "user" ? (
            <li key={m.id} className="flex justify-end">
              <p className="sr-only">{copy.you}:</p>
              <div className="max-w-[85%] glass rounded-xl px-4 py-2.5 text-base leading-6 break-words whitespace-pre-wrap text-text">
                {m.text}
              </div>
            </li>
          ) : (
            <li key={m.id} className="flex gap-3" data-testid={m.status === "done" ? "agent-done" : undefined}>
              <span className="mt-0.5 flex-none">
                {avatar}
              </span>
              <div className="min-w-0 flex-1 space-y-3 text-base leading-6 text-text">
                <p className="sr-only">{copy.agent}:</p>
                {m.text ? (
                  <div>
                    <Markdown text={m.text} allowedHosts={allowedHosts} />
                  </div>
                ) : m.status === "streaming" ? (
                  <span className="dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : null}
                {m.tools.map((t, i) => (
                  <ToolCard key={i} result={t} copy={copy} labels={labels} sessionId={sessionId} context={history} email={email} />
                ))}
                {m.status === "error" ? <ErrorReply code={m.error} copy={copy} email={email} calendar={calendar} /> : null}
              </div>
            </li>
          ),
        )}
      </ol>
      <div ref={endRef} />

      <div className="dock-fade sticky bottom-0 -mx-1 px-1 pt-6 pb-[max(16px,env(safe-area-inset-bottom))]">{composer}</div>
    </div>
  );
}

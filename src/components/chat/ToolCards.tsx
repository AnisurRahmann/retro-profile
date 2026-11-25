"use client";

import { useId, useState } from "react";
import type { ToolEventResult } from "@/agent/tools";
import type { StatusLabels } from "@/lib/project";
import { ProjectCard } from "../ProjectCard";
import type { ChatCopy } from "./types";

const buttonPrimary =
  "inline-flex h-9 items-center justify-center rounded-lg bg-text px-3.5 text-sm font-medium text-ink transition-opacity duration-150 hover:opacity-90 disabled:opacity-50";
const input =
  "w-full rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-graphite";

export function BookCard({ url, copy }: { url: string; copy: ChatCopy }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg glass border border-hairline px-4 py-3.5">
      <span className="text-sm font-medium text-text">{copy.bookTitle}</span>
      <a href={url} target="_blank" rel="noopener" className={buttonPrimary}>
        {copy.bookButton}
      </a>
    </div>
  );
}

export function IntroForm({
  topic,
  copy,
  sessionId,
  context,
  email,
}: {
  topic: string;
  copy: ChatCopy;
  sessionId: string;
  context: { role: "user" | "assistant"; content: string }[];
  email: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const id = useId();

  if (state === "sent") {
    return (
      <p role="status" className="rounded-lg glass border border-hairline px-4 py-3.5 text-sm text-text">
        {copy.introSent}
      </p>
    );
  }

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setState("sending");
    try {
      const res = await fetch("/api/intro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          name: data.get("name"),
          email: data.get("email"),
          topic,
          message: data.get("message") ?? "",
          consent: data.get("consent") === "on",
          website: data.get("website") ?? "",
          context: context.slice(-6),
        }),
      });
      setState(res.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
      className="space-y-3 rounded-lg glass border border-hairline px-4 py-4"
      aria-labelledby={`${id}-title`}
    >
      <p id={`${id}-title`} className="text-sm font-medium text-text">
        {copy.introTitle}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-graphite">
          {copy.introName}
          <input name="name" required maxLength={80} autoComplete="name" className={`${input} mt-1`} />
        </label>
        <label className="block text-xs text-graphite">
          {copy.introEmail}
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={`${input} mt-1`} />
        </label>
      </div>
      <label className="block text-xs text-graphite">
        {copy.introAbout}
        <textarea name="message" rows={3} maxLength={1000} defaultValue={topic} className={`${input} mt-1 resize-y`} />
      </label>
      {/* Honeypot: hidden from people and assistive tech */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="flex items-center gap-2 text-sm text-text">
        <input name="consent" type="checkbox" required className="size-4 accent-[var(--signal)]" />
        {copy.introConsent}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "sending"} className={buttonPrimary}>
          {copy.introSubmit}
        </button>
        {state === "error" ? (
          <span role="alert" className="text-sm text-graphite">
            {copy.introError.replace("{email}", email)}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function ToolCard(props: {
  result: ToolEventResult;
  copy: ChatCopy;
  labels: StatusLabels;
  sessionId: string;
  context: { role: "user" | "assistant"; content: string }[];
  email: string;
}) {
  const { result, copy, labels } = props;
  switch (result.kind) {
    case "book_call":
      return <BookCard url={result.url} copy={copy} />;
    case "show_project":
      return (
        <div className="sm:max-w-[calc(50%-5px)]">
          <ProjectCard project={result.project} labels={labels} />
        </div>
      );
    case "leave_intro":
      return <IntroForm topic={result.topic} copy={copy} sessionId={props.sessionId} context={props.context} email={props.email} />;
    default:
      return null;
  }
}

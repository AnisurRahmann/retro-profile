import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { allProjects, caseStudies, links } from "../site";

export const PROJECT_IDS: string[] = [...allProjects.map((p) => p.id), ...caseStudies.map((c) => c.slug)];

export type ProjectCardData = {
  id: string;
  title: string;
  subtitle: string;
  href?: string;
  caseStudy?: string;
  status?: "in-build" | "built-not-deployed";
};

export type ToolEventResult =
  | { kind: "book_call"; url: string }
  | { kind: "show_project"; project: ProjectCardData }
  | { kind: "leave_intro"; form: true; topic: string }
  | { kind: "error"; error: string };

export const toolInputSchemas = {
  book_call: z.object({ reason: z.string().max(300).optional() }),
  show_project: z.object({ id: z.string() }),
  leave_intro: z.object({ topic: z.string().min(1).max(200) }),
} as const;

export type ToolName = keyof typeof toolInputSchemas;
export const TOOL_NAMES = Object.keys(toolInputSchemas) as ToolName[];

export const tools: Anthropic.Tool[] = [
  {
    name: "book_call",
    description:
      "Offer the visitor a 30-minute call with Shakil. Use when they show hiring or project intent, ask about rates or pricing, or ask to talk to him. Renders a booking card.",
    input_schema: {
      type: "object",
      properties: { reason: { type: "string", description: "One short phrase on why a call fits." } },
      additionalProperties: false,
    },
  },
  {
    name: "show_project",
    description:
      "Show a compact card for one of Shakil's projects when you talk about a specific project. Use the exact id from the knowledge base.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", enum: PROJECT_IDS, description: "Project or case study id." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "leave_intro",
    description:
      "Show a form so the visitor can leave their name, email and message for Shakil to follow up. Use when they want Shakil to get back to them. You never see or handle their email; the form is submitted by the visitor.",
    input_schema: {
      type: "object",
      properties: { topic: { type: "string", description: "What the intro is about, max 200 characters." } },
      required: ["topic"],
      additionalProperties: false,
    },
  },
];

function cardFor(id: string): ProjectCardData | null {
  const study = caseStudies.find((c) => c.slug === id);
  const project = allProjects.find((p) => p.id === (study ? study.projectId : id));
  if (!project) return null;
  const { title, subtitle, href, caseStudy } = project;
  return {
    id: project.id,
    title,
    subtitle,
    ...(href ? { href } : {}),
    ...(caseStudy ? { caseStudy } : {}),
    ...("status" in project ? { status: project.status } : {}),
  };
}

/** Executes a tool server-side. Never throws: bad input returns an error result. */
export function executeTool(name: string, input: unknown): { result: ToolEventResult; forModel: string } {
  if (!(name in toolInputSchemas)) {
    const result = { kind: "error", error: `unknown tool ${name}` } as const;
    return { result, forModel: JSON.stringify(result) };
  }
  const parsed = toolInputSchemas[name as ToolName].safeParse(input);
  if (!parsed.success) {
    const result = { kind: "error", error: "invalid input" } as const;
    return { result, forModel: JSON.stringify(result) };
  }
  switch (name as ToolName) {
    case "book_call": {
      const result = { kind: "book_call", url: links.calendar } as const;
      return { result, forModel: JSON.stringify({ shown: "booking card", url: links.calendar }) };
    }
    case "show_project": {
      const { id } = parsed.data as { id: string };
      const project = cardFor(id);
      if (!project) {
        const result = { kind: "error", error: `unknown project id ${id}` } as const;
        return { result, forModel: JSON.stringify(result) };
      }
      return { result: { kind: "show_project", project }, forModel: JSON.stringify({ shown: "project card", project }) };
    }
    case "leave_intro": {
      const { topic } = parsed.data as { topic: string };
      return {
        result: { kind: "leave_intro", form: true, topic },
        forModel: JSON.stringify({ shown: "intro form; the visitor fills and submits it themselves" }),
      };
    }
  }
}

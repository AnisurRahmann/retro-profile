import { z } from "zod";
import {
  blockSchema,
  busSchema,
  caseStudySchema,
  companySchema,
  flightSchema,
  goalSchema,
  metricSchema,
  missSchema,
  offerSchema,
  principleSchema,
  profileSchema,
  projectSchema,
  scenarioSchema,
  statusSchema,
  tierSchema,
  type Bus,
  type BusId,
  type Project,
  type Status,
  type StatusId,
} from "./schema";

// ─────────────────────────────────────────────────────────────
// All portfolio copy and data. Components never hardcode copy.
// Every export is parsed by zod at module load: bad content fails the build.
// Rule: nothing invented. A missing link is left out, not guessed.
// ─────────────────────────────────────────────────────────────

export const profile = profileSchema.parse({
  name: "Anisur Rahman",
  alias: "Shakil",
  monogram: "AR",
  title: "Fullstack AI Engineer, solo founder",
  line: "Fullstack AI Engineer. I build voice agents and agentic systems, and I log everything.",
  summary:
    "In production since 2018, all of it at early-stage startups including YC-backed companies. Builds production AI agents, voice agents, RAG pipelines and the verifiers that keep them honest. Owns work from architecture to release to monitoring.",
  location: "Sylhet, Bangladesh",
  hours: "Works overlapping US East Coast hours with distributed teams.",
  credentials: ["Toptal top 3% network", "B.E. Computer Science, Metropolitan University, Sylhet, 2021"],
  site: "https://arshakil.com",
  links: {
    email: { label: "pshakilwizard@gmail.com", href: "mailto:pshakilwizard@gmail.com" },
    calendar: { label: "cal.com/shakil-nee/30min", href: "https://cal.com/shakil-nee/30min" },
    github: { label: "github.com/AnisurRahmann", href: "https://github.com/AnisurRahmann" },
    linkedin: { label: "linkedin.com/in/shakil22", href: "https://linkedin.com/in/shakil22" },
  },
});

export const meta = {
  title: "Anisur Rahman (Shakil): Fullstack AI Engineer, Voice Agents and Agentic Systems",
  ogKicker: "The Training Log",
  ogTagline: "Fullstack AI Engineer. Voice agents and agentic systems.",
  jobTitle: "Fullstack AI Engineer",
} as const;

// ── Flights (page sections) ──────────────────────────────────

export const flights = z.array(flightSchema).length(9).parse([
  { n: "00", id: "platform", name: "Platform", plain: "intro", nav: "Intro" },
  { n: "01", id: "pr-board", name: "PR Board", plain: "impact metrics", nav: "Metrics" },
  { n: "02", id: "training-blocks", name: "Training Blocks", plain: "work history", nav: "Work" },
  { n: "03", id: "load-the-bar", name: "Load the Bar", plain: "projects", nav: "Projects" },
  { n: "04", id: "training-rules", name: "Training Rules", plain: "principles", nav: "Principles" },
  { n: "05", id: "next-block", name: "Next Block", plain: "goals", nav: "Goals" },
  { n: "06", id: "no-lift", name: "No Lift", plain: "misses", nav: "Misses" },
  { n: "07", id: "actual-log", name: "The Actual Log", plain: "weekly gym routine", nav: "Gym" },
  { n: "08", id: "spot-me", name: "Spot Me", plain: "contact", nav: "Contact" },
]);

// ── Categories (plate colours) and statuses (referee lights) ──

export const buses: Bus[] = z.array(busSchema).length(6).parse([
  { id: "voice", name: "Voice", stamp: "Voice", color: "#D62828" },
  { id: "agents", name: "Agents + Verifiers", stamp: "Agents", color: "#1D4E89" },
  { id: "tooling", name: "Dev Tooling", stamp: "Tooling", color: "#F2B705" },
  { id: "apps", name: "Consumer Apps", stamp: "Apps", color: "#2A9D5C" },
  { id: "media", name: "Content + Media", stamp: "Media", color: "#FFFFFF" },
  { id: "research", name: "Research + Infra", stamp: "Research", color: "#17181A" },
]);

export const statuses: Status[] = z.array(statusSchema).parse([
  { id: "shipped", name: "Shipped", call: "Good lift", plain: "shipped", lights: ["on", "on", "on"], rank: 0 },
  {
    id: "built",
    name: "Built / not deployed",
    call: "Lifted, awaiting lights",
    plain: "built, not yet in front of users",
    lights: ["on", "on", "off"],
    rank: 1,
  },
  {
    id: "in-build",
    name: "In build",
    call: "On the platform",
    plain: "in build",
    lights: ["amber", "off", "off"],
    rank: 2,
  },
  {
    id: "specd",
    name: "Spec'd",
    call: "Attempt declared",
    plain: "specified",
    lights: ["off", "off", "off"],
    rank: 3,
  },
  { id: "idea", name: "Idea", call: "Warm-up room", plain: "idea", lights: ["dotted", "dotted", "dotted"], rank: 4 },
  { id: "failed", name: "Failed", call: "No lift", plain: "missed", lights: ["red", "red", "red"], rank: 5 },
]);

// ── Metrics (PR cards) ───────────────────────────────────────

export const metrics = z.array(metricSchema).length(6).parse([
  {
    id: "pr-01",
    lift: "Support response time",
    system: "Customer support agent at a YC fintech",
    previous: "3.5 min",
    value: "10 s",
    unit: "median response",
    delta: null,
    how: "Customer support agent at a YC fintech. App rating 3.5 → 4.2.",
    plate: "10 s",
    short: "support response, was 3.5 min",
  },
  {
    id: "pr-02",
    lift: "Bank connection cost",
    system: "Plaid funnel optimisation",
    previous: "$100K/mo",
    value: "$25K",
    unit: "per month",
    delta: "75% reduction, about $900K per year",
    how: "Funnel optimisation with a custom fuzzy-matching layer.",
    plate: "$25K",
    short: "bank connection cost per month, was $100K",
  },
  {
    id: "pr-03",
    lift: "Content throughput",
    system: "AI SEO content engine",
    previous: null,
    value: "2,500+",
    unit: "posts per hour",
    delta: null,
    how: "AI SEO engine with evaluation gates. Replaced a $96K per year agency, 40% lift in organic conversion.",
    plate: "2,500+",
    short: "posts per hour",
  },
  {
    id: "pr-04",
    lift: "Catalog size",
    system: "Amazon integration via Zinc",
    previous: "10,000 SKUs",
    value: "Millions",
    unit: "of SKUs",
    delta: null,
    how: "Amazon integration via Zinc. Order failure rate about 60% → about 20%, contributing to $1M+ monthly order value.",
    plate: "Millions",
    short: "of SKUs, was 10,000",
  },
  {
    id: "pr-05",
    lift: "Engineering time on support",
    system: "Support smart actions",
    previous: null,
    value: "~80%",
    unit: "reduction",
    delta: null,
    how: "Smart actions let the support team resolve issues without engineering.",
    plate: "~80%",
    short: "less engineering time on support",
  },
  {
    id: "pr-06",
    lift: "Mean time to recovery",
    system: "Observability",
    previous: null,
    value: "60%",
    unit: "reduction",
    delta: null,
    how: "New Relic, Datadog and LangSmith tracing with dashboards, alerting and CI quality gates.",
    plate: "60%",
    short: "lower mean time to recovery",
  },
]);

// ── Experience (training blocks, newest first) ───────────────

export const blocks = z.array(blockSchema).parse([
  {
    id: "gerald",
    n: 5,
    employer: "Gerald",
    note: "YC W21",
    role: "Fullstack AI Engineer",
    period: "Aug 2022 to present",
    start: "2022-08",
    end: null,
    summary: "Primary backend and AI engineer on a three-person team at a US fintech.",
    trained: [
      "Customer support agent: median response 3.5 min → 10 s.",
      "AI SEO content engine: 2,500+ posts per hour.",
      "Plaid funnel optimisation: $100K → $25K per month.",
      "Amazon marketplace via Zinc: 10,000 SKUs to millions.",
      "Slack to Redshift agent and observability: MTTR down 60%.",
    ],
  },
  {
    id: "hasty-head",
    n: 4,
    employer: "Hasty Head",
    note: null,
    role: "Co-Founder and AI Technical Lead",
    period: "2024 to 2025",
    start: "2024-01",
    end: "2025-12",
    summary: "Digital agency shipping AI products for clients.",
    trained: [
      "Led 4 developers, 1 designer and a marketing squad.",
      "Built RAG pipelines with pgvector and LangChain.",
      "LLM evaluation and cost optimisation across client projects.",
    ],
  },
  {
    id: "recruit",
    n: 3,
    employer: "re:cruit",
    note: null,
    role: "Software Engineer",
    period: "Jun 2021 to Aug 2022",
    start: "2021-06",
    end: "2022-08",
    summary: "Dashboards and AI features for multiple YC-backed startups.",
    trained: [
      "No-code platform for Shopify (60% dev-time reduction).",
      "Real-time crypto analytics supporting a $200K raise.",
      "ML-based React Native app cutting manual work 80%.",
    ],
  },
  {
    id: "sj-innovation",
    n: 2,
    employer: "SJ Innovation",
    note: null,
    role: "Fullstack Software Engineer",
    period: "Nov 2019 to Apr 2021",
    start: "2019-11",
    end: "2021-04",
    summary: "Admin interfaces, APIs and performance work.",
    trained: [
      "Three large admin interfaces.",
      "REST APIs serving 100K+ users.",
      "Next.js performance work (40% traffic gain).",
      "Mentored 2 interns.",
    ],
  },
  {
    id: "social-energy",
    n: 1,
    employer: "Social Energy",
    note: null,
    role: "Full Stack Engineer",
    period: "Dec 2018 to Dec 2019",
    start: "2018-12",
    end: "2019-12",
    summary: "PWA for solar and battery monitoring used by hundreds of homeowners.",
    trained: ["PWA for solar and battery monitoring.", "Introduced TDD, QA issues down 60%."],
  },
]);

export const CHART_START_YEAR = 2018;

// ── Case studies (Gerald) ────────────────────────────────────

export const caseStudies = z.array(caseStudySchema).length(5).parse([
  {
    id: "support-agent",
    title: "Customer Support Agent",
    approach:
      "Conversational agent with structured tool calling, SSE streaming and conversation state, plus smart actions so the support team resolves issues without engineering.",
    flow: ["User message", "Intent + state", "Tool calls", "Streamed reply", "Human escalation"],
    result: "Median response 3.5 min → 10 s, rating 3.5 → 4.2, engineering support time down about 80%.",
  },
  {
    id: "seo-engine",
    title: "AI SEO Content Engine",
    approach:
      "Amazon Bedrock and Gemini with automated keyword targeting, backlinking, and LangSmith evaluation gates before publish.",
    flow: ["Keyword targets", "Generation", "Eval gate", "Backlinking", "Publish"],
    result: "2,500+ posts per hour, $96K per year agency replaced, 40% organic conversion lift.",
  },
  {
    id: "plaid-funnel",
    title: "Plaid Funnel Optimisation",
    approach:
      "Custom fuzzy-matching layer and a transaction-time check with Pydantic-validated pipelines so paid API calls only fire when needed.",
    flow: ["Signup", "Fuzzy match", "Transaction-time check", "Plaid call only if needed"],
    result: "$100K → $25K per month.",
  },
  {
    id: "amazon-zinc",
    title: "Amazon Marketplace via Zinc",
    approach: "Expanded catalog from 10,000 SKUs to millions with zero inventory risk.",
    flow: ["Catalog sync", "Order placement", "Failure handling", "Reconciliation"],
    result: "Order failures about 60% → about 20%, $1M+ monthly order value.",
  },
  {
    id: "slack-redshift",
    title: "Slack to Redshift Agent + Observability",
    approach:
      "Plain-English questions in Slack answered from the data warehouse, with context window optimisation and human-in-the-loop confirmation. New Relic, Datadog and LangSmith tracing with dashboards, alerting and CI quality gates.",
    flow: ["Slack question", "SQL generation", "Human confirm", "Redshift", "Answer"],
    result: "Time to insight from hours to seconds, MTTR down 60%.",
  },
]);

// ── Your Call scenarios (one per case study, exactly one actual option) ──

export const scenarios = z.array(scenarioSchema).length(5).parse([
  {
    id: "call-1",
    caseStudyId: "plaid-funnel",
    situation: "Bank connection fees are $100K a month and growing with signups.",
    order: [0, 1, 2],
    options: [
      {
        id: "a",
        label: "Negotiate a volume discount with the provider.",
        actual: false,
        tradeOff: "Lowers the rate, not the number of calls.",
      },
      {
        id: "b",
        label: "Switch to a cheaper provider.",
        actual: false,
        tradeOff: "A migration, and the waste moves with you.",
      },
      {
        id: "c",
        label:
          "Stop paying for calls you do not need. Move the paid call down the funnel behind a fuzzy-matching layer and a transaction-time check.",
        actual: true,
      },
    ],
    result: "$100K → $25K a month.",
  },
  {
    id: "call-2",
    caseStudyId: "support-agent",
    situation: "Support replies take a median 3.5 minutes and engineers get pulled into routine tickets.",
    order: [2, 0, 1],
    options: [
      { id: "a", label: "Hire more support agents.", actual: false, tradeOff: "Cost scales with tickets." },
      { id: "b", label: "Write canned replies and macros.", actual: false, tradeOff: "Faster typing, same queue." },
      {
        id: "c",
        label:
          "Build a support agent with tool calling and give the support team smart actions so they resolve issues without engineering.",
        actual: true,
      },
    ],
    result: "3.5 min → 10 s, rating 3.5 → 4.2.",
  },
  {
    id: "call-3",
    caseStudyId: "seo-engine",
    situation: "An SEO agency costs $96K a year and ships slowly.",
    order: [0, 2, 1],
    options: [
      {
        id: "a",
        label: "Renegotiate with the agency.",
        actual: false,
        tradeOff: "Still capped by human throughput.",
      },
      { id: "b", label: "Hire in-house writers.", actual: false, tradeOff: "Higher fixed cost." },
      {
        id: "c",
        label: "Build a generation engine with keyword targeting, backlinking and evaluation gates before publish.",
        actual: true,
      },
    ],
    result: "2,500+ posts per hour, agency replaced, 40% organic conversion lift.",
  },
  {
    id: "call-4",
    caseStudyId: "amazon-zinc",
    situation: "The catalog is stuck at 10,000 SKUs and about 60% of marketplace orders fail.",
    order: [1, 0, 2],
    options: [
      { id: "a", label: "Buy and hold inventory.", actual: false, tradeOff: "Capital and risk." },
      { id: "b", label: "Onboard sellers one by one.", actual: false, tradeOff: "Slow, linear growth." },
      { id: "c", label: "Integrate Amazon through Zinc with real failure handling.", actual: true },
    ],
    result: "Millions of SKUs, failures about 60% → about 20%, $1M+ monthly order value.",
  },
  {
    id: "call-5",
    caseStudyId: "slack-redshift",
    situation: "Every data question waits on an engineer to write SQL.",
    order: [2, 1, 0],
    options: [
      {
        id: "a",
        label: "Train everyone on a BI tool.",
        actual: false,
        tradeOff: "Most people never open it.",
      },
      { id: "b", label: "Hire a data analyst.", actual: false, tradeOff: "A faster queue is still a queue." },
      {
        id: "c",
        label:
          "A Slack agent that answers plain-English questions from Redshift with human confirmation, plus full observability.",
        actual: true,
      },
    ],
    result: "Hours → seconds, MTTR down 60%.",
  },
]);

// ── Projects (plates) ────────────────────────────────────────

export const projects: Project[] = z.array(projectSchema).parse([
  // VOICE
  {
    id: "P-01",
    name: "Callback AI",
    bus: "voice",
    status: "in-build",
    oneLiner:
      "Link-based AI voice screening agent for recruiters: a candidate opens a link, talks to the agent, the hiring manager gets a verified report.",
    detail:
      "Cascaded STT → LLM → TTS (the transcript is the artifact), slot-filling state machine, two-layer verifier (deterministic verbatim span check, then an LLM judge), Postgres FOR UPDATE SKIP LOCKED as the job queue, incremental transcript writes, about $0.15 per screen.",
    stack: [
      "Pipecat",
      "SmallWebRTC",
      "Deepgram Flux and Aura-2",
      "Groq / Gemini Flash-Lite for live turns",
      "Claude for reports and verification",
      "FastAPI",
      "Postgres",
      "Caddy",
      "coturn",
      "Cloudflare R2",
    ],
    next: "Public /v1 API with API keys, idempotency, signed webhooks and per-tenant caps. Second product: a customer support voice agent.",
    connectsTo: ["P-02", "P-03", "P-04"],
  },
  {
    id: "P-02",
    name: "Sift",
    bus: "voice",
    status: "in-build",
    oneLiner: "Hiring automation on top of Callback.",
    detail:
      "Post a job with an email address, the agent catches applications, issues a screening link per candidate, nudges non-finishers, then produces a report with an advance or reject recommendation. Built solo at a one-day hackathon.",
    next: "Run on real roles.",
    connectsTo: ["P-01"],
  },
  {
    id: "P-03",
    name: "Halfband",
    bus: "voice",
    status: "in-build",
    oneLiner: "AI IELTS prep platform: mock tests and an AI tutor.",
    detail:
      "Exam screens match the real computer-delivered test, and speaking tests are run by a voice examiner.",
    stack: ["Cascaded voice runtime shared with Callback", "Exam logic from Cadence"],
    next: "Deploy publicly, launch speaking mock tests.",
    connectsTo: ["P-01", "P-04"],
  },
  {
    id: "P-04",
    name: "Cadence",
    bus: "voice",
    status: "specd",
    oneLiner: "Voice exam engine with a deterministic FSM conductor.",
    detail:
      "LLM called at only three narrow points with an 800 ms hard deadline each, pre-rendered audio cache targeting 80%+ hit rate, WhisperX word-timing metrics before any LLM scoring.",
    next: "Extract a shared voice-core library once Halfband validates it.",
    connectsTo: ["P-01", "P-03"],
  },
  // AGENTS + VERIFIERS
  {
    id: "P-05",
    name: "Fitness Planner Agent",
    bus: "agents",
    status: "built",
    oneLiner: "Evidence-informed training plans with traceable provenance.",
    detail:
      "Core invariant: no LLM output ever enters a numeric field, LLMs only pick exercises from a closed table and write prose. Pipeline: safety gate → intake → rules resolver → plan solver → exercise selector → rationale writer → deterministic verifier → immutable versioned plan. Findings stored with DOI, verbatim quote, population and evidence grade.",
    next: "Build the real research corpus (40 to 60 papers, 150 to 250 human-verified findings), then connect to Lift.",
    connectsTo: ["P-13"],
  },
  {
    id: "P-06",
    name: "Subreddit Pulse",
    bus: "agents",
    status: "specd",
    oneLiner: "Research agent with a planner → sandbox → narrator → verifier → retry → post loop.",
    detail:
      "Sandboxed code execution on Modal behind an AST allowlist, two-layer verifier, retry budget of 3 with three degraded exits, eval harness with planted hallucinations.",
    next: "Deploy with a public URL.",
  },
  {
    id: "P-07",
    name: "SaveSync",
    bus: "agents",
    status: "in-build",
    oneLiner: "Capture pipeline for anything saved on social platforms.",
    detail:
      "Anything saved on social platforms is sent to a personal endpoint, stored and summarised, with agents acting on it and approvals over Discord.",
    next: "Turn it into a summaries app.",
  },
  {
    id: "P-08",
    name: "Email + Calendar Manager",
    bus: "agents",
    status: "in-build",
    oneLiner: "Local-first manager across all inboxes.",
    detail:
      "Daily summary, urgency ranking, tagging, reminders, drafted replies, meeting prep warnings. Terminal first with a light React dashboard.",
  },
  {
    id: "P-09",
    name: "Personal Shopping Agent",
    bus: "agents",
    status: "idea",
    oneLiner:
      "Describe the need and the goal, the agent researches products and flags hidden technical gotchas before purchase.",
  },
  {
    id: "P-10",
    name: "API Docs Security Scanner",
    bus: "agents",
    status: "idea",
    oneLiner:
      "Reads API documentation and finds vulnerabilities, aimed at hardening APIs against AI-agent driven attacks.",
  },
  // DEV TOOLING
  {
    id: "P-11",
    name: "Call Copilot",
    bus: "tooling",
    status: "shipped",
    oneLiner: "Open-source macOS CLI for call transcription with no meeting bot.",
    detail: "Core Audio process taps, faster-whisper, markdown transcripts, plus an MCP server.",
    install: ["brew install AnisurRahmann/tap/call-copilot", "pipx install call-copilot"],
    version: "0.3.1",
    link: { label: "github.com/AnisurRahmann/call-copilot", href: "https://github.com/AnisurRahmann/call-copilot" },
  },
  {
    id: "P-12",
    name: "LLM Wiki Kit",
    bus: "tooling",
    status: "shipped",
    oneLiner: "Open-source Claude Code skill that maintains an Obsidian knowledge base.",
    detail: "Ingests sources, cross-references pages, keeps an index and log.",
    link: { label: "github.com/AnisurRahmann/llm-wiki-kit", href: "https://github.com/AnisurRahmann/llm-wiki-kit" },
    next: "MCP server so any agent can query the wiki.",
  },
  {
    id: "P-14",
    name: "create-mvpkit",
    bus: "tooling",
    status: "shipped",
    oneLiner: "Project scaffolder for shipping MVPs fast.",
  },
  {
    id: "P-15",
    name: "Airlock",
    bus: "tooling",
    status: "in-build",
    oneLiner: "Two-gate daemon for coding agents running in full-access mode.",
    detail:
      "A PreToolUse guard that allows or denies tool calls, and a Stop verifier that checks the agent's completion claims against the actual changeset. Deterministic checks first, LLM only for ambiguous claims. Local React forensics dashboard.",
    next: "Verifier v1 for Claude Code and ZCode, then open source.",
  },
  {
    id: "P-16",
    name: "agentloop",
    bus: "tooling",
    status: "in-build",
    oneLiner:
      "Local daemon that runs a fixer agent and a reviewer agent in a PR loop across every repo on a GitHub account.",
    detail:
      "Uses two separate GitHub Apps. v1 was built and run on a real product, review quality failed the bar, so it is being rebuilt with evals, monitoring and a dashboard that separates bad reviews from bad fixes.",
    next: "Quality rebuild with an eval suite.",
  },
  {
    id: "P-17",
    name: "Forge",
    bus: "tooling",
    status: "specd",
    oneLiner: "Autonomous QA agent that hooks the coding agent's stop event, runs the tests, and fixes failures.",
  },
  {
    id: "P-18",
    name: "AgentCanvas",
    bus: "tooling",
    status: "specd",
    oneLiner: "macOS infinite canvas for running multiple agent terminals side by side.",
    stack: ["Swift 6", "SwiftUI", "SwiftTerm"],
  },
  {
    id: "P-19",
    name: "Codebase Context Tool",
    bus: "tooling",
    status: "idea",
    oneLiner:
      "Team devtool that keeps human understanding of a codebase alive when most of the code is written by agents.",
  },
  // CONSUMER APPS
  {
    id: "P-13",
    name: "Lift",
    bus: "apps",
    status: "shipped",
    oneLiner: "Local-first, voice-first gym logging app. Say the set, it is logged.",
    detail:
      "Dexie on device is the source of truth, Supabase is backup sync, local fuzzy parsing with a closed-list LLM fallback. Brutalist UI.",
    stack: ["Dexie", "Supabase", "PostHog", "Vercel"],
    next: "Native iOS release, plan wizard and saved plans, lock-screen Live Activity, camera-based technique guidance, science-based planner.",
    connectsTo: ["P-05"],
  },
  {
    id: "P-20",
    name: "Voice Expense Tracker",
    bus: "apps",
    status: "in-build",
    oneLiner:
      "Speak expenses in mixed languages and get them transcribed, categorised and summarised monthly.",
    detail: "Say \"rickshaw 40 taka, lunch 180\" and it is logged. Local-first, no separate backend.",
    stack: ["React Native", "Expo"],
    next: "First Google Play release, global.",
  },
  {
    id: "P-21",
    name: "Lipstick Try-On Widget",
    bus: "apps",
    status: "idea",
    oneLiner: "Embeddable quick virtual try-on for lipstick stores on Shopify, WordPress or any platform.",
  },
  {
    id: "P-22",
    name: "Loadshedding Map",
    bus: "apps",
    status: "idea",
    oneLiner: "Crowdsourced live map of power outages in Bangladesh with insights from the reported data.",
  },
  // CONTENT + MEDIA
  {
    id: "P-23",
    name: "ContentCued",
    bus: "media",
    status: "built",
    oneLiner: "Build-in-public content engine with a human approval gate.",
    detail:
      "Core design bet: the pipeline never invents first-hand experience, it emits [EXPERIENCE:] placeholders a human must fill before anything publishes. 173 tests.",
    stack: ["LangGraph", "FastAPI", "PostgreSQL/pgvector", "Next.js approval queue", "Astro site"],
    next: "Publish 4 pieces per week on voice agents in production.",
  },
  {
    id: "P-24",
    name: "Explainer Video Pipeline",
    bus: "media",
    status: "in-build",
    oneLiner: "Script to 2D explainer video.",
    detail:
      "WhisperX forced alignment against a ground-truth script, two-pass LLM generation for scene specs and timing, hand-built rough.js primitive library with elkjs/dagre layout.",
    next: "Short-form series on DevOps and AI engineering.",
  },
  {
    id: "P-25",
    name: "Untitled Short Film",
    bus: "media",
    status: "in-build",
    oneLiner: "90-second painterly 3D animated short about a bird and New Year's Eve fireworks.",
  },
  // RESEARCH + INFRA
  {
    id: "P-26",
    name: "AICP (AI Collaboration Protocol)",
    bus: "research",
    status: "specd",
    oneLiner:
      "Five-layer protocol positioned as a composability layer across reasoning patterns (CoT, ReAct, Reflexion, Tree-of-Thought).",
    next: "1,800-run benchmark against A2A and MCP, then an arXiv preprint.",
  },
  {
    id: "P-27",
    name: "Buildbox",
    bus: "research",
    status: "in-build",
    oneLiner: "Self-managed infrastructure where everything is made and tested before production.",
    detail:
      "Terraform-managed VPS, agent runtime where coding agents work a task list unattended, staging for every product.",
    next: "Kubernetes, hardened secrets, separate production cluster.",
  },
]);

// ── Principles (training rules, engineering column) ──────────

export const principles = z.array(principleSchema).parse([
  {
    rule: "Deterministic first, LLM last.",
    detail:
      "Every agent gets a two-layer verifier: a deterministic check, then an LLM judge only for what is still ambiguous.",
  },
  {
    rule: "No LLM output in a numeric field.",
    detail: "Models choose from closed lists and write prose. Numbers come from code.",
  },
  {
    rule: "The transcript is the artifact.",
    detail: "Cascaded pipelines over speech-to-speech when the record matters.",
  },
  {
    rule: "Tiered model routing on every system.",
    detail: "Caching, prompt compression and a cost model are part of the architecture, not an afterthought.",
  },
  {
    rule: "About 90% of the code is agent-generated, 100% of the diff is reviewed.",
    detail: "Planner model, implementer model, junior model, each with a defined role.",
  },
  { rule: "Done means a live URL that a stranger can open.", detail: null },
  { rule: "Extreme ownership.", detail: "Architecture, release, monitoring, and the metric afterwards." },
]);

export const tiers = z.array(tierSchema).length(3).parse([
  {
    tier: "Tier 1",
    models: "Fast and free models",
    share: "70 to 80% of calls",
    jobs: "classification, routing, extraction",
  },
  { tier: "Tier 2", models: "Cheap reasoning models", share: "15 to 25% of calls", jobs: null },
  { tier: "Tier 3", models: "Top models", share: "5% or less of calls", jobs: "user-facing output" },
]);

export const stack = z
  .array(z.string().min(1))
  .parse([
    "Python/FastAPI",
    "TypeScript/Node",
    "React/Next.js",
    "React Native",
    "PostgreSQL/pgvector",
    "Redis",
    "AWS",
    "Docker",
    "LangGraph",
    "LangSmith",
    "Claude API",
    "Bedrock",
    "Pipecat",
    "Deepgram",
    "MCP",
    "DeepEval",
    "New Relic",
    "Datadog",
    "Sentry",
  ]);

// ── Goals (next block) ───────────────────────────────────────

export const companies = z.array(companySchema).length(2).parse([
  {
    n: "Company 01",
    name: "Apps",
    plan: "Ships consumer apps to the App Store. Committed app: Lift.",
    target: "$1,000 per month in App Store profit",
  },
  {
    n: "Company 02",
    name: "Outcomes",
    plan: "Clients pay for one of three results: lower cost, higher revenue, or better efficiency and retention.",
    target: "Not hours, outcomes",
  },
]);

export const offer = offerSchema.parse({
  title: "Book a block",
  plain: "consulting offer",
  pitch: "Voice and phone automation for small and mid-size businesses.",
  terms: [
    { label: "Pilot", value: "Fixed fee. One phone number, one use case, 2 to 4 weeks." },
    { label: "Pass / fail", value: "A pass/fail metric is agreed before the pilot starts." },
    { label: "After", value: "A monthly fee to run and improve it." },
  ],
  cta: "Book 30 min",
});

export const goals = z.array(goalSchema).parse([
  // NOW
  {
    lift: "Lift",
    target: "Native iOS and $1K per month App Store profit",
    block: "now",
    current: { kind: "project", projectId: "P-13" },
  },
  {
    lift: "Halfband",
    target: "Deployed publicly with speaking mock tests",
    block: "now",
    current: { kind: "project", projectId: "P-03" },
  },
  { lift: "Callback AI", target: "Public /v1 API", block: "now", current: { kind: "project", projectId: "P-01" } },
  {
    lift: "agentloop",
    target: "Quality rebuild with evals",
    block: "now",
    current: { kind: "project", projectId: "P-16" },
  },
  {
    lift: "ContentCued",
    target: "Publishing 4 pieces per week",
    block: "now",
    current: { kind: "project", projectId: "P-23" },
  },
  // NEXT
  {
    lift: "Customer support voice agent",
    target: "The second Callback product",
    block: "next",
    current: { kind: "project", projectId: "P-01" },
  },
  {
    lift: "Voice automation pilot",
    target: "First paid pilot with a published pass/fail result",
    block: "next",
    current: { kind: "text", text: "No paid pilot yet" },
  },
  {
    lift: "Shared voice-core library",
    target: "Extracted from Callback and Cadence",
    block: "next",
    current: { kind: "project", projectId: "P-04" },
  },
  {
    lift: "Fitness Planner Agent",
    target: "Real research corpus, connected to Lift",
    block: "next",
    current: { kind: "project", projectId: "P-05" },
  },
  {
    lift: "Voice Expense Tracker",
    target: "First Google Play release",
    block: "next",
    current: { kind: "project", projectId: "P-20" },
  },
  {
    lift: "Airlock",
    target: "Verifier v1, open sourced",
    block: "next",
    current: { kind: "project", projectId: "P-15" },
  },
  // LATER
  {
    lift: "AICP",
    target: "1,800-run benchmark and arXiv preprint",
    block: "later",
    current: { kind: "project", projectId: "P-26" },
  },
  {
    lift: "Buildbox",
    target: "Kubernetes with a separate production cluster",
    block: "later",
    current: { kind: "project", projectId: "P-27" },
  },
  {
    lift: "Lift technique guidance",
    target: "Camera-based lifting technique guidance in Lift",
    block: "later",
    current: { kind: "project", projectId: "P-13" },
  },
  {
    lift: "Untitled Short Film",
    target: "Released",
    block: "later",
    current: { kind: "project", projectId: "P-25" },
  },
  {
    lift: "Every spec'd project",
    target: "Shipped with a live URL or formally cancelled",
    block: "later",
    current: { kind: "count-status", status: "specd", suffix: "projects specified" },
  },
]);

export const goalBlocks = [
  { id: "now", name: "Now", plain: "in progress" },
  { id: "next", name: "Next", plain: "queued" },
  { id: "later", name: "Later", plain: "after that" },
] as const;

// ── No lift (misses) ─────────────────────────────────────────

export const misses = z.array(missSchema).parse([
  {
    name: "agentloop v1",
    projectId: "P-16",
    happened:
      "Built it, ran it on a real product, and the reviews were not good enough: weak reviews, weak fixes, hallucinated findings.",
    adjustment: "Rebuilding with evals, monitoring and a way to tell a bad review from a bad fix.",
  },
  {
    name: "ContentCued",
    projectId: "P-23",
    happened: "Engine finished with 173 tests and has published nothing yet.",
    adjustment: "4 pieces a week, starting now.",
  },
  {
    name: "Fitness Planner Agent",
    projectId: "P-05",
    happened: "Passes every test against a synthetic corpus, has never seen a real paper.",
    adjustment: "Build the human-verified research corpus before calling it done.",
  },
]);

export const missPattern =
  "The pattern behind all three: strong architecture, slow last mile. The rule now is that done means a live URL a stranger can open.";

/** One line about life off the platform (bike riding). Not provided yet, so nothing renders. */
export const offPlatform: string | null = null;

// ── Interface copy ───────────────────────────────────────────

export const ui = {
  flight: "Flight",
  skipToContent: "Skip to content",
  topbar: {
    home: "Home",
    navLabel: "Flights",
    menu: "Flights",
    cta: "Spot me",
    ctaPlain: "Book a call",
    lightsOn: "Lights on",
    lightsOut: "Lights out",
    lightsOnPlain: "light theme",
    lightsOutPlain: "dark theme",
    lightsAria: "Switch between light theme and dark theme",
    gym: "Gym log",
    notes: "Notes",
  },
  hero: {
    aliasLabel: "Known as",
    barbellAria: "A barbell loaded with six plates, one per PR. The same six numbers are listed as text below.",
    prListLabel: "Six PRs",
    prListPlain: "headline metrics",
    prLabel: "PR",
    credentialsLabel: "Credentials",
    baseLabel: "Based in",
    paths: [
      { label: "Hiring an engineer", plain: "work history", href: "#training-blocks" },
      { label: "Need an outcome built", plain: "goals and the consulting offer", href: "#next-block" },
      { label: "Just browsing", plain: "projects", href: "#load-the-bar" },
    ],
  },
  counts: {
    prs: "PRs",
    blocks: "blocks",
    plates: "plates",
    rules: "rules",
    lifts: "lifts",
    misses: "misses",
    days: "days",
    lines: "lines",
    scenarios: "scenarios",
    since: "Since",
  },
  prBoard: {
    previous: "Previous",
    next: "New",
    pr: "PR",
    how: "How",
  },
  blocks: {
    chartAria: "Work history as a timeline from 2018 to now. Each employer is one bar. The same blocks are listed below.",
    block: "Block",
    current: "Current block",
    currentPlain: "current role",
    now: "Now",
    trained: "Trained",
    trainedPlain: "what the work was",
  },
  yourCall: {
    name: "Your Call",
    plain: "case studies",
    intro:
      "Five real situations with real numbers. Pick what you would do, then see what I did. No score, no timer, no wrong answers.",
    skip: "Just show me what he did",
    skipPlain: "reveal all five outcomes",
    situation: "Situation",
    options: "Your call",
    optionsPlain: "pick one",
    did: "What I did",
    actual: "The call I made",
    tradeOff: "Trade-off",
    flow: "Flow",
    flowPlain: "how it runs",
    result: "Result",
    announce: "Outcome revealed below.",
  },
  loadTheBar: {
    intro:
      "Every project is a plate. Colour is the category, size is the status. Drag a plate onto the bar, click it, or focus it and press Enter.",
    skip: "Skip, show me the list",
    rack: "Plate rack",
    rackPlain: "all projects by category",
    bar: "The bar",
    barPlain: "projects you have opened",
    barAria: "Barbell. Loaded plates are listed below it.",
    loaded: "Loaded",
    strip: "Strip the bar",
    stripPlain: "unload everything",
    onBar: "On the bar",
    emptyBar: "Nothing loaded yet.",
    emptyTitle: "Empty bar",
    emptyHint: "Load a plate to read the project.",
    load: "Load",
    unload: "Unload",
    loadedTag: "on the bar",
    stack: "Stack",
    install: "Install",
    version: "Version",
    link: "Link",
    next: "Next attempt",
    nextPlain: "what ships next",
    connects: "Connects to",
    inRegister: "See it in the register",
    sizeLegend: "Plate size",
    sizeLegendPlain: "status",
    colorLegend: "Plate colour",
    colorLegendPlain: "category",
    goodLift: "Good lift",
    goodLiftPlain: "every shipped project is on the bar",
    dropHint: "Drop here",
    announceLoaded: "Loaded {name}, {n} of {total}",
    announceUnloaded: "Unloaded {name}, {n} of {total}",
    announceStripped: "Bar stripped, 0 of {total}",
  },
  register: {
    title: "The register",
    plain: "every project as a table",
    columns: {
      id: "ID",
      name: "Name",
      category: "Category",
      status: "Status",
      stack: "Stack",
      next: "Next attempt",
    },
    filterCategory: "Category",
    filterStatus: "Status",
    all: "All",
    sort: "Sort by",
    showing: "Showing",
    reset: "Reset",
    detail: "Detail",
    none: "No projects match these filters.",
    sortAsc: "ascending",
    sortDesc: "descending",
  },
  rules: {
    gym: "In the gym",
    gymPlain: "how I train",
    production: "In production",
    productionPlain: "how I engineer",
    stack: "Stack",
    stackPlain: "tools in regular use",
    tiers: "Tiered model routing",
    tiersPlain: "which model takes which call",
  },
  nextBlock: {
    attempts: "Declared attempts",
    attemptsPlain: "the two companies",
    target: "Target",
    program: "The program",
    programPlain: "goals in order",
    columns: { lift: "Lift", liftPlain: "the goal", current: "Current", target: "Target", block: "Block" },
  },
  noLift: {
    intro: "Three attempts that missed, and what changed.",
    happened: "What happened",
    adjustment: "Adjustment",
    pattern: "The pattern",
  },
  actualLog: {
    intro: "The split is real. This is the week, Friday to Thursday.",
    offPlatform: "Off the platform:",
  },
  contact: {
    rows: { email: "Email", calendar: "Calendar", github: "GitHub", linkedin: "LinkedIn" },
    book: "Book 30 min",
    resume: "Download resume",
    resumePlain: "PDF",
  },
  footer: {
    logged: "Logged from Sylhet, Bangladesh.",
    lastEntry: "Last entry",
    keys: "Keyboard",
    keyFlights: "0 to 8 jump to a flight",
    keyLights: "L toggles lights",
    keyGym: "G opens the gym log",
  },
  notes: {
    title: "Coach's Notes",
    plain: "writing",
    metaTitle: "Coach's Notes: Writing by Shakil",
    metaDescription: "Short notes on cost engineering, AI systems, observability and working remotely from Sylhet.",
    entries: "entries",
    back: "All notes",
    read: "read",
    link: "Coach's Notes",
    linkPlain: "writing",
  },
  notFound: {
    title: "No lift",
    plain: "page not found",
    body: "That page is not in the log.",
    back: "Back to the portfolio",
  },
} as const;

// ── Derived lookups and cross-reference checks ───────────────

export function busById(id: BusId): Bus {
  const bus = buses.find((entry) => entry.id === id);
  if (!bus) throw new Error(`content.ts: unknown bus "${id}"`);
  return bus;
}

export function statusById(id: StatusId | "failed"): Status {
  const status = statuses.find((entry) => entry.id === id);
  if (!status) throw new Error(`content.ts: unknown status "${id}"`);
  return status;
}

export function projectById(id: string): Project {
  const project = projects.find((entry) => entry.id === id);
  if (!project) throw new Error(`content.ts: unknown project "${id}"`);
  return project;
}

/** Problems that a schema cannot see: duplicate ids and dangling references. Empty when content is sound. */
export function contentProblems(): string[] {
  const problems: string[] = [];
  const ids = projects.map((project) => project.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) problems.push(`duplicate project id ${id}`);
    seen.add(id);
  }
  for (const project of projects) {
    for (const target of project.connectsTo) {
      if (!seen.has(target)) problems.push(`${project.id} connectsTo unknown ${target}`);
      if (target === project.id) problems.push(`${project.id} connects to itself`);
    }
  }
  const caseIds = new Set(caseStudies.map((study) => study.id));
  for (const scenario of scenarios) {
    if (!caseIds.has(scenario.caseStudyId)) problems.push(`${scenario.id} points at unknown case study`);
    if (scenario.options.filter((option) => option.actual).length !== 1)
      problems.push(`${scenario.id} must have exactly one actual option`);
    if ([...scenario.order].sort().join() !== "0,1,2") problems.push(`${scenario.id} order must permute 0,1,2`);
    for (const option of scenario.options) {
      if (!option.actual && !option.tradeOff) problems.push(`${scenario.id}/${option.id} needs a tradeOff`);
    }
  }
  if (new Set(scenarios.map((scenario) => scenario.caseStudyId)).size !== caseStudies.length)
    problems.push("every case study needs exactly one scenario");
  for (const goal of goals) {
    if (goal.current.kind === "project" && !seen.has(goal.current.projectId))
      problems.push(`goal "${goal.lift}" points at unknown ${goal.current.projectId}`);
  }
  for (const miss of misses) {
    if (miss.projectId && !seen.has(miss.projectId)) problems.push(`miss "${miss.name}" points at unknown project`);
  }
  if (new Set(flights.map((flight) => flight.id)).size !== flights.length) problems.push("duplicate flight id");
  if (new Set(metrics.map((metric) => metric.id)).size !== metrics.length) problems.push("duplicate metric id");
  return problems;
}

const problems = contentProblems();
if (problems.length > 0) throw new Error(`content.ts is inconsistent:\n- ${problems.join("\n- ")}`);

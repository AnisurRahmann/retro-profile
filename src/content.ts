/**
 * ALL copy and data for the site live in this file.
 * Components never hardcode copy. Shapes are validated by src/content.schema.ts
 * at build time (src/lib/validate.ts) and in the vitest suite.
 *
 * Rules:
 * - Do not invent metrics, clients, dates or links.
 * - A project with no confirmed link has no `link` field. See docs/OPEN_QUESTIONS.md.
 */
import type {
  Bus,
  CaseStudy,
  Content,
  Experience,
  Goals,
  Links,
  Metric,
  Principle,
  Profile,
  Project,
  RoutingTier,
  SheetMeta,
  Status,
} from "./content.schema";

export const SITE_URL = "https://arshakil.com";

export const profile: Profile = {
  name: "Anisur Rahman",
  alias: "Shakil",
  monogram: "AR/S",
  title: "Fullstack AI Engineer, solo founder",
  roleLine:
    "Fullstack AI Engineer. I build voice agents and agentic systems that survive production.",
  summary:
    "About 10 years of backend and fullstack engineering, all of it at early-stage startups including YC-backed companies. Builds production AI agents, voice agents, RAG pipelines and the verifiers that keep them honest. Owns work from architecture to release to monitoring.",
  location: "Sylhet, Bangladesh",
  hours: "Overlapping US East Coast hours, distributed teams",
  credentials: [
    "Toptal top 3% network",
    "B.E. Computer Science, Metropolitan University, Sylhet, 2021",
  ],
  drawnBy: "A. Rahman",
};

export const links: Links = {
  site: { label: "Site", display: "arshakil.com", href: "https://arshakil.com" },
  github: {
    label: "GitHub",
    display: "github.com/AnisurRahmann",
    href: "https://github.com/AnisurRahmann",
  },
  linkedin: {
    label: "LinkedIn",
    display: "linkedin.com/in/shakil22",
    href: "https://linkedin.com/in/shakil22",
  },
  email: {
    label: "Email",
    display: "pshakilwizard@gmail.com",
    href: "mailto:pshakilwizard@gmail.com",
  },
  calendar: {
    label: "Calendar",
    display: "cal.com/shakil-nee/30min",
    href: "https://cal.com/shakil-nee/30min",
  },
};

export const sheets: SheetMeta[] = [
  { no: "00", title: "Cover", heading: "Anisur Rahman", rev: "E", redlineGoalId: "G-06" },
  {
    no: "01",
    title: "Impact",
    heading: "Impact",
    intro:
      "Six measured changes. Each one is dimensioned from before to after and names the system that produced it.",
    rev: "E",
    redlineGoalId: "G-07",
  },
  {
    no: "02",
    title: "Production work",
    heading: "Production work",
    intro:
      "Work history as a revision table, latest revision on top, followed by five systems built at Gerald.",
    rev: "E",
  },
  {
    no: "03",
    title: "System map",
    heading: "System map",
    intro:
      "Every project as a component on one of six buses. The outline of each node is its honest status.",
    rev: "E",
    redlineGoalId: "G-16",
  },
  {
    no: "04",
    title: "Project register",
    heading: "Project register",
    intro: "The same projects as a parts list. Sort it, filter it, open any row.",
    rev: "E",
  },
  {
    no: "05",
    title: "How I build",
    heading: "How I build",
    intro: "General notes. They apply to every sheet in this set.",
    rev: "E",
    redlineGoalId: "G-11",
  },
  {
    no: "06",
    title: "Next revisions",
    heading: "Next revisions",
    intro: "Goals only. Nothing on this sheet exists yet, so all of it is drawn in red.",
    rev: "E",
  },
  {
    no: "07",
    title: "Contact",
    heading: "Transmittal",
    rev: "E",
  },
];

export const metrics: Metric[] = [
  {
    id: "M-01",
    label: "Support response time",
    delta: { prefix: "", value: 21, suffix: "×", group: false },
    deltaUnit: "faster median response",
    before: "3.5 min",
    after: "10 s",
    system: "Customer support agent at a YC fintech. App rating 3.5 → 4.2.",
    derived: true,
  },
  {
    id: "M-02",
    label: "Bank connection cost",
    delta: { prefix: "−", value: 75, suffix: "%", group: false },
    deltaUnit: "about $900K per year",
    before: "$100K / mo",
    after: "$25K / mo",
    system: "Funnel optimisation with a custom fuzzy-matching layer.",
    derived: false,
  },
  {
    id: "M-03",
    label: "Content throughput",
    delta: { prefix: "", value: 2500, suffix: "+", group: true },
    deltaUnit: "posts per hour",
    before: "$96K / yr agency",
    after: "In-house engine",
    system:
      "AI SEO engine with evaluation gates. Replaced a $96K per year agency, 40% lift in organic conversion.",
    derived: false,
  },
  {
    id: "M-04",
    label: "Catalog size",
    delta: { prefix: "$", value: 1, suffix: "M+", group: false },
    deltaUnit: "monthly order value contributed to",
    before: "10,000 SKUs",
    after: "Millions of SKUs",
    system: "Amazon integration via Zinc. Order failure rate about 60% → about 20%.",
    derived: false,
  },
  {
    id: "M-05",
    label: "Engineering time on support",
    delta: { prefix: "−", value: 80, suffix: "%", group: false },
    deltaUnit: "about, engineering hours",
    before: "Baseline",
    after: "About 20% of baseline",
    system: "Smart actions, so the support team resolves issues without engineering.",
    derived: false,
  },
  {
    id: "M-06",
    label: "Mean time to recovery",
    delta: { prefix: "−", value: 60, suffix: "%", group: false },
    deltaUnit: "MTTR",
    before: "Baseline",
    after: "40% of baseline",
    system:
      "New Relic, Datadog and LangSmith tracing with dashboards, alerting and CI quality gates.",
    derived: false,
  },
];

export const experience: Experience[] = [
  {
    rev: "E",
    from: "Aug 2022",
    to: null,
    org: "Gerald (YC W21)",
    role: "Fullstack AI Engineer",
    change: "Primary backend and AI engineer on a three-person team at a US fintech.",
    bullets: [
      "Customer support agent: median response 3.5 min → 10 s, app rating 3.5 → 4.2.",
      "AI SEO content engine: 2,500+ posts per hour, $96K per year agency replaced.",
      "Plaid funnel optimisation: $100K → $25K per month.",
      "Amazon marketplace via Zinc: 10,000 SKUs to millions, $1M+ monthly order value.",
      "Slack to Redshift agent and observability: MTTR down 60%.",
    ],
  },
  {
    rev: "D",
    from: "2024",
    to: "2025",
    org: "Hasty Head",
    role: "Co-Founder and AI Technical Lead",
    change: "Digital agency shipping AI products for clients.",
    bullets: [
      "Led 4 developers, 1 designer and a marketing squad.",
      "Built RAG pipelines with pgvector and LangChain.",
      "LLM evaluation and cost optimisation across client projects.",
    ],
  },
  {
    rev: "C",
    from: "Jun 2021",
    to: "Aug 2022",
    org: "re:cruit",
    role: "Software Engineer",
    change: "Dashboards and AI features for multiple YC-backed startups.",
    bullets: [
      "No-code platform for Shopify (60% dev-time reduction).",
      "Real-time crypto analytics supporting a $200K raise.",
      "ML-based React Native app cutting manual work 80%.",
    ],
  },
  {
    rev: "B",
    from: "Nov 2019",
    to: "Apr 2021",
    org: "SJ Innovation",
    role: "Fullstack Software Engineer",
    change: "Three large admin interfaces and REST APIs serving 100K+ users.",
    bullets: [
      "Three large admin interfaces.",
      "REST APIs serving 100K+ users.",
      "Next.js performance work (40% traffic gain).",
      "Mentored 2 interns.",
    ],
  },
  {
    rev: "A",
    from: "Dec 2018",
    to: "Dec 2019",
    org: "Social Energy",
    role: "Full Stack Engineer",
    change: "PWA for solar and battery monitoring used by hundreds of homeowners.",
    bullets: [
      "PWA for solar and battery monitoring used by hundreds of homeowners.",
      "Introduced TDD, QA issues down 60%.",
    ],
  },
];

export const caseStudies: CaseStudy[] = [
  {
    id: "CS-01",
    title: "Customer Support Agent",
    problem:
      "Median support response sat at 3.5 minutes, and resolving an issue needed engineering time.",
    built:
      "Conversational agent with structured tool calling, SSE streaming and conversation state, plus smart actions so the support team resolves issues without engineering.",
    flow: ["User message", "Intent + state", "Tool calls", "Streamed reply", "Human escalation"],
    result:
      "Median response 3.5 min → 10 s, rating 3.5 → 4.2, engineering support time down about 80%.",
  },
  {
    id: "CS-02",
    title: "AI SEO Content Engine",
    problem: "SEO content came from an agency at $96K per year.",
    built:
      "Amazon Bedrock and Gemini with automated keyword targeting, backlinking, and LangSmith evaluation gates before publish.",
    flow: ["Keyword targets", "Generation", "Eval gate", "Backlinking", "Publish"],
    result: "2,500+ posts per hour, $96K per year agency replaced, 40% organic conversion lift.",
  },
  {
    id: "CS-03",
    title: "Plaid Funnel Optimisation",
    problem: "Bank connection cost ran at $100K per month in paid API calls.",
    built:
      "Custom fuzzy-matching layer and a transaction-time check with Pydantic-validated pipelines so paid API calls only fire when needed.",
    flow: ["Signup", "Fuzzy match", "Transaction-time check", "Plaid call only if needed"],
    result: "$100K → $25K per month.",
  },
  {
    id: "CS-04",
    title: "Amazon Marketplace via Zinc",
    problem: "The catalog held 10,000 SKUs and about 60% of orders failed.",
    built: "Expanded catalog from 10,000 SKUs to millions with zero inventory risk.",
    flow: ["Catalog sync", "Order placement", "Failure handling", "Reconciliation"],
    result: "Order failures about 60% → about 20%, $1M+ monthly order value.",
  },
  {
    id: "CS-05",
    title: "Slack to Redshift Agent + Observability",
    problem: "A data question took hours to turn into an answer.",
    built:
      "Plain-English questions in Slack answered from the data warehouse, with context window optimisation and human-in-the-loop confirmation. New Relic, Datadog and LangSmith tracing with dashboards, alerting and CI quality gates.",
    flow: ["Slack question", "SQL generation", "Human confirm", "Redshift", "Answer"],
    result: "Time to insight from hours to seconds, MTTR down 60%.",
  },
];

export const buses: Bus[] = [
  { id: "VOICE", label: "Voice" },
  { id: "AGENTS", label: "Agents + Verifiers" },
  { id: "DEVTOOLS", label: "Dev Tooling" },
  { id: "CONSUMER", label: "Consumer Apps" },
  { id: "CONTENT", label: "Content + Media" },
  { id: "RESEARCH", label: "Research" },
];

export const statuses: Status[] = [
  { id: "SHIPPED", label: "Shipped", line: "Solid ink line", meaning: "Shipped and in use" },
  { id: "IN_BUILD", label: "In build", line: "Hatched fill", meaning: "In build right now" },
  {
    id: "BUILT",
    label: "Built / not deployed",
    line: "Solid line, dashed inner line",
    meaning: "Built, not yet deployed",
  },
  { id: "SPECD", label: "Spec'd", line: "Dashed line", meaning: "Specified or planned, not built" },
  { id: "IDEA", label: "Idea", line: "Dotted line", meaning: "Idea stage" },
];

export const projects: Project[] = [
  // BUS: VOICE
  {
    id: "P-01",
    name: "Callback AI",
    bus: "VOICE",
    status: "IN_BUILD",
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
    redline:
      "Public /v1 API with API keys, idempotency, signed webhooks and per-tenant caps. Second product: a customer support voice agent.",
    redlineTag: "public /v1 API",
    connectsTo: ["P-02", "P-03", "P-04"],
  },
  {
    id: "P-02",
    name: "Sift",
    bus: "VOICE",
    status: "IN_BUILD",
    oneLiner:
      "Hiring automation on top of Callback: post a job with an email address, the agent catches applications, issues a screening link per candidate, nudges non-finishers, then produces a report with an advance or reject recommendation.",
    detail: "Built solo at a one-day hackathon.",
    stack: [],
    redline: "Run on real roles.",
    redlineTag: "run on real roles",
    connectsTo: ["P-01"],
  },
  {
    id: "P-03",
    name: "Halfband",
    bus: "VOICE",
    status: "IN_BUILD",
    oneLiner:
      "AI IELTS prep platform: mock tests and an AI tutor with exam screens that match the real computer-delivered test, speaking tests run by a voice examiner.",
    stack: ["Cascaded voice runtime shared with Callback", "Exam logic from Cadence"],
    redline: "Deploy publicly, launch speaking mock tests.",
    redlineTag: "deploy publicly",
    connectsTo: ["P-01", "P-04"],
  },
  {
    id: "P-04",
    name: "Cadence",
    bus: "VOICE",
    status: "SPECD",
    oneLiner:
      "Voice exam engine: deterministic FSM conductor, LLM called at only three narrow points with an 800 ms hard deadline each.",
    detail:
      "Pre-rendered audio cache targeting 80%+ hit rate, WhisperX word-timing metrics before any LLM scoring.",
    stack: ["WhisperX"],
    redline: "Extract a shared voice-core library once Halfband validates it.",
    redlineTag: "shared voice-core",
    connectsTo: ["P-01", "P-03"],
  },

  // BUS: AGENTS + VERIFIERS
  {
    id: "P-05",
    name: "Fitness Planner Agent",
    bus: "AGENTS",
    status: "BUILT",
    oneLiner:
      "Evidence-informed training plans with traceable provenance. Core invariant: no LLM output ever enters a numeric field, LLMs only pick exercises from a closed table and write prose.",
    detail:
      "Pipeline: safety gate → intake → rules resolver → plan solver → exercise selector → rationale writer → deterministic verifier → immutable versioned plan. Findings stored with DOI, verbatim quote, population and evidence grade.",
    stack: [],
    redline:
      "Build the real research corpus (40 to 60 papers, 150 to 250 human-verified findings), then connect to Lift.",
    redlineTag: "research corpus",
    connectsTo: ["P-13"],
  },
  {
    id: "P-06",
    name: "Subreddit Pulse",
    bus: "AGENTS",
    status: "SPECD",
    oneLiner: "Research agent with a planner → sandbox → narrator → verifier → retry → post loop.",
    detail:
      "Sandboxed code execution on Modal behind an AST allowlist, two-layer verifier, retry budget of 3 with three degraded exits, eval harness with planted hallucinations.",
    stack: ["Modal"],
    redline: "Deploy with a public URL.",
    redlineTag: "deploy, public URL",
    connectsTo: [],
  },
  {
    id: "P-07",
    name: "SaveSync",
    bus: "AGENTS",
    status: "IN_BUILD",
    oneLiner:
      "Capture pipeline: anything saved on social platforms is sent to a personal endpoint, stored and summarised, with agents acting on it and approvals over Discord.",
    stack: ["Discord"],
    redline: "Turn it into a summaries app.",
    redlineTag: "summaries app",
    connectsTo: [],
  },
  {
    id: "P-08",
    name: "Email + Calendar Manager",
    bus: "AGENTS",
    status: "IN_BUILD",
    oneLiner:
      "Local-first manager across all inboxes: daily summary, urgency ranking, tagging, reminders, drafted replies, meeting prep warnings.",
    detail: "Terminal first with a light React dashboard.",
    stack: ["React"],
    connectsTo: [],
  },
  {
    id: "P-09",
    name: "Personal Shopping Agent",
    bus: "AGENTS",
    status: "IDEA",
    oneLiner:
      "Describe the need and the goal, the agent researches products and flags hidden technical gotchas before purchase.",
    stack: [],
    connectsTo: [],
  },
  {
    id: "P-10",
    name: "API Docs Security Scanner",
    bus: "AGENTS",
    status: "IDEA",
    oneLiner:
      "Reads API documentation and finds vulnerabilities, aimed at hardening APIs against AI-agent driven attacks.",
    stack: [],
    connectsTo: [],
  },

  // BUS: DEV TOOLING
  {
    id: "P-11",
    name: "Call Copilot",
    bus: "DEVTOOLS",
    status: "SHIPPED",
    oneLiner:
      "Open-source macOS CLI for call transcription with no meeting bot: Core Audio process taps, faster-whisper, markdown transcripts, plus an MCP server.",
    stack: ["Core Audio process taps", "faster-whisper", "MCP"],
    link: {
      label: "Source",
      display: "github.com/AnisurRahmann/call-copilot",
      href: "https://github.com/AnisurRahmann/call-copilot",
    },
    install: ["brew install AnisurRahmann/tap/call-copilot", "pipx install call-copilot"],
    version: "0.3.1",
    connectsTo: [],
  },
  {
    id: "P-12",
    name: "LLM Wiki Kit",
    bus: "DEVTOOLS",
    status: "SHIPPED",
    oneLiner:
      "Open-source Claude Code skill that maintains an Obsidian knowledge base: ingests sources, cross-references pages, keeps an index and log.",
    stack: ["Claude Code skill", "Obsidian"],
    link: {
      label: "Source",
      display: "github.com/AnisurRahmann/llm-wiki-kit",
      href: "https://github.com/AnisurRahmann/llm-wiki-kit",
    },
    redline: "MCP server so any agent can query the wiki.",
    redlineTag: "MCP server",
    connectsTo: [],
  },
  {
    id: "P-14",
    name: "create-mvpkit",
    bus: "DEVTOOLS",
    status: "SHIPPED",
    oneLiner: "Project scaffolder for shipping MVPs fast.",
    stack: [],
    connectsTo: [],
  },
  {
    id: "P-15",
    name: "Airlock",
    bus: "DEVTOOLS",
    status: "IN_BUILD",
    oneLiner:
      "Two-gate daemon for coding agents running in full-access mode: a PreToolUse guard that allows or denies tool calls, and a Stop verifier that checks the agent's completion claims against the actual changeset.",
    detail:
      "Deterministic checks first, LLM only for ambiguous claims. Local React forensics dashboard.",
    stack: ["React"],
    redline: "Verifier v1 for Claude Code and ZCode, then open source.",
    redlineTag: "verifier v1",
    connectsTo: [],
  },
  {
    id: "P-16",
    name: "agentloop",
    bus: "DEVTOOLS",
    status: "IN_BUILD",
    oneLiner:
      "Local daemon that runs a fixer agent and a reviewer agent in a PR loop across every repo on a GitHub account, using two separate GitHub Apps.",
    detail:
      "v1 was built and run on a real product, review quality failed the bar, so it is being rebuilt with evals, monitoring and a dashboard that separates bad reviews from bad fixes.",
    stack: ["GitHub Apps"],
    redline: "Quality rebuild with an eval suite.",
    redlineTag: "quality rebuild",
    connectsTo: [],
  },
  {
    id: "P-17",
    name: "Forge",
    bus: "DEVTOOLS",
    status: "SPECD",
    oneLiner:
      "Autonomous QA agent that hooks the coding agent's stop event, runs the tests, and fixes failures.",
    stack: [],
    connectsTo: [],
  },
  {
    id: "P-18",
    name: "AgentCanvas",
    bus: "DEVTOOLS",
    status: "SPECD",
    oneLiner: "macOS infinite canvas for running multiple agent terminals side by side.",
    stack: ["Swift 6", "SwiftUI", "SwiftTerm"],
    connectsTo: [],
  },
  {
    id: "P-19",
    name: "Codebase Context Tool",
    bus: "DEVTOOLS",
    status: "IDEA",
    oneLiner:
      "Team devtool that keeps human understanding of a codebase alive when most of the code is written by agents.",
    stack: [],
    connectsTo: [],
  },

  // BUS: CONSUMER APPS
  {
    id: "P-13",
    name: "Lift",
    bus: "CONSUMER",
    status: "SHIPPED",
    oneLiner: "Local-first, voice-first gym logging app. Say the set, it is logged.",
    detail:
      "Dexie on device is the source of truth, Supabase is backup sync, local fuzzy parsing with a closed-list LLM fallback. Brutalist UI.",
    stack: ["Dexie", "Supabase", "PostHog", "Vercel"],
    redline:
      "Native iOS release, plan wizard and saved plans, lock-screen Live Activity, camera-based technique guidance, science-based planner.",
    redlineTag: "native iOS release",
    connectsTo: ["P-05"],
  },
  {
    id: "P-20",
    name: "Voice Expense Tracker",
    bus: "CONSUMER",
    status: "IN_BUILD",
    oneLiner:
      'Speak expenses in mixed languages ("rickshaw 40 taka, lunch 180") and get them transcribed, categorised and summarised monthly.',
    detail: "Local-first, no separate backend.",
    stack: ["React Native", "Expo"],
    redline: "First Google Play release, global.",
    redlineTag: "Google Play",
    connectsTo: [],
  },
  {
    id: "P-21",
    name: "Lipstick Try-On Widget",
    bus: "CONSUMER",
    status: "IDEA",
    oneLiner:
      "Embeddable quick virtual try-on for lipstick stores on Shopify, WordPress or any platform.",
    stack: [],
    connectsTo: [],
  },
  {
    id: "P-22",
    name: "Loadshedding Map",
    bus: "CONSUMER",
    status: "IDEA",
    oneLiner:
      "Crowdsourced live map of power outages in Bangladesh with insights from the reported data.",
    stack: [],
    connectsTo: [],
  },

  // BUS: CONTENT + MEDIA
  {
    id: "P-23",
    name: "ContentCued",
    bus: "CONTENT",
    status: "BUILT",
    oneLiner: "Build-in-public content engine with a human approval gate.",
    detail:
      "Core design bet: the pipeline never invents first-hand experience, it emits [EXPERIENCE:] placeholders a human must fill before anything publishes. 173 tests.",
    stack: ["LangGraph", "FastAPI", "PostgreSQL/pgvector", "Next.js approval queue", "Astro site"],
    redline: "Publish 4 pieces per week on voice agents in production.",
    redlineTag: "4 pieces per week",
    connectsTo: [],
  },
  {
    id: "P-24",
    name: "Explainer Video Pipeline",
    bus: "CONTENT",
    status: "IN_BUILD",
    oneLiner: "Script to 2D explainer video.",
    detail:
      "WhisperX forced alignment against a ground-truth script, two-pass LLM generation for scene specs and timing, hand-built rough.js primitive library with elkjs/dagre layout.",
    stack: ["WhisperX", "rough.js", "elkjs/dagre"],
    redline: "Short-form series on DevOps and AI engineering.",
    redlineTag: "short-form series",
    connectsTo: [],
  },
  {
    id: "P-25",
    name: "Untitled Short Film",
    bus: "CONTENT",
    status: "IN_BUILD",
    oneLiner: "90-second painterly 3D animated short about a bird and New Year's Eve fireworks.",
    stack: [],
    connectsTo: [],
  },

  // BUS: RESEARCH
  {
    id: "P-26",
    name: "AICP (AI Collaboration Protocol)",
    bus: "RESEARCH",
    status: "SPECD",
    oneLiner:
      "Five-layer protocol positioned as a composability layer across reasoning patterns (CoT, ReAct, Reflexion, Tree-of-Thought).",
    stack: [],
    redline: "1,800-run benchmark against A2A and MCP, then an arXiv preprint.",
    redlineTag: "1,800-run bench",
    connectsTo: [],
  },
  {
    id: "P-27",
    name: "Buildbox",
    bus: "RESEARCH",
    status: "IN_BUILD",
    oneLiner: "Self-managed infrastructure where everything is made and tested before production.",
    detail:
      "Terraform-managed VPS, agent runtime where coding agents work a task list unattended, staging for every product.",
    stack: ["Terraform"],
    redline: "Kubernetes, hardened secrets, separate production cluster.",
    redlineTag: "Kubernetes",
    connectsTo: [],
  },
];

export const principles: Principle[] = [
  {
    n: 1,
    title: "Deterministic first, LLM last.",
    body: "Every agent gets a two-layer verifier: a deterministic check, then an LLM judge only for what is still ambiguous.",
  },
  {
    n: 2,
    title: "No LLM output in a numeric field.",
    body: "Models choose from closed lists and write prose. Numbers come from code.",
  },
  {
    n: 3,
    title: "The transcript is the artifact.",
    body: "Cascaded pipelines over speech-to-speech when the record matters.",
  },
  {
    n: 4,
    title: "Tiered model routing on every system.",
    body: "Tier 1 fast and free models for 70 to 80% of calls (classification, routing, extraction), Tier 2 cheap reasoning models for 15 to 25%, Tier 3 top models for 5% or less (user-facing output). Caching, prompt compression and a cost model are part of the architecture, not an afterthought.",
  },
  {
    n: 5,
    title: "About 90% of the code is agent-generated, 100% of the diff is reviewed.",
    body: "Planner model, implementer model, junior model, each with a defined role.",
  },
  {
    n: 6,
    title: "Done means a live URL that a stranger can open.",
  },
  {
    n: 7,
    title: "Extreme ownership.",
    body: "Architecture, release, monitoring, and the metric afterwards.",
  },
];

export const stackLine: string[] = [
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
];

/** Shares are the midpoints of the stated ranges and sum to 100. */
export const routing: RoutingTier[] = [
  {
    tier: "Tier 1",
    share: 75,
    range: "70 to 80% of calls",
    use: "Fast and free models: classification, routing, extraction",
  },
  { tier: "Tier 2", share: 20, range: "15 to 25%", use: "Cheap reasoning models" },
  { tier: "Tier 3", share: 5, range: "5% or less", use: "Top models: user-facing output" },
];

export const goals: Goals = {
  companies: [
    {
      id: "Company 01",
      name: "Apps",
      body: "Ships consumer apps to the App Store.",
      target: "Single target: $1,000 per month in App Store profit.",
      projectIds: ["P-13"],
    },
    {
      id: "Company 02",
      name: "Outcomes",
      body: "Clients pay for one of three results: lower cost, higher revenue, or better efficiency and retention.",
      target: "Not hours, outcomes.",
      projectIds: [],
    },
  ],
  offer: {
    title: "Voice and phone automation for small and mid-size businesses",
    rows: [
      { label: "Scope", value: "Fixed-fee pilot: one phone number, one use case." },
      { label: "Duration", value: "2 to 4 weeks." },
      { label: "Acceptance", value: "A pass/fail metric is agreed before the pilot starts." },
      { label: "After pilot", value: "A monthly fee to run and improve it." },
    ],
  },
  horizons: [
    { id: "NOW", label: "Now", note: "In progress" },
    { id: "NEXT", label: "Next", note: "Committed" },
    { id: "LATER", label: "Later", note: "Intended" },
  ],
  items: [
    {
      id: "G-01",
      horizon: "NOW",
      text: "Lift to native iOS and $1K per month App Store profit.",
      target: "$1,000 per month App Store profit",
      projectIds: ["P-13"],
    },
    {
      id: "G-02",
      horizon: "NOW",
      text: "Halfband deployed publicly with speaking mock tests.",
      projectIds: ["P-03"],
    },
    { id: "G-03", horizon: "NOW", text: "Callback AI public /v1 API.", projectIds: ["P-01"] },
    {
      id: "G-04",
      horizon: "NOW",
      text: "agentloop quality rebuild with evals.",
      projectIds: ["P-16"],
    },
    {
      id: "G-05",
      horizon: "NOW",
      text: "Publishing 4 pieces per week through ContentCued.",
      target: "4 pieces per week",
      projectIds: ["P-23"],
    },
    {
      id: "G-06",
      horizon: "NEXT",
      text: "Customer support voice agent as the second Callback product.",
      projectIds: ["P-01"],
    },
    {
      id: "G-07",
      horizon: "NEXT",
      text: "First paid voice automation pilot with a published pass/fail result.",
      target: "Published pass/fail result",
      projectIds: [],
      attachesTo: "Company 02",
    },
    {
      id: "G-08",
      horizon: "NEXT",
      text: "Shared voice-core library extracted from Callback and Cadence.",
      projectIds: ["P-01", "P-04"],
    },
    {
      id: "G-09",
      horizon: "NEXT",
      text: "Fitness Planner real research corpus, connected to Lift.",
      target: "40 to 60 papers, 150 to 250 human-verified findings",
      projectIds: ["P-05", "P-13"],
    },
    {
      id: "G-10",
      horizon: "NEXT",
      text: "First Google Play release (Voice Expense Tracker).",
      projectIds: ["P-20"],
    },
    {
      id: "G-11",
      horizon: "NEXT",
      text: "Airlock verifier v1, open sourced.",
      projectIds: ["P-15"],
    },
    {
      id: "G-12",
      horizon: "LATER",
      text: "AICP 1,800-run benchmark and arXiv preprint.",
      target: "1,800 runs",
      projectIds: ["P-26"],
    },
    {
      id: "G-13",
      horizon: "LATER",
      text: "Buildbox on Kubernetes with a separate production cluster.",
      projectIds: ["P-27"],
    },
    {
      id: "G-14",
      horizon: "LATER",
      text: "Camera-based lifting technique guidance in Lift.",
      projectIds: ["P-13"],
    },
    { id: "G-15", horizon: "LATER", text: "Short film released.", projectIds: ["P-25"] },
    {
      id: "G-16",
      horizon: "LATER",
      text: "Every SPEC'D project either shipped with a live URL or formally cancelled.",
      projectIds: [],
      attachesTo: "All SPEC'D projects",
    },
  ],
};

/** Everything validated together at build time. */
export const content: Content = {
  profile,
  links,
  metrics,
  experience,
  caseStudies,
  buses,
  statuses,
  projects,
  goals,
  principles,
  stackLine,
  routing,
  sheets,
};

/** Site metadata copy. */
export const meta = {
  title: "Anisur Rahman (Shakil): Fullstack AI Engineer, Voice Agents and Agentic Systems",
  description: profile.summary,
  ogAlt: "Drawing sheet for Anisur Rahman, Fullstack AI Engineer",
  ogTitle: "Voice agents + agentic systems",
  jobTitle: "Fullstack AI Engineer",
  knowsAbout: ["Voice agents", "Agentic systems", "RAG pipelines", "LLM verification"],
};

/**
 * Interface copy: labels, legends, accessible names.
 * Kept here so that no component carries a string literal of its own.
 */
export const ui = {
  skipLink: "Skip to drawing",
  sheet: "Sheet",
  of: "of",
  sheetIndex: "Sheet index",
  zonesLabel: "Drawing zone markers",
  bookCall: "Book a call",
  book30: "Book 30 min",
  openTo: "to",
  from: "From",
  redlines: {
    label: "Redlines",
    short: "RL",
    on: "On",
    off: "Off",
    aria: "Show goals as redline markup",
    nextRev: "Next rev",
    offNotice: "Redlines are off. This sheet holds only next revisions, so it is blank in ink.",
    offAction: "Turn redlines on",
  },
  theme: {
    paper: "Paper",
    blueprint: "Blueprint",
    aria: "Blueprint mode",
  },
  titleBlock: {
    caption: "Title block",
    sheetNo: "Sheet no.",
    title: "Title",
    rev: "Rev",
    date: "Date",
    drawnBy: "Drawn by",
    location: "Location",
    hours: "Hours",
    scale: "Scale",
    scaleValue: "NTS",
  },
  cover: {
    aliasLabel: "Known as",
    lanesLabel: "Entry lanes",
    lanes: [
      { label: "Hiring an engineer", to: "02", hint: "Production work" },
      { label: "Need an outcome built", to: "06", hint: "Next revisions" },
      { label: "Following the build", to: "03", hint: "System map" },
    ],
    credentials: "Credentials",
  },
  trace: {
    caption: "Fig. 1: Cascaded voice pipeline, transcript is the artifact",
    alt: "Signal trace: a voice waveform passes through STT, a state machine, an LLM and TTS, then a verifier that outputs a flat PASS line.",
    blocks: ["STT", "State machine", "LLM", "TTS", "Verifier"],
    input: "Voice in",
    pass: "Pass",
  },
  impact: {
    before: "Before",
    after: "After",
    derived: "Computed from the two values shown",
    producedBy: "Produced by",
  },
  work: {
    tableCaption: "Revision table: work history",
    cols: {
      rev: "Rev",
      period: "Period",
      org: "Organisation",
      role: "Role",
      change: "Change description",
    },
    expand: "Details",
    caseHeading: "Detail views: Gerald",
    problem: "Problem",
    built: "Built",
    flow: "Flow",
    result: "Result",
    flowAlt: "Block diagram",
    detail: "Detail",
  },
  map: {
    caption: "Fig. 2: System map, all projects on six buses",
    alt: "Schematic of all projects placed on six buses. Each project is also listed in the project register on sheet 04.",
    legend: "Legend",
    legendWire: "Wire: shared components",
    legendRedline: "Redline: next revision",
    legendJunction: "Junction: tap on a bus",
    bus: "Bus",
    open: "Open detail sheet for",
    hint: "Select a node to open its detail sheet. Arrow keys move between nodes.",
    counters: "Status counters",
    total: "Total",
    listLabel: "Projects by bus",
  },
  register: {
    caption: "Bill of materials: project register",
    cols: {
      id: "ID",
      name: "Name",
      bus: "Bus",
      status: "Status",
      stack: "Stack",
      next: "Next revision",
    },
    filterBus: "Bus",
    filterStatus: "Status",
    all: "All",
    sortBy: "Sort by",
    expand: "Expand",
    openSheet: "Open detail sheet",
    none: "Not stated",
    noRedline: "None recorded",
    showing: "Items",
    empty: "No parts match these filters.",
    reset: "Clear filters",
    qty: "Qty",
  },
  drawer: {
    title: "Detail sheet",
    close: "Close",
    description: "Description",
    detail: "Detail",
    stack: "Stack",
    links: "Links",
    install: "Install",
    version: "Version",
    connects: "Wired to",
    redline: "Next revision",
    noLink: "No public link yet",
    bus: "Bus",
    status: "Status",
  },
  build: {
    notes: "General notes",
    verifierCaption: "Fig. 3: Two-layer verifier",
    verifierAlt:
      "Agent output goes to a deterministic check. Clear results pass or fail directly. Only ambiguous cases go on to an LLM judge.",
    verifier: {
      input: "Agent output",
      layer1: "Deterministic check",
      layer2: "LLM judge",
      pass: "Pass",
      fail: "Fail",
      ambiguous: "Ambiguous only",
      clear: "Clear",
    },
    routingCaption: "Fig. 4: Model routing, share of calls",
    routingAlt: "Bar showing the share of calls per model tier",
    stack: "Stack",
  },
  goals: {
    plan: "Two-company plan",
    offer: "Consulting offer: specification",
    target: "Target",
    attaches: "Attaches to",
    committed: "Committed app",
    specdNow: "SPEC'D now",
    specdTarget: "target 0",
    notDone: "Not done",
  },
  contact: {
    to: "To",
    toValue: "Whoever needs a system that survives production",
    from: "From",
    re: "Re",
    reValue: "A 30 minute call",
    rows: "Send via",
    footer: "Present state in ink. Future state in red.",
    revised: "Last revised",
    transmittal: "Transmittal",
    credentials: "Credentials",
  },
  shortcuts: {
    label: "Keyboard",
    items: [
      { keys: "0–7", action: "Jump to sheet" },
      { keys: "R", action: "Redlines" },
      { keys: "B", action: "Blueprint" },
      { keys: "Esc", action: "Close detail sheet" },
    ],
  },
  external: "opens in a new tab",
} as const;

export type Ui = typeof ui;

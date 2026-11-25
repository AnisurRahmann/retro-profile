/**
 * ALL site copy and data. Components never hardcode copy.
 * The agent's knowledge base (src/agent/knowledge.md) is generated from this file,
 * so the site and the agent can never disagree.
 *
 * Any value shaped like [[...]] is an unresolved placeholder: the item renders
 * without that field, or is hidden entirely when the field is required.
 * See src/site.ts for the resolution rules and docs/OPEN_QUESTIONS.md for the list.
 */
import { contentSchema, type ContentInput } from "./content.schema";

const GERALD = "Gerald (YC W21)";
const GERALD_ROLE = "Fullstack AI Engineer";
const GERALD_PERIOD = "[[Aug 2022 – end date]]";
const REST_LINE = "Zero sets. Zero reps. Recover hard.";

const raw = {
  profile: {
    name: "Shakil",
    legalName: "Anisur Rahman",
    title: "Fullstack AI Engineer",
    oneLiner:
      "Fullstack AI engineer. I build voice agents and agentic systems that survive production.",
    summary:
      "About 10 years of backend and fullstack engineering, all at early-stage startups including YC-backed companies. I build production AI agents, voice agents, RAG pipelines and the verifiers that keep them honest, and I own the work from architecture to release to the metric afterwards.",
    location: "Based in Sylhet, Bangladesh. Works overlapping US East Coast hours.",
    credentials: "Toptal top 3% network.",
    portrait: "/shakil.jpg",
    statusLines: [
      "Building voice agents that survive production.",
      "Shipping Callback AI.",
      "Logging sets by voice in Lift.",
      "Reviewing 100% of agent-written diffs.",
      "Routing 80% of LLM calls to Tier 1 models.",
      "Writing deterministic checks before LLM judges.",
      "Between sets.",
    ],
  },

  links: {
    github: "https://github.com/AnisurRahmann",
    linkedin: "https://www.linkedin.com/in/shakil22",
    email: "shakilwizard@gmail.com",
    calendar: "https://cal.com/shakil-nee/30min",
    site: "https://arshakil.com",
  },

  shipped: [
    {
      id: "gerald-support-agent",
      title: "Support Agent",
      subtitle: "Gerald (YC W21) · 3.5 min → 10 s median response",
      caseStudy: "support-agent",
    },
    {
      id: "gerald-seo-engine",
      title: "AI SEO Content Engine",
      subtitle: "Gerald · 2,500+ posts an hour, agency replaced",
      caseStudy: "seo-engine",
    },
    {
      id: "call-copilot",
      title: "Call Copilot",
      subtitle: "Open source · call transcripts on macOS, no meeting bot",
      href: "https://github.com/AnisurRahmann/call-copilot",
    },
    {
      id: "gerald-plaid",
      title: "Plaid Funnel Optimisation",
      subtitle: "Gerald · $100K → $25K a month",
      caseStudy: "plaid",
    },
    {
      id: "gerald-zinc",
      title: "Amazon Marketplace via Zinc",
      subtitle: "Gerald · 10K SKUs → millions",
      caseStudy: "zinc",
    },
    {
      id: "gerald-slack-redshift",
      title: "Slack → Redshift Agent",
      subtitle: "Gerald · warehouse answers in Slack, MTTR −60%",
      caseStudy: "slack-redshift",
    },
    {
      id: "llm-wiki-kit",
      title: "LLM Wiki Kit",
      subtitle: "Open source · a Claude Code skill that runs an Obsidian wiki",
      href: "https://github.com/AnisurRahmann/llm-wiki-kit",
    },
    {
      id: "lift",
      title: "Lift",
      subtitle: "Voice-first gym log. Say the set, it's logged.",
      href: "[[lift url]]",
    },
    {
      id: "create-mvpkit",
      title: "create-mvpkit",
      subtitle: "Scaffolder for shipping MVPs fast",
      href: "[[create-mvpkit url]]",
    },
  ],

  building: [
    {
      id: "callback-ai",
      title: "Callback AI",
      subtitle: "Link-based voice screening agent for recruiters",
      status: "in-build",
      // Filled from brain/projects/callback-ai.md (deployed 2026-09-23). Confirm: docs/OPEN_QUESTIONS.md
      href: "https://www.usecallbackai.com",
    },
    {
      id: "halfband",
      title: "Halfband",
      subtitle: "AI IELTS prep with a voice examiner",
      status: "in-build",
    },
    {
      id: "airlock",
      title: "Airlock",
      subtitle: "Guard + verifier gates for full-access coding agents",
      status: "in-build",
    },
    {
      id: "agentloop",
      title: "agentloop",
      subtitle: "Fixer ↔ reviewer agents in a PR loop, rebuilt with evals",
      status: "in-build",
    },
    {
      id: "savesync",
      title: "SaveSync",
      subtitle: "Social saves → my endpoint → summaries and agents",
      status: "in-build",
    },
    {
      id: "contentcued",
      title: "ContentCued",
      subtitle: "Build-in-public content engine that never fakes experience",
      status: "built-not-deployed",
    },
  ],

  caseStudies: [
    {
      slug: "support-agent",
      projectId: "gerald-support-agent",
      title: "Customer Support Agent",
      org: GERALD,
      period: GERALD_PERIOD,
      role: GERALD_ROLE,
      problem:
        "Support queries waited minutes for a human, and engineers kept getting pulled into tickets.",
      built:
        "A conversational agent with structured tool calling, SSE streaming and conversation state, plus smart actions so the support team resolves issues without engineering.",
      flow: ["User message", "Intent + state", "Tool calls", "Streamed reply", "Human escalation"],
      results: [
        { label: "Median response", before: "3.5 min", after: "10 s" },
        { label: "App rating", before: "3.5", after: "4.2" },
        { label: "Engineering time on support", after: "down ~80%" },
      ],
      stack: ["Python", "FastAPI", "Claude API", "SSE", "PostgreSQL"],
    },
    {
      slug: "seo-engine",
      projectId: "gerald-seo-engine",
      title: "AI SEO Content Engine",
      org: GERALD,
      period: GERALD_PERIOD,
      role: GERALD_ROLE,
      problem: "Organic content depended on a $96K/year agency and couldn't scale.",
      built:
        "Amazon Bedrock and Gemini generation with automated keyword targeting and backlinking, gated by LangSmith evaluations before anything publishes.",
      flow: ["Keyword targets", "Generation", "Eval gate", "Backlinking", "Publish"],
      results: [
        { label: "Throughput", after: "2,500+ posts per hour" },
        { label: "Agency contract", before: "$96K/year", after: "replaced" },
        { label: "Organic conversion", after: "+40%" },
      ],
      stack: ["Amazon Bedrock", "Gemini", "LangSmith", "Python"],
    },
    {
      slug: "plaid",
      projectId: "gerald-plaid",
      title: "Plaid Funnel Optimisation",
      org: GERALD,
      period: GERALD_PERIOD,
      role: GERALD_ROLE,
      problem: "Paid bank-connection calls fired for users who didn't need them.",
      built:
        "A custom fuzzy-matching layer and a transaction-time check with Pydantic-validated pipelines, so paid calls fire only when needed.",
      flow: ["Signup", "Fuzzy match", "Transaction-time check", "Plaid call only if needed"],
      results: [
        { label: "Plaid spend", before: "$100K/month", after: "$25K/month" },
        { label: "Saved", after: "~$900K/year" },
      ],
      stack: ["Python", "Pydantic", "Plaid API"],
    },
    {
      slug: "zinc",
      projectId: "gerald-zinc",
      title: "Amazon Marketplace via Zinc",
      org: GERALD,
      period: GERALD_PERIOD,
      role: GERALD_ROLE,
      problem:
        "A 10,000-SKU catalog capped revenue, and inventory risk ruled out stocking more.",
      built:
        "An Amazon integration via Zinc with catalog sync, order placement, failure handling and reconciliation.",
      flow: ["Catalog sync", "Order placement", "Failure handling", "Reconciliation"],
      results: [
        { label: "Catalog", before: "10,000 SKUs", after: "millions" },
        { label: "Order failure rate", before: "~60%", after: "~20%" },
        { label: "Monthly order value", after: "contributing to $1M+" },
      ],
      stack: ["Python", "Zinc API", "PostgreSQL"],
    },
    {
      slug: "slack-redshift",
      projectId: "gerald-slack-redshift",
      title: "Slack → Redshift Agent + Observability",
      org: GERALD,
      period: GERALD_PERIOD,
      role: GERALD_ROLE,
      problem:
        "Data questions took hours of analyst time; incidents took too long to recover from.",
      built:
        "Plain-English questions in Slack answered from Redshift with human-in-the-loop SQL confirmation, plus New Relic, Datadog and LangSmith tracing with dashboards, alerting and CI quality gates.",
      flow: ["Slack question", "SQL generation", "Human confirm", "Redshift", "Answer"],
      results: [
        { label: "Time to insight", before: "hours", after: "seconds" },
        { label: "MTTR", after: "down 60%" },
      ],
      stack: ["Slack API", "Redshift", "LangSmith", "New Relic", "Datadog"],
    },
  ],

  receipts: [
    {
      id: "r-support",
      kind: "app",
      channel: "#support",
      org: "Gerald",
      author: "Support Agent",
      body: "Median first response: 3.5 min → *10 s*. App rating 3.5 → 4.2. Built by @Shakil.",
    },
    {
      id: "r-growth",
      kind: "app",
      channel: "#growth",
      org: "Gerald",
      author: "Content Engine",
      body: "2,500+ posts an hour, every one through an eval gate. The $96K/yr agency contract is gone. @Shakil",
    },
    {
      id: "r-finance",
      kind: "app",
      channel: "#finance",
      org: "Gerald",
      author: "Cost Watch",
      body: "Plaid spend: $100K/mo → *$25K/mo*. Same funnel, fuzzy matching in front. @Shakil",
    },
    {
      id: "r-catalog",
      kind: "app",
      channel: "#catalog",
      org: "Gerald",
      author: "Zinc Sync",
      body: "Catalog: 10,000 SKUs → millions. Order failures ~60% → ~20%.",
    },
    {
      id: "r-incidents",
      kind: "app",
      channel: "#incidents",
      org: "Gerald",
      author: "Pager",
      body: "MTTR down 60% since tracing and alerting landed. @Shakil",
    },
    {
      id: "r-lift",
      kind: "app",
      channel: "#lift",
      author: "Lift",
      body: "Heard: [[a real set you logged by voice, e.g. 'bench 3 by 5 at X kg']]. Logged.",
    },
    {
      id: "r-human-1",
      kind: "human",
      channel: "[[e.g. Direct message]]",
      author: "[[name]]",
      org: "[[company]]",
      avatar: "[[public/people/file.jpg]]",
      date: "[[real date]]",
      body: "[[exact quote, shared with permission]]",
      reactions: [],
    },
    {
      id: "r-nowash",
      kind: "human",
      channel: "Blog post",
      author: "Nowash Jawad",
      body: "[[one-line excerpt from his Call Copilot post, with permission]]",
      href: "[[post url]]",
    },
  ],

  closer: {
    heading: "Need an outcome, not hours?",
    body: "Lower cost, more revenue, or better retention. Tell me which number should move, we agree pass or fail before I start, and I own it through to production.",
  },

  principles: [
    "Deterministic first, LLM last: every agent gets a two-layer verifier, with a deterministic check first and an LLM judge only for what's still ambiguous.",
    "No LLM output in a numeric field. Models choose from closed lists and write prose; numbers come from code.",
    "The transcript is the artifact: cascaded STT → LLM → TTS pipelines over speech-to-speech when the record matters.",
    "Tiered model routing: fast models for 70 to 80% of calls, cheap reasoning for 15 to 25%, top models for 5% or less. Caching and a cost model are part of the architecture.",
    "About 90% of the code is agent-generated, and 100% of the diff is reviewed.",
    "Done means a live URL a stranger can open.",
    "Extreme ownership: architecture, release, monitoring, and the metric afterwards.",
  ],

  stack: [
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
    "New Relic",
    "Datadog",
    "Sentry",
  ],

  workingStyle: [
    "Based in Sylhet, Bangladesh. Works overlapping US East Coast hours.",
    "Outcome-based: agree which number should move and a pass/fail metric before starting.",
    "Owns the work from architecture to release to the metric afterwards.",
    "About 90% of the code is agent-generated, and 100% of the diff is reviewed.",
  ],

  services: {
    offer:
      "Voice and phone automation for small and mid-size businesses. Fixed-fee pilot: one phone number, one use case, 2 to 4 weeks, with a pass/fail metric agreed before it starts. Then a monthly fee to run and improve it.",
    pricing:
      "Pricing and rates are never stated in chat. Route the visitor to a call (book_call).",
    roles:
      "Also open to full-time AI engineering roles on AI-first product teams. Happy to talk about roles; route to book_call.",
  },

  agentFacts: [
    {
      topic: "Experience",
      fact: "About 10 years, all at early-stage startups. Gerald (YC W21): primary backend and AI engineer on a three-person team at a US fintech. SplitStay: part-time founding engineer since May 2026, owning the AI stack of a WhatsApp-first travel matching system (signal extraction, matching, learning loops, Twilio/WhatsApp, LLM NLU). Co-founded Hasty Head, a digital agency. Led three engineering teams at re:cruit.",
    },
    {
      topic: "Callback AI",
      fact: "A candidate opens a link and talks to the agent; the hiring manager gets a verified report. Cascaded STT → LLM → TTS, a slot-filling state machine, a two-layer verifier (verbatim span check, then an LLM judge), Postgres FOR UPDATE SKIP LOCKED as the job queue, about $0.15 per screen. Stack: Pipecat, Deepgram, Groq/Gemini Flash-Lite for live turns, Claude for reports, FastAPI, Postgres.",
    },
    {
      topic: "This chat agent",
      fact: "Built by Shakil on Claude with a closed knowledge base generated from his site's content file, prompt caching, server-side tools, per-visitor rate limits, a daily token budget, and an eval suite with deterministic checks before an LLM judge. Conversations are logged; details at /privacy.",
    },
    {
      topic: "Gym",
      fact: "Lifts regularly; built Lift because logging sets by hand mid-workout is annoying. His current split is on the /lifts page.",
    },
  ],

  lifts: {
    intro: "I lift. I built Lift so logging a set takes one sentence. Current routines below.",
    // Ported from the previous site's src/data/gym.ts (main @ 9fb4a5a). See docs/DECISIONS.md.
    rules: [
      "heavy lift first · compounds to RPE 8",
      "top of the range every set → bump the load",
      "+2.5 kg upper · +5 kg lower · +2 kg per db",
      "db press holds 6-10 so a jump won’t drop below the floor",
      "weak grip on rdls after two weeks → shrugs move to day 2",
      "deload week 6 — half the sets, same weights",
      "8–10k steps daily · floor of 5–6k on busy days",
    ],
    routines: [
      {
        id: "friday",
        weekday: "Friday",
        title: "Squat (Heavy)",
        duration: "~85-90 min",
        exercises: [
          { name: "Barbell Back Squat", prescription: "3 x 5-7" },
          {
            name: "Barbell Hip Thrust",
            prescription: "3 x 8-10",
            note: "start ~10% lighter than fresh — squats come first",
          },
          { name: "Incline DB Press", prescription: "3 x 8-10" },
          { name: "Lat Pulldown", prescription: "3 x 8-10" },
          { name: "DB Lateral Raise", prescription: "3 x 12-15" },
          { name: "Rope Pushdown", prescription: "3 x 10-12" },
          {
            name: "Decline Crunch",
            prescription: "3 x 10-12",
            note: "first cut if the session runs long",
          },
          { name: "Cable Crunch", prescription: "3 x 12-15" },
          { name: "Hanging Knee Raise", prescription: "3 x 15" },
          { name: "Incline Walk", prescription: "10 min" },
        ],
      },
      {
        id: "saturday",
        weekday: "Saturday",
        title: "Bench (Heavy)",
        duration: "~70 min",
        exercises: [
          { name: "Barbell Bench Press", prescription: "3 x 5-7" },
          { name: "Wide-Grip Cable Row", prescription: "3 x 10-12" },
          { name: "Straight-Arm Pulldown", prescription: "3 x 12-15" },
          { name: "Seated Leg Curl", prescription: "3 x 10-12" },
          { name: "Cable Lateral Raise", prescription: "3 x 12-15" },
          { name: "Face Pull", prescription: "3 x 15" },
          { name: "Hanging Leg Raise", prescription: "3 x 12-15" },
          { name: "Incline Walk", prescription: "10 min" },
        ],
      },
      {
        id: "sunday",
        weekday: "Sunday",
        title: "Rest",
        rest: true,
        restLine: REST_LINE,
        exercises: [],
      },
      {
        id: "monday",
        weekday: "Monday",
        title: "Pull-Up (Heavy)",
        duration: "~70 min",
        exercises: [
          { name: "Weighted Pull-Up", prescription: "3 x 6-8" },
          { name: "Machine Chest Press", prescription: "3 x 10-12" },
          { name: "Leg Press", prescription: "3 x 10-12" },
          { name: "DB Lateral Raise", prescription: "4 x 12-15" },
          { name: "Incline DB Curl", prescription: "3 x 8-10" },
          { name: "Side Plank", prescription: "3 x 30-45 sec /side" },
          { name: "Incline Walk", prescription: "10 min" },
        ],
      },
      {
        id: "tuesday",
        weekday: "Tuesday",
        title: "OHP (Heavy)",
        duration: "~70 min",
        exercises: [
          { name: "Seated DB Overhead Press", prescription: "3 x 6-10", note: "back supported" },
          { name: "Chest-Supported Row", prescription: "3 x 8-10" },
          { name: "DB Shrug", prescription: "3 x 12-15", note: "pause at the top · no rolling" },
          { name: "Leg Extension", prescription: "3 x 10-12" },
          { name: "Rear Delt Cable Flye", prescription: "3 x 15" },
          { name: "Standing Calf Raise", prescription: "3 x 12-15" },
          { name: "Overhead Cable Extension", prescription: "3 x 12-15" },
          { name: "Incline Walk", prescription: "10 min" },
        ],
      },
      {
        id: "wednesday",
        weekday: "Wednesday",
        title: "RDL (Heavy)",
        duration: "~75 min",
        exercises: [
          { name: "Romanian Deadlift", prescription: "3 x 8-10" },
          {
            name: "Walking Lunge or Bulgarian Split Squat",
            prescription: "3 x 10-12 /leg",
          },
          { name: "Single-Arm DB Row", prescription: "3 x 10-12" },
          { name: "Cable Lateral Raise", prescription: "4 x 12-15" },
          {
            name: "Incline DB Flye",
            prescription: "3 x 10-12",
            note: "first cut if the session runs long",
          },
          { name: "Lying Leg Curl", prescription: "3 x 10-12" },
          { name: "Seated Calf Raise", prescription: "3 x 12-15" },
          { name: "Hammer Curl", prescription: "3 x 10-12" },
          { name: "Incline Walk", prescription: "10 min" },
        ],
      },
      {
        id: "thursday",
        weekday: "Thursday",
        title: "Rest",
        rest: true,
        restLine: REST_LINE,
        exercises: [],
      },
    ],
  },

  ui: {
    meta: {
      title: "Shakil (Anisur Rahman), Fullstack AI Engineer",
      chatTitle: "Talk to my agent",
      chatDescription:
        "Ask Shakil's agent about his work. If it's worth his time, it gets to him.",
      liftsDescription: "Shakil's current training split.",
    },
    nav: { chat: "Talk to my agent", work: "Work", lifts: "Lifts", home: "Home" },
    home: {
      shipped: "Shipped",
      bench: "On the bench",
      receipts: "Receipts",
      receiptsNote:
        "APP messages restate production metrics from my work. Human messages are real, shared with permission.",
      showMore: "Show {n} more",
      showLess: "Show less",
      statusInBuild: "in build",
      statusBuilt: "built, not deployed",
      bookCta: "Book 30 min",
      chatCta: "Talk to my agent",
      appBadge: "APP",
    },
    work: {
      back: "← Back",
      problem: "Problem",
      built: "What I built",
      flow: "How it flows",
      result: "Result",
      stack: "Stack",
      askLine: "Want the deep version? Ask my agent.",
      askQuery: "Tell me how the {title} worked",
    },
    lifts: {
      heading: "Lifts",
      day: "Day",
      exercise: "Exercise",
      sets: "Sets x reps",
      liftLink: "Lift",
    },
    footer: { github: "GitHub", linkedin: "LinkedIn", privacy: "Privacy" },
    privacy: {
      heading: "Privacy",
      sections: [
        {
          heading: "What the chat logs",
          body: "Each message you send and each reply, a hashed version of your IP address (salted SHA-256, the raw IP is never stored), your browser family, token counts, and a timestamp.",
        },
        {
          heading: "Why",
          body: "To stop abuse (rate limits and a daily budget) and to improve the agent's answers.",
        },
        {
          heading: "How long",
          body: "Chat logs and rate-limit records are deleted after 90 days by a scheduled job.",
        },
        {
          heading: "Intros",
          body: "If you send an intro, your name, email, topic and message are stored and emailed to Shakil, together with the last few messages of the chat for context. Nothing is sent unless you tick the consent box and press send.",
        },
        {
          heading: "Model provider",
          body: "Messages are processed by Anthropic to generate replies. Logs and intros are stored in a Supabase Postgres database; intro emails are sent through Resend.",
        },
        {
          heading: "Weather",
          body: "The sky behind this site follows the live weather in Sylhet. Your browser asks this site's server, which fetches it from Open-Meteo at most every 15 minutes, so your IP address is never sent to them. Weather data by Open-Meteo.com, licensed CC BY 4.0.",
          links: [
            { label: "Weather data by Open-Meteo.com", href: "https://open-meteo.com/" },
            { label: "CC BY 4.0", href: "https://creativecommons.org/licenses/by/4.0/" },
          ],
        },
        {
          heading: "Deletion",
          body: "To have your chat or intro deleted, email {email}.",
        },
      ],
    },
    chat: {
      heading: "What brings you here?",
      sub: "I'm Shakil's agent. Ask about his work. If it's worth his time, I'll get it to him.",
      placeholder: "Ask about Shakil, or tell me what you're building",
      inputLabel: "Message Shakil's agent",
      chips: [
        "I'm hiring an AI engineer",
        "I need a voice agent built",
        "What's he building right now?",
        "Let's book a call",
      ],
      send: "Send",
      stop: "Stop",
      newChat: "New chat",
      rateLimited: "That's a lot of questions. Book a call instead?",
      broken: "Something broke on my side. Email him at {email}.",
      disabled: "The agent is resting right now. Book a call or email him at {email}.",
      bookTitle: "Book 30 min with Shakil",
      bookButton: "Book 30 min",
      introTitle: "Leave an intro for Shakil",
      introName: "Name",
      introEmail: "Email",
      introAbout: "What it's about",
      introConsent: "Send this to Shakil",
      introSubmit: "Send",
      introSent: "Sent. He reads these himself.",
      introError: "That didn't send. Email him at {email}.",
      you: "You",
      agent: "Shakil's agent",
    },
    sky: {
      weather: "{temp}°C · {weather}",
      preview: "preview {time}",
      sun: "Sunrise {sunrise} · Sunset {sunset}",
      details: "Feels like {feels}°C · Humidity {humidity}% · Wind {wind} km/h from {from}",
      updated: "Updated {time}",
      attribution: "Weather data by Open-Meteo.com",
      attributionHref: "https://open-meteo.com/",
      dialog: "The sky over Sylhet",
      scrub: "Preview a day in Sylhet",
      stripValue: "{time} in Sylhet, {phase}",
      phases: {
        night: "night",
        astronomical: "astronomical twilight",
        nautical: "nautical twilight",
        civil: "civil twilight",
        golden: "golden hour",
        day: "daytime",
      },
      hint: "drag the sky ← →",
      hintTouch: "swipe the sky",
      places: {
        default: "in Sylhet",
        tea: "· tea gardens, Sylhet",
        bridge: "near Keane Bridge, Sylhet",
        city: "· city rooftops, Sylhet",
        airport: "· Osmani Airport, Sylhet",
      },
      words: {
        clear: "clear",
        mostlyClear: "mostly clear",
        partlyCloudy: "partly cloudy",
        overcast: "overcast",
        foggy: "foggy",
        drizzle: "drizzle",
        lightRain: "light rain",
        rain: "rain",
        heavyRain: "heavy rain",
        thunderstorm: "thunderstorm",
      },
    },
    notFound: {
      heading: "Not here.",
      body: "That page doesn't exist. The agent might know where it went.",
      home: "Back home",
    },
  },
} satisfies ContentInput;

export const content = contentSchema.parse(raw);

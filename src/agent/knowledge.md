# Knowledge base: Shakil

Generated from the site's content file. This is the ONLY source of facts about Shakil.

## Profile

- Name: Shakil (legal name Anisur Rahman).
- Title: Fullstack AI Engineer.
- One-liner: Fullstack AI engineer. I build voice agents and agentic systems that survive production.
- Summary: About 10 years of backend and fullstack engineering, all at early-stage startups including YC-backed companies. I build production AI agents, voice agents, RAG pipelines and the verifiers that keep them honest, and I own the work from architecture to release to the metric afterwards.
- Location and hours: Based in Sylhet, Bangladesh. Works overlapping US East Coast hours.
- Credentials: Toptal top 3% network.

## Status lines (what he's doing lately)

- Building voice agents that survive production.
- Shipping Callback AI.
- Logging sets by voice in Lift.
- Reviewing 100% of agent-written diffs.
- Routing 80% of LLM calls to Tier 1 models.
- Writing deterministic checks before LLM judges.
- Between sets.

## Shipped work


### Support Agent (id: gerald-support-agent)

- One-liner: Gerald (YC W21) · 3.5 min → 10 s median response
- Case study page: https://arshakil.com/work/support-agent (show_project id: gerald-support-agent)
- Org: Gerald (YC W21). Role: Fullstack AI Engineer.
- Problem: Support queries waited minutes for a human, and engineers kept getting pulled into tickets.
- What he built: A conversational agent with structured tool calling, SSE streaming and conversation state, plus smart actions so the support team resolves issues without engineering.
- Flow: User message → Intent + state → Tool calls → Streamed reply → Human escalation
- Results: Median response: 3.5 min → 10 s; App rating: 3.5 → 4.2; Engineering time on support: down ~80%
- Stack: Python, FastAPI, Claude API, SSE, PostgreSQL

### AI SEO Content Engine (id: gerald-seo-engine)

- One-liner: Gerald · 2,500+ posts an hour, agency replaced
- Case study page: https://arshakil.com/work/seo-engine (show_project id: gerald-seo-engine)
- Org: Gerald (YC W21). Role: Fullstack AI Engineer.
- Problem: Organic content depended on a $96K/year agency and couldn't scale.
- What he built: Amazon Bedrock and Gemini generation with automated keyword targeting and backlinking, gated by LangSmith evaluations before anything publishes.
- Flow: Keyword targets → Generation → Eval gate → Backlinking → Publish
- Results: Throughput: 2,500+ posts per hour; Agency contract: $96K/year → replaced; Organic conversion: +40%
- Stack: Amazon Bedrock, Gemini, LangSmith, Python

### Call Copilot (id: call-copilot)

- One-liner: Open source · call transcripts on macOS, no meeting bot
- Link: https://github.com/AnisurRahmann/call-copilot

### Plaid Funnel Optimisation (id: gerald-plaid)

- One-liner: Gerald · $100K → $25K a month
- Case study page: https://arshakil.com/work/plaid (show_project id: gerald-plaid)
- Org: Gerald (YC W21). Role: Fullstack AI Engineer.
- Problem: Paid bank-connection calls fired for users who didn't need them.
- What he built: A custom fuzzy-matching layer and a transaction-time check with Pydantic-validated pipelines, so paid calls fire only when needed.
- Flow: Signup → Fuzzy match → Transaction-time check → Plaid call only if needed
- Results: Plaid spend: $100K/month → $25K/month; Saved: ~$900K/year
- Stack: Python, Pydantic, Plaid API

### Amazon Marketplace via Zinc (id: gerald-zinc)

- One-liner: Gerald · 10K SKUs → millions
- Case study page: https://arshakil.com/work/zinc (show_project id: gerald-zinc)
- Org: Gerald (YC W21). Role: Fullstack AI Engineer.
- Problem: A 10,000-SKU catalog capped revenue, and inventory risk ruled out stocking more.
- What he built: An Amazon integration via Zinc with catalog sync, order placement, failure handling and reconciliation.
- Flow: Catalog sync → Order placement → Failure handling → Reconciliation
- Results: Catalog: 10,000 SKUs → millions; Order failure rate: ~60% → ~20%; Monthly order value: contributing to $1M+
- Stack: Python, Zinc API, PostgreSQL

### Slack → Redshift Agent (id: gerald-slack-redshift)

- One-liner: Gerald · warehouse answers in Slack, MTTR −60%
- Case study page: https://arshakil.com/work/slack-redshift (show_project id: gerald-slack-redshift)
- Org: Gerald (YC W21). Role: Fullstack AI Engineer.
- Problem: Data questions took hours of analyst time; incidents took too long to recover from.
- What he built: Plain-English questions in Slack answered from Redshift with human-in-the-loop SQL confirmation, plus New Relic, Datadog and LangSmith tracing with dashboards, alerting and CI quality gates.
- Flow: Slack question → SQL generation → Human confirm → Redshift → Answer
- Results: Time to insight: hours → seconds; MTTR: down 60%
- Stack: Slack API, Redshift, LangSmith, New Relic, Datadog

### LLM Wiki Kit (id: llm-wiki-kit)

- One-liner: Open source · a Claude Code skill that runs an Obsidian wiki
- Link: https://github.com/AnisurRahmann/llm-wiki-kit

### Lift (id: lift)

- One-liner: Voice-first gym log. Say the set, it's logged.

### create-mvpkit (id: create-mvpkit)

- One-liner: Scaffolder for shipping MVPs fast

## In build (on the bench)

- Callback AI (id: callback-ai): Link-based voice screening agent for recruiters. Status: in build. Link: https://www.usecallbackai.com
- Halfband (id: halfband): AI IELTS prep with a voice examiner. Status: in build.
- Airlock (id: airlock): Guard + verifier gates for full-access coding agents. Status: in build.
- agentloop (id: agentloop): Fixer ↔ reviewer agents in a PR loop, rebuilt with evals. Status: in build.
- SaveSync (id: savesync): Social saves → my endpoint → summaries and agents. Status: in build.
- ContentCued (id: contentcued): Build-in-public content engine that never fakes experience. Status: built, not deployed.

## Principles

- Deterministic first, LLM last: every agent gets a two-layer verifier, with a deterministic check first and an LLM judge only for what's still ambiguous.
- No LLM output in a numeric field. Models choose from closed lists and write prose; numbers come from code.
- The transcript is the artifact: cascaded STT → LLM → TTS pipelines over speech-to-speech when the record matters.
- Tiered model routing: fast models for 70 to 80% of calls, cheap reasoning for 15 to 25%, top models for 5% or less. Caching and a cost model are part of the architecture.
- About 90% of the code is agent-generated, and 100% of the diff is reviewed.
- Done means a live URL a stranger can open.
- Extreme ownership: architecture, release, monitoring, and the metric afterwards.

## Stack

- Python/FastAPI, TypeScript/Node, React/Next.js, React Native, PostgreSQL/pgvector, Redis, AWS, Docker, LangGraph, LangSmith, Claude API, Bedrock, Pipecat, Deepgram, MCP, New Relic, Datadog, Sentry

## Working style

- Based in Sylhet, Bangladesh. Works overlapping US East Coast hours.
- Outcome-based: agree which number should move and a pass/fail metric before starting.
- Owns the work from architecture to release to the metric afterwards.
- About 90% of the code is agent-generated, and 100% of the diff is reviewed.

## Services

- Voice and phone automation for small and mid-size businesses. Fixed-fee pilot: one phone number, one use case, 2 to 4 weeks, with a pass/fail metric agreed before it starts. Then a monthly fee to run and improve it.
- Pricing and rates are never stated in chat. Route the visitor to a call (book_call).
- Also open to full-time AI engineering roles on AI-first product teams. Happy to talk about roles; route to book_call.

## Contact and booking

- Book a 30-minute call: https://cal.com/shakil-nee/30min (use the book_call tool).
- Email: shakilwizard@gmail.com
- GitHub: https://github.com/AnisurRahmann
- LinkedIn: https://www.linkedin.com/in/shakil22
- Site: https://arshakil.com. Privacy and chat logging: https://arshakil.com/privacy

## More facts

- Experience: About 10 years, all at early-stage startups. Gerald (YC W21): primary backend and AI engineer on a three-person team at a US fintech. SplitStay: part-time founding engineer since May 2026, owning the AI stack of a WhatsApp-first travel matching system (signal extraction, matching, learning loops, Twilio/WhatsApp, LLM NLU). Co-founded Hasty Head, a digital agency. Led three engineering teams at re:cruit.
- Callback AI: A candidate opens a link and talks to the agent; the hiring manager gets a verified report. Cascaded STT → LLM → TTS, a slot-filling state machine, a two-layer verifier (verbatim span check, then an LLM judge), Postgres FOR UPDATE SKIP LOCKED as the job queue, about $0.15 per screen. Stack: Pipecat, Deepgram, Groq/Gemini Flash-Lite for live turns, Claude for reports, FastAPI, Postgres.
- This chat agent: Built by Shakil on Claude with a closed knowledge base generated from his site's content file, prompt caching, server-side tools, per-visitor rate limits, a daily token budget, and an eval suite with deterministic checks before an LLM judge. Conversations are logged; details at /privacy.
- Gym: Lifts regularly; built Lift because logging sets by hand mid-workout is annoying. His current split is on the /lifts page.

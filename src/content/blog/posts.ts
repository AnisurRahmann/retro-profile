export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  category: string;
  type: 'article' | 'insight';
  featured?: boolean;
  excerpt: string;
  tags: string[];
  image?: string;
  content: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'building-ai-agents-that-actually-ship',
    title: 'Building AI Agents That Actually Ship',
    date: '2024-12-15',
    category: 'AI Engineering',
    type: 'article',
    featured: true,
    excerpt: "After building AI agents at YC startups, here's what I've learned about shipping agents that work in production—not just in demos.",
    tags: ['AI', 'LangChain', 'Production', 'Agents'],
    content: `Most AI agent demos are impressive. Most AI agents in production are disasters.

I've shipped agents at Gerald (YC W21) that handle real user bank transactions. Here's what separates production agents from demo agents.

## The Demo vs Production Gap

In demos, agents have:
- Unlimited retries
- Perfect prompts
- Controlled inputs
- Infinite budgets

In production, agents face:
- Real users who type gibberish
- API rate limits
- Cost constraints
- Compliance requirements
- The need to actually work

## The Architecture That Works

After iterating through dozens of approaches, here's the architecture that consistently ships:

### 1. Deterministic Fallbacks

Never rely solely on LLM decision-making for critical paths. Every agent action should have a deterministic fallback:

\`\`\`python
async def transfer_money(amount: float, recipient: str):
    # LLM extracts intent
    intent = await agent.extract_intent(user_message)

    # Deterministic validation
    if not validate_transfer(amount, recipient):
        return fallback_transfer_flow()

    # Proceed with confidence
    return execute_transfer(amount, recipient)
\`\`\`

### 2. Bounded Autonomy

Don't let agents run wild. Set explicit boundaries:
- Maximum iterations per task
- Cost limits per user
- Action allowlists (not blocklists)
- Human-in-the-loop for high-stakes decisions

### 3. Observable Everything

You can't fix what you can't see:
- Log every LLM call with full context
- Track token usage per user/task
- Monitor latency percentiles
- Alert on unusual patterns

## Common Failure Modes

### The Infinite Loop

Agents love to retry the same failing action. Add exponential backoff and hard limits.

### The Hallucination Spiral

One hallucination leads to another. Validate agent outputs against real data sources.

### The Cost Explosion

GPT-4 in a tight loop can burn through $100 in minutes. Set hard per-request limits.

## What Actually Matters

1. **Reliability over capability** - A boring agent that works beats a fancy one that doesn't
2. **Observability from day one** - Debug issues before users report them
3. **Graceful degradation** - When the LLM fails, fall back to traditional code
4. **User trust** - Build confidence through transparency and predictability

## The Future

The agents that will win aren't the most capable—they're the most reliable. Focus on shipping something that works 99% of the time, not something that impresses 100% of the time.

Production agents are boring. And boring ships.`
  },
  {
    slug: 'langchain-max-iterations-debugging',
    title: 'Debugging LangChain Max Iterations Issues',
    date: '2024-12-10',
    category: 'Dev Tools',
    type: 'article',
    featured: false,
    excerpt: 'A deep dive into why your LangChain agents hit max iterations and how to fix them systematically.',
    tags: ['LangChain', 'Debugging', 'Python'],
    content: `If you've worked with LangChain agents, you've seen this error: "Agent stopped due to iteration limit or time limit."

Here's how to actually fix it.

## Why It Happens

The agent enters a loop when it can't determine the right action. Common causes:

1. **Ambiguous prompts** - The agent doesn't understand what to do
2. **Tool output confusion** - The tool returns something unexpected
3. **Missing context** - The agent lacks information to proceed

## The Debugging Framework

### Step 1: Enable Verbose Logging

\`\`\`python
from langchain.globals import set_debug
set_debug(True)
\`\`\`

This shows you exactly what the agent is thinking at each step.

### Step 2: Trace the Loop Pattern

Look for repeated actions. Usually you'll see:
- Same tool called repeatedly with same inputs
- Agent asking for clarification in a loop
- Tool returning errors that agent doesn't handle

### Step 3: Fix the Root Cause

**For ambiguous prompts:**
\`\`\`python
# Bad
agent.run("Get the data")

# Good
agent.run("Fetch user data for user_id=123 from the database")
\`\`\`

**For tool output issues:**
\`\`\`python
class MyTool(BaseTool):
    def _run(self, query: str) -> str:
        result = do_thing(query)
        # Always return clear, structured output
        return f"SUCCESS: Found {len(result)} items. Data: {result}"
\`\`\`

## Pro Tips

1. Set \`max_iterations\` lower during development to fail fast
2. Add a \`handle_parsing_errors\` callback for graceful recovery
3. Use \`return_intermediate_steps=True\` to inspect the full chain

The key insight: max iterations is a symptom, not the disease. Fix the underlying confusion.`
  },
  {
    slug: 'prompt-engineering-tips',
    title: 'Write prompts like code, not prose',
    date: '2024-12-08',
    category: 'AI Engineering',
    type: 'insight',
    featured: false,
    excerpt: "Stop writing prompts like essays. Structure them like functions—clear inputs, explicit outputs, zero ambiguity. Your LLM isn't creative writing, it's executing instructions.",
    tags: ['Prompts', 'LLM', 'Best Practices'],
    content: `Stop writing prompts like essays. Structure them like functions—clear inputs, explicit outputs, zero ambiguity. Your LLM isn't creative writing, it's executing instructions.`
  },
  {
    slug: 'llm-caching-strategy',
    title: 'Cache LLM responses aggressively',
    date: '2024-12-05',
    category: 'Dev Tools',
    type: 'insight',
    featured: false,
    excerpt: "70% of LLM calls in production are duplicates. Hash your prompts, cache responses, save thousands. Redis + semantic similarity = profit.",
    tags: ['Caching', 'Performance', 'Cost'],
    content: `70% of LLM calls in production are duplicates. Hash your prompts, cache responses, save thousands. Redis + semantic similarity = profit.`
  },
  {
    slug: 'from-backend-to-ai-engineering',
    title: 'From Backend to AI: My Engineering Journey',
    date: '2024-11-28',
    category: 'Career',
    type: 'article',
    featured: false,
    excerpt: 'How I transitioned from traditional backend development to AI engineering at YC startups, and what I learned along the way.',
    tags: ['Career', 'AI', 'Backend', 'Growth'],
    content: `Three years ago, I was a backend engineer who thought AI was just fancy statistics. Now I'm building production AI systems at YC startups. Here's how that transition happened.

## The Catalyst

It started with a simple Slack bot. My team needed something to summarize long threads. I threw GPT-3 at it, expecting garbage.

It worked. Really well.

That moment changed everything. I realized LLMs weren't toys—they were a new primitive for building software.

## The Learning Curve

### Phase 1: Prompt Hacking (Months 1-3)

I treated prompts like magic spells. Random experiments, no system, lots of frustration. Eventually I learned: prompts are code. Test them, version them, iterate systematically.

### Phase 2: Understanding Architectures (Months 4-8)

Reading papers, building from scratch. Implemented a simple transformer, fine-tuned BERT, understood why attention matters. This foundation pays dividends.

### Phase 3: Production Reality (Months 9-12)

Joined a YC startup. Learned that production AI is 10% model, 90% engineering:
- Error handling
- Cost management
- Latency optimization
- User experience

## What Backend Engineers Bring

Your backend skills transfer beautifully:
- **System design** → AI architecture
- **API design** → LLM interface design
- **Database optimization** → Vector store optimization
- **Error handling** → Graceful degradation
- **Testing** → Prompt evaluation

## The Mindset Shift

The hardest part wasn't technical. It was accepting non-determinism.

In backend, you expect 1+1=2 every time. In AI, you expect 1+1≈2 most of the time. Learning to build reliable systems around this uncertainty is the real skill.

## Advice for the Transition

1. **Build something real** - Not tutorials, actual projects
2. **Learn the fundamentals** - Papers are dense but worth it
3. **Join the community** - Twitter, Discord, local meetups
4. **Ship fast** - AI moves fast, so should you

The best time to start was two years ago. The second best time is now.`
  },
  {
    slug: 'vector-databases-compared',
    title: 'Choosing a Vector Database in 2024',
    date: '2024-11-20',
    category: 'Dev Tools',
    type: 'article',
    featured: false,
    excerpt: 'An honest comparison of Pinecone, Weaviate, Qdrant, and pgvector for production RAG applications.',
    tags: ['Vector DB', 'RAG', 'Infrastructure'],
    content: `Choosing a vector database feels like picking a JavaScript framework—too many options, everyone has opinions, and you'll probably switch later anyway.

Here's an honest breakdown based on shipping RAG systems in production.

## The Contenders

### Pinecone
**Pros:** Dead simple, scales automatically, great docs
**Cons:** Expensive at scale, vendor lock-in, limited filtering

Best for: Startups who need to ship fast

### Weaviate
**Pros:** Feature-rich, good hybrid search, self-hosted option
**Cons:** Steeper learning curve, resource hungry

Best for: Teams with specific search requirements

### Qdrant
**Pros:** Rust performance, flexible filtering, great API
**Cons:** Younger ecosystem, fewer integrations

Best for: Performance-sensitive applications

### pgvector
**Pros:** It's just Postgres, you already know it
**Cons:** Doesn't scale as well, fewer features

Best for: Projects that don't need a new database

## What Actually Matters

### 1. Query Latency
If your RAG pipeline is slow, users bounce. Test with your actual data volume.

### 2. Filtering Capabilities
Most real applications need metadata filtering. Some DBs do this better than others.

### 3. Cost at Scale
Managed services get expensive. Do the math for your expected vector count.

### 4. Operational Complexity
Self-hosted = your problem. Managed = their problem + your money.

## My Recommendation

**Start with pgvector** if you're already on Postgres. You can always migrate later.

**Use Pinecone** if you need to ship in a week and have budget.

**Choose Qdrant** if performance is critical and you're comfortable with infra.

The best database is the one your team can actually operate. Choose boring technology.`
  },
  {
    slug: 'ship-boring-ai',
    title: "The best AI products are boring",
    date: '2024-11-15',
    category: 'Build Logs',
    type: 'insight',
    featured: false,
    excerpt: "Hot take: Stop building AI chatbots. Build AI features that make existing workflows faster. Nobody wants to talk to your AI. They want to finish their task.",
    tags: ['Product', 'UX', 'AI'],
    content: `Hot take: Stop building AI chatbots. Build AI features that make existing workflows faster. Nobody wants to talk to your AI. They want to finish their task.`
  },
  {
    slug: 'rag-chunk-size-matters',
    title: 'Your RAG chunk size is probably wrong',
    date: '2024-11-10',
    category: 'AI Engineering',
    type: 'insight',
    featured: false,
    excerpt: "Tested chunk sizes from 100 to 2000 tokens. Sweet spot is 300-500 for most use cases. Smaller = better precision. Larger = better context. Pick based on your queries, not blog posts.",
    tags: ['RAG', 'Optimization', 'Embeddings'],
    content: `Tested chunk sizes from 100 to 2000 tokens. Sweet spot is 300-500 for most use cases. Smaller = better precision. Larger = better context. Pick based on your queries, not blog posts.`
  },
  {
    slug: 'building-foxreach-ai-outreach',
    title: 'Building Foxreach: AI-Powered Investor Outreach',
    date: '2024-10-25',
    category: 'Build Logs',
    type: 'article',
    featured: false,
    excerpt: 'A technical deep-dive into building an AI system that matches founders with investors and generates personalized outreach.',
    tags: ['Build Log', 'AI', 'Startups', 'NLP'],
    content: `Last month I shipped Foxreach, an AI platform that helps founders find and connect with the right investors. Here's the technical journey.

## The Problem

Founders spend 40% of their fundraising time on research and outreach. Most cold emails get ignored because they're generic.

The hypothesis: AI can match founders with investors based on thesis alignment, then generate personalized outreach that actually gets responses.

## The Architecture

### Data Pipeline
1. Scrape investor portfolios, blog posts, tweets
2. Extract investment thesis using Claude
3. Generate embeddings with text-embedding-3-small
4. Store in Qdrant with rich metadata

### Matching Engine
\`\`\`python
def find_investors(startup_profile):
    # Embed the startup description
    startup_embedding = embed(startup_profile.description)

    # Query with metadata filters
    matches = qdrant.search(
        vector=startup_embedding,
        filter={
            "stage": startup_profile.stage,
            "sector": startup_profile.sector,
            "check_size_min": {"$lte": startup_profile.raise_amount}
        },
        limit=50
    )

    # Re-rank with Claude for thesis alignment
    return rerank_with_llm(matches, startup_profile)
\`\`\`

### Outreach Generation
The tricky part: personalization without sounding like a robot.

Key insight: Reference specific investments, not generic interests. "I saw you led Acme's Series A" beats "I know you invest in SaaS."

## What Worked

1. **Hybrid search** - Keywords for names/funds + vectors for thesis
2. **Few-shot examples** - Real emails that got responses
3. **Human-in-the-loop** - Founders edit before sending

## What Didn't Work

1. **Full automation** - VCs can smell AI emails
2. **Long emails** - Keep it under 100 words
3. **Mass outreach** - Quality over quantity

## Results

Early users report 3x better response rates compared to manual outreach. Still early, but the signal is strong.

## Lessons Learned

Building AI products is mostly building good data pipelines. The model is the easy part. Getting clean, structured data about investors? That's the real work.

Next up: adding relationship warmth scoring based on portfolio overlap and mutual connections.`
  },
  {
    slug: 'testing-llm-outputs',
    title: 'Test LLM outputs like ML engineers',
    date: '2024-10-15',
    category: 'AI Engineering',
    type: 'insight',
    featured: false,
    excerpt: "Unit tests don't work for LLMs. Build evaluation datasets instead. 50 input-output pairs > 500 lines of unit tests. Judge models with models.",
    tags: ['Testing', 'LLM', 'Evaluation'],
    content: `Unit tests don't work for LLMs. Build evaluation datasets instead. 50 input-output pairs > 500 lines of unit tests. Judge models with models.`
  }
];

// Helper function to calculate read time
export function calculateReadTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// Helper function to get word count
export function getWordCount(content: string): number {
  return content.trim().split(/\s+/).length;
}

// Helper to determine if post is insight (< 150 words)
export function isInsight(post: BlogPost): boolean {
  return post.type === 'insight' || getWordCount(post.content) < 150;
}

// Get featured post
export function getFeaturedPost(): BlogPost | undefined {
  return blogPosts.find(post => post.featured);
}

// Get insights (short posts)
export function getInsights(): BlogPost[] {
  return blogPosts.filter(post => isInsight(post));
}

// Get articles (full posts)
export function getArticles(): BlogPost[] {
  return blogPosts.filter(post => !isInsight(post));
}

// Get posts by category
export function getPostsByCategory(category: string): BlogPost[] {
  if (category === 'All') return blogPosts;
  return blogPosts.filter(post => post.category === category);
}

// Get related posts (same category, excluding current)
export function getRelatedPosts(currentSlug: string, category: string, limit: number = 3): BlogPost[] {
  return blogPosts
    .filter(post => post.slug !== currentSlug && post.category === category)
    .slice(0, limit);
}

// Get post by slug
export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(post => post.slug === slug);
}

// Get all categories
export function getCategories(): string[] {
  return ['All', ...Array.from(new Set(blogPosts.map(post => post.category)))];
}

// Format date
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Get formatted month year
export function formatMonthYear(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short'
  });
}

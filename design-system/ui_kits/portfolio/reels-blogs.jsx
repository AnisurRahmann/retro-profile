/* global React */
// Blogs: scrollable card list + nested reel viewer (swipe through chapters)
const { useState, useEffect, useRef } = React;

// ---- Blog data -----------------------------------------------------
const BLOGS = [
  {
    id: 'aicp',
    date: 'Apr 18',
    year: '2026',
    cat: 'Building',
    read: '4 min',
    title: 'AICP is live in beta',
    excerpt: 'The compression protocol for LLM streams finally shipped. Here is what shifted.',
    cover: { c1:'#22c55e', c2:'#0a5e3e', glyph:'◈' },
    chapters: [
      { kind:'title', eyebrow:'Ch. 01', title:'The week AICP shipped', sub:'After 9 months of benchmarks, we flipped the switch on Monday.' },
      { kind:'body', head:'What changed', body:'Average payload dropped 62% across our eval set. Latency on long-context calls fell from 4.2s to 1.6s. The protocol is opt-in behind a header — no breaking changes.' },
      { kind:'quote', q:'The best protocols are invisible until you take them away.', by:'— thing I kept repeating this week' },
      { kind:'body', head:'What broke', body:'Tokenizer drift between providers caused a nasty off-by-one in the framing layer. Patched in v0.3.1. Lesson: always negotiate the tokenizer, never assume it.' },
      { kind:'end', cta:'Read the spec →', href:'#' },
    ],
  },
  {
    id: 'agents',
    date: 'Apr 11',
    year: '2026',
    cat: 'Patterns',
    read: '6 min',
    title: 'Reliable agents in production',
    excerpt: 'Three patterns I use on every LangGraph project. Stop treating agents like chatbots.',
    cover: { c1:'#3b82f6', c2:'#1e3a8a', glyph:'⬢' },
    chapters: [
      { kind:'title', eyebrow:'Ch. 02', title:'Agents that survive', sub:'Production is where most agent demos die. These three patterns keep them alive.' },
      { kind:'body', head:'Pattern 1 — Checkpoint after every tool', body:'State corruption is the #1 cause of silent agent failure. Persist graph state the moment a tool returns — not at the end of a turn.' },
      { kind:'body', head:'Pattern 2 — Budget guards', body:'Every node gets a token budget and a wall-clock budget. Exceed either and the agent escalates to a human. No exceptions.' },
      { kind:'body', head:'Pattern 3 — Typed errors as data', body:'Errors are not exceptions — they are messages on the graph. Let downstream nodes reason about them like any other input.' },
      { kind:'end', cta:'Full post →', href:'#' },
    ],
  },
  {
    id: 'mvpkit',
    date: 'Apr 04',
    year: '2026',
    cat: 'Shipping',
    read: '3 min',
    title: 'create-mvpkit hit 1,000 stars',
    excerpt: 'Three months, zero marketing, one CLI. Some notes on what the community wanted.',
    cover: { c1:'#f97316', c2:'#7c2d12', glyph:'▲' },
    chapters: [
      { kind:'title', eyebrow:'Ch. 03', title:'1,000 stars, 3 months', sub:'The boring CLI that caught on.' },
      { kind:'body', head:'Why it worked', body:'Every template was tested by me on a real weekend project first. No template shipped without a real MVP built on top of it.' },
      { kind:'quote', q:'Opinionated beats flexible every time — when the opinions are earned.' },
      { kind:'body', head:'What people ask for most', body:'Auth + vector DB + LLM wiring in one template. Nobody wants to plumb these separately anymore.' },
      { kind:'end', cta:'Star on GitHub →', href:'#' },
    ],
  },
  {
    id: 'prompt-eng',
    date: 'Mar 28',
    year: '2026',
    cat: 'AI',
    read: '5 min',
    title: 'Prompt engineering is just engineering',
    excerpt: 'Why I stopped calling it a separate discipline — and what to call it instead.',
    cover: { c1:'#a855f7', c2:'#4c1d95', glyph:'✦' },
    chapters: [
      { kind:'title', eyebrow:'Ch. 04', title:'Just engineering', sub:'The word "prompt" carries too much baggage.' },
      { kind:'body', head:'The framing problem', body:'Calling it prompt engineering implies it is about words. It is about contracts — inputs, outputs, failure modes. Same as any API.' },
      { kind:'body', head:'What I actually do', body:'Write a contract, test against a held-out set, iterate on the edges. The "prompt" is just the implementation detail.' },
      { kind:'end', cta:'Read more →', href:'#' },
    ],
  },
  {
    id: 'gerald',
    date: 'Mar 15',
    year: '2026',
    cat: 'Case study',
    read: '7 min',
    title: 'How we cut support time 80% at Gerald',
    excerpt: 'A 3-agent pipeline, a well-tuned retrieval layer, and a lot of evals.',
    cover: { c1:'#eab308', c2:'#713f12', glyph:'●' },
    chapters: [
      { kind:'title', eyebrow:'Ch. 05', title:'80% less support time', sub:'YC-backed fintech, 2M users, one customer support pipeline rebuilt.' },
      { kind:'body', head:'The old world', body:'Avg ticket took 11 minutes to resolve. Agents spent 70% of that looking up policy docs. Response quality varied wildly.' },
      { kind:'body', head:'The new pipeline', body:'Tier 1: retrieval agent surfaces the top 3 relevant policy snippets. Tier 2: drafting agent writes a response grounded in those. Tier 3: human agent reviews and sends. Time dropped to 2.2 min.' },
      { kind:'body', head:'What mattered', body:'Not the model. Not even the prompts. The eval harness — we ran 400 held-out tickets every deploy.' },
      { kind:'end', cta:'Full case study →', href:'#' },
    ],
  },
  {
    id: 'sylhet',
    date: 'Mar 02',
    year: '2026',
    cat: 'Personal',
    read: '4 min',
    title: 'Building from Sylhet',
    excerpt: 'Remote-first for 7 years. The tradeoffs nobody writes about.',
    cover: { c1:'#06b6d4', c2:'#164e63', glyph:'◉' },
    chapters: [
      { kind:'title', eyebrow:'Ch. 06', title:'Remote from Sylhet', sub:'UTC+6. Seven years. Every day a tradeoff.' },
      { kind:'body', head:'What works', body:'Deep work blocks that nobody in SF or London can interrupt. Thinking time before the West wakes up. A cost of living that lets me pick projects for love, not rent.' },
      { kind:'body', head:'What doesn\'t', body:'Spontaneous whiteboard sessions. Watercooler alpha. Being in the room when the big decision gets made.' },
      { kind:'quote', q:'Remote work rewards the disciplined and punishes everyone else. I try to be disciplined.' },
      { kind:'end', cta:'Reach out →', href:'mailto:pshakilwizard@gmail.com' },
    ],
  },
  {
    id: 'start',
    date: 'Feb 19',
    year: '2026',
    cat: 'Career',
    read: '5 min',
    title: 'From backend dev to AI engineer',
    excerpt: 'The pivot that took 18 months. What I would do differently.',
    cover: { c1:'#ef4444', c2:'#7f1d1d', glyph:'✕' },
    chapters: [
      { kind:'title', eyebrow:'Ch. 07', title:'The pivot', sub:'18 months, 3 failed projects, 1 real shipped system.' },
      { kind:'body', head:'What I did right', body:'Built in public. Shipped small things weekly. Took the boring enterprise AI contract that taught me evals.' },
      { kind:'body', head:'What I got wrong', body:'Wasted 4 months on frameworks. The framework is not the moat. The eval harness is.' },
      { kind:'body', head:'If you are pivoting', body:'Pick one domain. Ship three real things in it. Write about each one.' },
      { kind:'end', cta:'Get in touch →', href:'mailto:pshakilwizard@gmail.com' },
    ],
  },
];

// ---- Blogs list reel -----------------------------------------------
function ReelBlogs({ onOpen }) {
  return (
    <>
      <div className="animate-in d1 eyebrow" style={{marginTop:20}}>Activity</div>
      <h2 className="animate-in d2 h2" style={{marginTop:12}}>
        What I'm <em style={{color:'var(--accent)',fontStyle:'italic'}}>building</em>, weekly.
      </h2>
      <p className="animate-in d3 lede" style={{marginTop:6}}>
        Tap any card to dive in — each post opens as its own mini-reel. Swipe down to come back.
      </p>
      <div className="animate-in d4 blog-cards">
        {BLOGS.map((b, i) => (
          <button className="blog-card" key={b.id} onClick={() => onOpen(i)}
                  style={{'--c1': b.cover.c1, '--c2': b.cover.c2}}>
            <div className="blog-cover" aria-hidden>
              <span className="blog-glyph">{b.cover.glyph}</span>
              <span className="blog-date">
                <span className="d">{b.date}</span>
                <span className="y">{b.year}</span>
              </span>
            </div>
            <div className="blog-body">
              <div className="blog-meta">
                <span className="blog-cat">{b.cat}</span>
                <span>·</span>
                <span>{b.read}</span>
              </div>
              <div className="blog-title">{b.title}</div>
              <div className="blog-excerpt">{b.excerpt}</div>
            </div>
            <span className="blog-open">↗</span>
          </button>
        ))}
      </div>
    </>
  );
}

// ---- BlogViewer: nested reel stack ---------------------------------
function BlogViewer({ blog, onClose }) {
  const trackRef = useRef(null);
  const chRefs = useRef([]);
  const [active, setActive] = useState(0);
  const startY = useRef(null);

  useEffect(() => {
    // entry animation
    requestAnimationFrame(() => {
      if (trackRef.current) trackRef.current.scrollTop = 0;
    });
    // ESC to close
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'j') {
        const next = Math.min(active+1, blog.chapters.length-1);
        jump(next);
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        if (active === 0) onClose();
        else jump(Math.max(active-1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          setActive(Number(e.target.dataset.idx));
        }
      });
    }, { root: track, threshold: [0.6, 0.9] });
    chRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const jump = (i) => {
    const track = trackRef.current;
    const el = chRefs.current[i];
    if (!track || !el) return;
    track.scrollTop = el.offsetTop;
  };

  // swipe-down-to-close on first chapter
  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; };
  const onTouchEnd = (e) => {
    if (startY.current == null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (active === 0 && dy > 80 && trackRef.current.scrollTop < 10) onClose();
    startY.current = null;
  };

  return (
    <div className="blog-viewer" style={{'--c1': blog.cover.c1, '--c2': blog.cover.c2}}>
      <div className="blog-viewer-top">
        <button className="bv-close" onClick={onClose} aria-label="Close blog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
          <span>back</span>
        </button>
        <div className="bv-meta">
          <span>{blog.cat}</span>
          <span>·</span>
          <span>{blog.date} {blog.year}</span>
        </div>
        <div className="bv-progress">
          {blog.chapters.map((_, i) => (
            <span key={i} className={`seg ${i <= active ? 'on' : ''}`}/>
          ))}
        </div>
      </div>

      <div className="bv-track" ref={trackRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {blog.chapters.map((ch, i) => (
          <section
            key={i}
            ref={el => chRefs.current[i] = el}
            data-idx={i}
            className={`bv-chapter bv-${ch.kind} ${active===i ? 'active' : ''}`}
          >
            {ch.kind === 'title' && (
              <>
                <div className="bv-cover-bg" aria-hidden>
                  <span className="bv-glyph">{blog.cover.glyph}</span>
                </div>
                <div className="bv-ch-eyebrow">{ch.eyebrow}</div>
                <h2 className="bv-ch-title">{ch.title}</h2>
                <p className="bv-ch-sub">{ch.sub}</p>
                <div className="bv-ch-hint">swipe up to read ↑</div>
              </>
            )}
            {ch.kind === 'body' && (
              <>
                <div className="bv-ch-num">{String(i+1).padStart(2,'0')}</div>
                <h3 className="bv-ch-head">{ch.head}</h3>
                <p className="bv-ch-body">{ch.body}</p>
              </>
            )}
            {ch.kind === 'quote' && (
              <>
                <div className="bv-ch-mark">"</div>
                <p className="bv-ch-quote">{ch.q}</p>
                {ch.by && <div className="bv-ch-by">{ch.by}</div>}
              </>
            )}
            {ch.kind === 'end' && (
              <>
                <div className="bv-ch-eyebrow">— end of post —</div>
                <h3 className="bv-ch-head">Thanks for reading.</h3>
                <div className="bv-ch-ctas">
                  {ch.cta && <a className="btn btn-primary" href={ch.href}>{ch.cta}</a>}
                  <button className="btn" onClick={onClose}>Back to blogs</button>
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

window.BLOGS = BLOGS;
window.ReelBlogs = ReelBlogs;
window.BlogViewer = BlogViewer;

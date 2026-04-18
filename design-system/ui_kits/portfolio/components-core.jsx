// Portfolio UI kit — navigation, hero, sections, cards, form, footer.
// All components share scope via window.* assignments at the end.

const { useState, useEffect } = React;

// ──────────────── NAV ────────────────
function Nav({ active = 'Projects' }) {
  const items = ['Now', 'Projects', 'Writing', 'About', 'Contact'];
  return (
    <nav className="pf-nav">
      <a href="#top" className="pf-logo">SHAKIL<span className="pf-accent-dot">.</span></a>
      <ul className="pf-nav-links">
        {items.map(x => (
          <li key={x}><a href={`#${x.toLowerCase()}`} className={`pf-nav-link${active===x?' is-active':''}`}>{x}</a></li>
        ))}
      </ul>
    </nav>
  );
}

// ──────────────── HERO ────────────────
function Hero() {
  const phrases = ['AI Engineer', 'Builder', 'Problem Solver'];
  const [i, setI] = useState(0);
  const [txt, setTxt] = useState('');
  const [del, setDel] = useState(false);
  useEffect(() => {
    const cur = phrases[i];
    const speed = del ? 50 : 90;
    const pause = del ? 500 : 1800;
    if (!del && txt === cur) { setTimeout(() => setDel(true), pause); return; }
    if (del && txt === '') { setDel(false); setI((i+1) % phrases.length); return; }
    const t = setTimeout(() => setTxt(p => del ? p.slice(0,-1) : cur.slice(0, p.length+1)), speed);
    return () => clearTimeout(t);
  }, [txt, del, i]);

  return (
    <section className="pf-hero" id="top">
      <div className="pf-hero-grid">
        <div>
          <div className="pf-eyebrow">
            <span className="pf-typing">{txt}</span><span className="pf-cursor">|</span>
          </div>
          <h1 className="pf-h1">
            I'm Shakil, an <em>AI Engineer</em><br/>&amp; Builder
          </h1>
          <p className="pf-lede">
            I build intelligent systems and AI-powered products. Currently focused on
            LLM integrations, agent development, and helping startups ship AI features that users love.
          </p>
          <div className="pf-btn-row">
            <a className="pf-btn pf-btn-primary" href="#projects">View Projects →</a>
            <a className="pf-btn" href="#contact">Get in Touch</a>
          </div>
        </div>
        <div className="pf-status"><span className="pf-dot"></span>Available for work</div>
      </div>
      <div className="pf-scroll">
        <span className="pf-nano">Scroll</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 13l5 5 5-5M7 6l5 5 5-5"/></svg>
      </div>
    </section>
  );
}

// ──────────────── SECTION HEADER ────────────────
function SectionHeader({ badge, title }) {
  return (
    <div className="pf-sec-head">
      <span className="pf-sec-badge">{badge}</span>
      <h2 className="pf-sec-title">{title}</h2>
      <div className="pf-sec-line"></div>
    </div>
  );
}

Object.assign(window, { Nav, Hero, SectionHeader });

// Portfolio UI kit — projects / now / writing / companies / stats / contact / footer

const { useState: _useState } = React;

// ──────────────── NOW ────────────────
function NowGrid({ items }) {
  return (
    <div className="pf-now-grid">
      {items.map((it, i) => (
        <div className="pf-now-card" key={i}>
          <h3 className="pf-now-title">{it.title}</h3>
          <p className="pf-now-desc">{it.description}</p>
        </div>
      ))}
    </div>
  );
}

// ──────────────── PROJECTS ────────────────
function ProjectCard({ number, title, description, tags }) {
  return (
    <a className="pf-proj" href="#">
      <span className="pf-proj-num">{number}</span>
      <h3 className="pf-proj-title">{title}</h3>
      <p className="pf-proj-desc">{description}</p>
      <div className="pf-tags">
        {tags.map(t => <span className="pf-tag" key={t}>{t}</span>)}
      </div>
      <span className="pf-proj-arrow" aria-hidden>↗</span>
    </a>
  );
}

function ProjectsGrid({ projects }) {
  return (
    <div className="pf-proj-grid">
      {projects.map(p => <ProjectCard key={p.number} {...p} />)}
    </div>
  );
}

// ──────────────── COMPANIES ────────────────
function CompaniesGrid({ companies }) {
  return (
    <div className="pf-co-grid">
      {companies.map((c, i) => (
        <div className="pf-co" key={i}>
          <div className="pf-co-head">
            <h3 className="pf-co-name">{c.name}</h3>
            {c.badge && <span className="pf-badge-sec">{c.badge}</span>}
            {c.current && <span className="pf-badge-cur">Current</span>}
          </div>
          <span className="pf-co-loc">{c.location}</span>
          {c.clients && (
            <div className="pf-co-clients">
              <span className="pf-nano">Clients</span>
              <div className="pf-tags" style={{marginTop:'.5rem'}}>
                {c.clients.map(x => <span className="pf-tag" key={x}>{x}</span>)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────── WRITING ────────────────
function WritingRow({ post }) {
  const catMap = { 'ai-engineering':'AI Engineering', 'career':'Career', 'dev-tools':'Dev Tools', 'research':'Research' };
  return (
    <a href="#" className={`pf-wr${post.featured ? ' is-featured' : ''}`}>
      <div className="pf-wr-main">
        <div className="pf-wr-head">
          <span className={`pf-cat pf-cat-${post.category}`}>{catMap[post.category] || post.category}</span>
          {post.featured && <span className="pf-fbadge">Featured</span>}
        </div>
        <span className="pf-wr-title">{post.title}</span>
        <span className="pf-wr-excerpt">{post.excerpt}</span>
      </div>
      <div className="pf-wr-meta">
        <span className="pf-wr-rt">{post.readTime}</span>
        <span className="pf-wr-date">{post.date}</span>
      </div>
    </a>
  );
}

// ──────────────── STATS ────────────────
function Stats({ stats }) {
  return (
    <div className="pf-stats">
      {stats.map((s, i) => (
        <div className="pf-stat" key={i}>
          <div className="pf-stat-num">{s.number}</div>
          <div className="pf-stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ──────────────── SKILLS ────────────────
function Skills({ primary, secondary }) {
  return (
    <div className="pf-skills">
      <h3 className="pf-skills-title">Tech Stack</h3>
      <div className="pf-skills-group">
        <span className="pf-nano">Primary</span>
        <div className="pf-tags" style={{marginTop:'.75rem'}}>
          {primary.map(x => <span key={x} className="pf-tag pf-tag-primary">{x}</span>)}
        </div>
      </div>
      <div className="pf-skills-group">
        <span className="pf-nano">Secondary</span>
        <div className="pf-tags" style={{marginTop:'.75rem'}}>
          {secondary.map(x => <span key={x} className="pf-tag">{x}</span>)}
        </div>
      </div>
    </div>
  );
}

// ──────────────── CONTACT ────────────────
function Contact() {
  const [copied, setCopied] = _useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText('pshakilwizard@gmail.com'); } catch(e){}
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  return (
    <section id="contact" className="pf-contact">
      <div className="pf-avail">
        <span className="pf-dot"></span>Available for contracts &amp; full-time roles
      </div>
      <h2 className="pf-contact-title">Let's Work Together</h2>
      <p className="pf-lede" style={{marginBottom:'2rem'}}>Have an interesting project or opportunity? I'd love to hear from you.</p>
      <div className="pf-email-wrap">
        <a href="mailto:pshakilwizard@gmail.com" className="pf-email">pshakilwizard@gmail.com</a>
        <button className={`pf-copy${copied?' is-ok':''}`} onClick={copy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <a href="#" className="pf-book">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Book a Call
      </a>
      <form className="pf-form" onSubmit={e=>e.preventDefault()}>
        <h3 className="pf-form-title">Send a Message</h3>
        <div className="pf-form-row">
          <div className="pf-form-group"><label className="pf-form-label">Name</label><input className="pf-input" placeholder="Your name"/></div>
          <div className="pf-form-group"><label className="pf-form-label">Email</label><input className="pf-input" placeholder="your@email.com"/></div>
        </div>
        <div className="pf-form-group"><label className="pf-form-label">Message</label><textarea className="pf-input pf-textarea" rows={4} placeholder="Your message…"></textarea></div>
        <button className="pf-btn pf-btn-primary" style={{width:'100%'}}>Send Message</button>
      </form>
      <div className="pf-social">
        <a className="pf-social-link" href="#" aria-label="GitHub"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg><span className="pf-nano">GitHub</span></a>
        <a className="pf-social-link" href="#" aria-label="X"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg><span className="pf-nano">X</span></a>
        <a className="pf-social-link" href="#" aria-label="LinkedIn"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg><span className="pf-nano">LinkedIn</span></a>
      </div>
    </section>
  );
}

Object.assign(window, { NowGrid, ProjectCard, ProjectsGrid, CompaniesGrid, WritingRow, Stats, Skills, Contact });

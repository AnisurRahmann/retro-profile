/* global React */
// Individual reel screens

// ----- Hero ----------------------------------------------------------
function ReelHero() {
  return (
    <>
      <div className="block b1 eyebrow" style={{marginTop:40}}>Fullstack AI Engineer</div>
      <h1 className="block b2 display" style={{marginTop:24}}>
        Building<br/><em>AI systems</em><br/>that ship.
      </h1>
      <p className="block b3 lede" style={{marginTop:20,maxWidth:320}}>
        7 years shipping production systems.
        $900K+ cost savings. $1M+/month GMV.
        Based in Sylhet — available globally.
      </p>
      <div className="block b4 loc">
        <span className="ring"/>
        <span>AVAILABLE · OPEN TO ROLES</span>
      </div>
    </>
  );
}

// ----- Now ----------------------------------------------------------
function ReelNow() {
  const items = [
    { t:'AICP Protocol', d:'A wire-format compression protocol for LLM streams — shipping beta this month.', live:true },
    { t:'create-mvpkit', d:'CLI to scaffold production-ready AI MVPs. Auth, vector DB, LLM, done in minutes.' },
    { t:'Multi-agent playbooks', d:'Production patterns for reliable LangGraph agents at scale.' },
  ];
  return (
    <>
      <div className="animate-in d1 now-badge" style={{marginTop:40}}>
        <span className="dot"/> Currently Building
      </div>
      <h2 className="animate-in d2 h2" style={{marginTop:16}}>Three things in flight <em style={{color:'var(--accent)',fontStyle:'italic'}}>right now.</em></h2>
      <div className="animate-in d3 now-list">
        {items.map((it, i) => (
          <div key={i} className={`now-item ${it.live?'live':''}`}>
            <div className="t">{it.t}</div>
            <div className="d">{it.d}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ----- Stats --------------------------------------------------------
function ReelStats() {
  const stats = [
    { n:'$900K', l:'Saved / year via AI' },
    { n:'$1M+',  l:'Monthly GMV enabled' },
    { n:'90%',   l:'Repayment rate ↑' },
    { n:'80%',   l:'Support time cut' },
  ];
  return (
    <>
      <div className="animate-in d1 eyebrow" style={{marginTop:16}}>Impact</div>
      <h2 className="animate-in d2 h2" style={{marginTop:14}}>
        Numbers from shipped work.
      </h2>
      <p className="animate-in d3 lede" style={{marginTop:8}}>
        Measured outcomes from production systems across fintech, healthcare, and outreach tools.
      </p>
      <div className="stats-grid" style={{marginTop:18}}>
        {stats.map((s,i) => (
          <div className="stat animate-stat" key={i}>
            <div className="n">{s.n}</div>
            <div className="l">{s.l}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ----- Project (single) --------------------------------------------
function ReelProject({ num, title, italic, desc, tags, link = '#', mockType = 'a' }) {
  return (
    <>
      <div className="animate-in d1 proj-num" style={{marginTop:30}}>PROJECT · {num}</div>
      <h2 className="animate-in d2 proj-title">
        {title} <em>{italic}</em>
      </h2>
      <div className="animate-in d3 proj-mock">
        <div className="proj-mock-ui">
          <div className="row" style={{justifyContent:'space-between'}}>
            <span>● ● ●</span>
            <span>{title.toLowerCase().replace(/\s/g,'-')}.local</span>
          </div>
          <div className="row" style={{marginTop:4}}>
            <span className="chip">{tags[0]}</span>
            {tags[1] && <span className="chip">{tags[1]}</span>}
          </div>
          <div className="bar a" style={{marginTop:6}}/>
          <div className="bar b"/>
          <div className="bar" style={{width:'80%'}}/>
          <div className="bar b"/>
          <div style={{marginTop:'auto',display:'flex',justifyContent:'space-between',fontSize:8}}>
            <span>STATUS: OK</span>
            <span style={{color:'var(--accent)'}}>● LIVE</span>
          </div>
        </div>
      </div>
      <p className="animate-in d4 proj-desc">{desc}</p>
      <div className="animate-in d5 proj-tags">
        {tags.map(t => <span className="tag" key={t}>{t}</span>)}
      </div>
      <div className="animate-in d6 proj-cta">
        <a className="btn btn-primary" href={link}>Case study →</a>
        <a className="btn" href="#">GitHub</a>
      </div>
    </>
  );
}

// ----- Companies ---------------------------------------------------
function ReelCompanies() {
  const cos = [
    { n:'Gerald', loc:'USA · Remote', badge:'YC W21', current:true },
    { n:'re:cruit', loc:'USA · Contract', clients:['Replo','First Delivery','Edlyft','Osmind'] },
    { n:'SJ Innovation', loc:'Bangladesh' },
    { n:'Social Energy', loc:'UK · Remote' },
  ];
  return (
    <>
      <div className="animate-in d1 eyebrow" style={{marginTop:20}}>Shipped for</div>
      <h2 className="animate-in d2 h2" style={{marginTop:12}}>
        Teams that trusted the <em style={{color:'var(--accent)',fontStyle:'italic'}}>work.</em>
      </h2>
      <div className="animate-in d3 co-list">
        {cos.map((c,i) => (
          <div className={`co-item ${c.current?'current':''}`} key={i}>
            <div>
              <div className="co-name">{c.n}</div>
              <div className="co-loc">{c.loc}</div>
            </div>
            {c.badge && <span className="co-badge">{c.badge}</span>}
            {c.current && !c.badge && <span className="co-badge">Current</span>}
            {c.clients && (
              <div className="co-clients">
                {c.clients.map(x => <span className="chip" key={x}>{x}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ----- Skills ------------------------------------------------------
function ReelSkills() {
  const primary = ['LangChain','LangGraph','Claude API','Bedrock','Python','FastAPI','React','Next.js'];
  const secondary = ['Node.js','Flask','AWS','GCP','Docker','pgvector','MongoDB','Chart.js','TradingView'];
  return (
    <>
      <div className="animate-in d1 eyebrow" style={{marginTop:30}}>Stack</div>
      <h2 className="animate-in d2 h2" style={{marginTop:12}}>
        Tools I reach for <em style={{color:'var(--accent)',fontStyle:'italic'}}>first.</em>
      </h2>
      <div className="animate-in d3 skill-group" style={{marginTop:18}}>
        <div className="hd">Primary</div>
        <div className="skill-chips">
          {primary.map(s => <span className="chip primary" key={s}>{s}</span>)}
        </div>
      </div>
      <div className="animate-in d4 skill-group">
        <div className="hd">Also comfortable with</div>
        <div className="skill-chips">
          {secondary.map(s => <span className="chip" key={s}>{s}</span>)}
        </div>
      </div>
    </>
  );
}

// ----- Writing -----------------------------------------------------
function ReelWriting() {
  const posts = [
    { t:'Building Multi-Agent Systems at Production Scale', d:'Apr 2025', c:'Engineering', r:'8 min' },
    { t:'AICP: a compression protocol for LLMs', d:'Mar 2025', c:'Research', r:'12 min' },
    { t:'The Art of Prompt Engineering', d:'Feb 2025', c:'AI', r:'5 min' },
    { t:'From Backend to AI: a developer’s journey', d:'Dec 2024', c:'Career', r:'6 min' },
  ];
  return (
    <>
      <div className="animate-in d1 eyebrow" style={{marginTop:30}}>Writing</div>
      <h2 className="animate-in d2 h2" style={{marginTop:12}}>
        Notes from the <em style={{color:'var(--accent)',fontStyle:'italic'}}>build.</em>
      </h2>
      <div className="animate-in d3 wr-list">
        {posts.map((p,i) => (
          <div className="wr-row" key={i}>
            <div>
              <div className="wr-title">{p.t}</div>
              <div className="wr-meta">
                <span>{p.d}</span>
                <span>·</span>
                <span className="wr-cat">{p.c}</span>
                <span>·</span>
                <span>{p.r}</span>
              </div>
            </div>
            <div className="wr-arrow">↗</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ----- About -------------------------------------------------------
function ReelAbout() {
  return (
    <>
      <div className="animate-in d1 eyebrow" style={{marginTop:40}}>About</div>
      <p className="animate-in d2 about-quote">
        I build AI systems that <em>survive</em> production — not demos that survive the pitch.
      </p>
      <p className="animate-in d3 about-body">
        Started in 2018 at Social Energy (UK) building energy monitoring. Since then I've shipped for YC-backed startups and enterprise clients across fintech, healthcare, and edtech. B.E. Computer Science, 2021.
      </p>
      <div className="animate-in d4 about-meta">
        <div className="cell"><div className="l">Based</div><div className="v">Sylhet, BD</div></div>
        <div className="cell"><div className="l">Timezone</div><div className="v">UTC+6</div></div>
        <div className="cell"><div className="l">Shipped since</div><div className="v">2018</div></div>
        <div className="cell"><div className="l">Open to</div><div className="v">Senior / Staff</div></div>
      </div>
    </>
  );
}

// ----- Contact -----------------------------------------------------
function ReelContact() {
  const rows = [
    { l:'Email',   v:'pshakilwizard@gmail.com', href:'mailto:pshakilwizard@gmail.com' },
    { l:'GitHub',  v:'@AnisurRahmann',          href:'https://github.com/AnisurRahmann' },
    { l:'LinkedIn',v:'/in/shakil-ai',           href:'#' },
    { l:'X',       v:'@shakil_builds',          href:'#' },
    { l:'Calendar',v:'cal.com/shakil',          href:'#' },
  ];
  return (
    <>
      <div className="animate-in d1 eyebrow" style={{marginTop:20}}>Contact</div>
      <h2 className="animate-in d2 contact-big">
        Let's build<br/><em>something</em> real.
      </h2>
      <div className="animate-in d3 contact-rows">
        {rows.map(r => (
          <a className="contact-row" href={r.href} key={r.l}>
            <span className="l">{r.l}</span>
            <span className="v">{r.v} →</span>
          </a>
        ))}
      </div>
    </>
  );
}

// ----- Outro -------------------------------------------------------
function ReelOutro({ onRestart }) {
  return (
    <>
      <div className="animate-in d1 outro-mark">— END OF REEL —</div>
      <h2 className="animate-in d2 outro-h">
        Thanks for<br/><em>scrolling.</em>
      </h2>
      <p className="animate-in d3 outro-sub">
        Questions, briefs, or just saying hi — my inbox is open.
      </p>
      <div className="animate-in d4 outro-btns">
        <a className="btn btn-primary" href="mailto:pshakilwizard@gmail.com">Email me →</a>
        <button className="btn" onClick={onRestart}>Replay</button>
      </div>
    </>
  );
}

Object.assign(window, {
  ReelHero, ReelNow, ReelStats, ReelProject,
  ReelCompanies, ReelSkills, ReelWriting,
  ReelAbout, ReelContact, ReelOutro,
});

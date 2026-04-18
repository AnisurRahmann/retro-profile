import React from 'react';
import { Project as ProjectType } from '../../data/portfolio';

interface ProjectProps extends ProjectType {}

const Project: React.FC<ProjectProps> = ({ num, title, italic, desc, tags, link = '#' }) => (
  <>
    <div className="animate-in d1 proj-num" style={{ marginTop: 30 }}>PROJECT &middot; {num}</div>
    <h2 className="animate-in d2 proj-title">
      {title} <em>{italic}</em>
    </h2>
    <div className="animate-in d3 proj-mock">
      <div className="proj-mock-ui">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>&#x25CF; &#x25CF; &#x25CF;</span>
          <span>{title.toLowerCase().replace(/\s/g, '-')}.local</span>
        </div>
        <div className="row" style={{ marginTop: 4 }}>
          <span className="chip">{tags[0]}</span>
          {tags[1] && <span className="chip">{tags[1]}</span>}
        </div>
        <div className="bar a" style={{ marginTop: 6 }} />
        <div className="bar b" />
        <div className="bar" style={{ width: '80%' }} />
        <div className="bar b" />
        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
          <span>STATUS: OK</span>
          <span style={{ color: 'var(--accent)' }}>&#x25CF; LIVE</span>
        </div>
      </div>
    </div>
    <p className="animate-in d4 proj-desc">{desc}</p>
    <div className="animate-in d5 proj-tags">
      {tags.map(t => <span className="tag" key={t}>{t}</span>)}
    </div>
    <div className="animate-in d6 proj-cta">
      <a className="btn btn-primary" href={link}>Case study &rarr;</a>
      <a className="btn" href={link}>GitHub</a>
    </div>
  </>
);

export default Project;

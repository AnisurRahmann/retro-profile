import React from 'react';
import { COMPANIES } from '../../data/portfolio';

const Companies: React.FC = () => (
  <>
    <div className="animate-in d1 eyebrow" style={{ marginTop: 20 }}>Shipped for</div>
    <h2 className="animate-in d2 h2" style={{ marginTop: 12 }}>
      Teams that trusted the <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>work.</em>
    </h2>
    <div className="animate-in d3 co-list">
      {COMPANIES.map((c, i) => (
        <div className={`co-item ${c.current ? 'current' : ''}`} key={i}>
          <div>
            <div className="co-name">{c.name}</div>
            <div className="co-loc">{c.location}</div>
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

export default Companies;

import React from 'react';
import { STATS } from '../../data/portfolio';

const Stats: React.FC = () => (
  <>
    <div className="animate-in d1 eyebrow" style={{ marginTop: 16 }}>Impact</div>
    <h2 className="animate-in d2 h2" style={{ marginTop: 14 }}>
      Numbers from shipped work.
    </h2>
    <p className="animate-in d3 lede" style={{ marginTop: 8 }}>
      Measured outcomes from production systems across fintech, healthcare, and outreach tools.
    </p>
    <div className="stats-grid" style={{ marginTop: 18 }}>
      {STATS.map((s, i) => (
        <div className="stat animate-stat" key={i}>
          <div className="n">{s.number}</div>
          <div className="l">{s.label}</div>
        </div>
      ))}
    </div>
  </>
);

export default Stats;

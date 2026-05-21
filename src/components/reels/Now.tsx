import React from 'react';
import { NOW_ITEMS } from '../../data/portfolio';

const Now: React.FC = () => (
  <>
    <div className="animate-in d1 now-badge" style={{ marginTop: 40 }}>
      <span className="dot" /> Currently Shipping
    </div>
    <h2 className="animate-in d2 h2" style={{ marginTop: 16 }}>
      Three things in production <em>right now.</em>
    </h2>
    <div className="animate-in d3 now-list">
      {NOW_ITEMS.map((it, i) => (
        <div key={i} className={`now-item ${it.live ? 'live' : ''}`}>
          <div className="t">{it.title}</div>
          <div className="d">{it.desc}</div>
        </div>
      ))}
    </div>
  </>
);

export default Now;

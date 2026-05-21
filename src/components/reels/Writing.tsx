import React from 'react';
import { WRITING_POSTS } from '../../data/portfolio';

const Writing: React.FC = () => (
  <>
    <div className="animate-in d1 eyebrow" style={{ marginTop: 30 }}>Changelog</div>
    <h2 className="animate-in d2 h2" style={{ marginTop: 12 }}>
      Dispatches from <em>production.</em>
    </h2>
    <div className="animate-in d3 wr-list">
      {WRITING_POSTS.map((p, i) => (
        <div className="wr-row" key={i}>
          <div>
            <div className="wr-title">{p.title}</div>
            <div className="wr-meta">
              <span>{p.date}</span>
              <span>&middot;</span>
              <span className="wr-cat">{p.cat}</span>
              <span>&middot;</span>
              <span>{p.read}</span>
            </div>
          </div>
          <div className="wr-arrow">&#x2197;</div>
        </div>
      ))}
    </div>
  </>
);

export default Writing;

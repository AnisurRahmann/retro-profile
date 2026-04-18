import React from 'react';
import { ABOUT } from '../../data/portfolio';

const About: React.FC = () => (
  <>
    <div className="animate-in d1 eyebrow" style={{ marginTop: 40 }}>About</div>
    <p
      className="animate-in d2 about-quote"
      dangerouslySetInnerHTML={{ __html: ABOUT.quote }}
    />
    <p className="animate-in d3 about-body">
      {ABOUT.body}
    </p>
    <div className="animate-in d4 about-meta">
      {ABOUT.meta.map(m => (
        <div className="cell" key={m.label}>
          <div className="l">{m.label}</div>
          <div className="v">{m.value}</div>
        </div>
      ))}
    </div>
  </>
);

export default About;

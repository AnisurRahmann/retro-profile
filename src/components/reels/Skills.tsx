import React from 'react';
import { SKILLS_PRIMARY, SKILLS_SECONDARY } from '../../data/portfolio';

const Skills: React.FC = () => (
  <>
    <div className="animate-in d1 eyebrow" style={{ marginTop: 30 }}>Stack</div>
    <h2 className="animate-in d2 h2" style={{ marginTop: 12 }}>
      Tools I reach for <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>first.</em>
    </h2>
    <div className="animate-in d3 skill-group" style={{ marginTop: 18 }}>
      <div className="hd">Primary</div>
      <div className="skill-chips">
        {SKILLS_PRIMARY.map(s => <span className="chip primary" key={s}>{s}</span>)}
      </div>
    </div>
    <div className="animate-in d4 skill-group">
      <div className="hd">Also comfortable with</div>
      <div className="skill-chips">
        {SKILLS_SECONDARY.map(s => <span className="chip" key={s}>{s}</span>)}
      </div>
    </div>
  </>
);

export default Skills;

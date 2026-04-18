import React from 'react';
import { HERO } from '../../data/portfolio';

const Hero: React.FC = () => (
  <>
    <div className="block b1 eyebrow" style={{ marginTop: 40 }}>{HERO.eyebrow}</div>
    <h1 className="block b2 display" style={{ marginTop: 24 }}>
      {HERO.title_line1}<br /><em>{HERO.title_em}</em><br />{HERO.title_line3}
    </h1>
    <p className="block b3 lede" style={{ marginTop: 20, maxWidth: 320 }}>
      {HERO.lede}
    </p>
    <div className="block b4 loc">
      {HERO.ring && <span className="ring" />}
      <span>{HERO.location}</span>
    </div>
  </>
);

export default Hero;

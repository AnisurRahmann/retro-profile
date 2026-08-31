import React from 'react';
import { Link } from 'react-router-dom';
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
    <div className="block b5" style={{ marginTop: 18 }}>
      <Link to="/gym" className="gym-bubble">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6.5 6.5v11" /><path d="M17.5 6.5v11" />
          <path d="M3 9.5v5" /><path d="M21 9.5v5" />
          <path d="M6.5 12h11" />
        </svg>
        <span>psst... wanna see my gym split?</span>
      </Link>
    </div>
  </>
);

export default Hero;

import React from 'react';
import { OUTRO } from '../../data/portfolio';

interface OutroProps {
  onRestart: () => void;
}

const Outro: React.FC<OutroProps> = ({ onRestart }) => (
  <>
    <div className="animate-in d1 outro-mark">&mdash; END OF REEL &mdash;</div>
    <h2 className="animate-in d2 outro-h">
      {OUTRO.heading_line1}<br /><em>{OUTRO.heading_em}</em>
    </h2>
    <p className="animate-in d3 outro-sub">
      {OUTRO.sub}
    </p>
    <div className="animate-in d4 outro-btns">
      <a className="btn btn-primary" href={OUTRO.cta_href}>{OUTRO.cta_label}</a>
      <button className="btn" onClick={onRestart}>{OUTRO.replay_label}</button>
    </div>
  </>
);

export default Outro;

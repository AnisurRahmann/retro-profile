import React from 'react';

interface ReelCounterProps {
  index: number;
  total: number;
  label: string;
}

export const ReelCounter: React.FC<ReelCounterProps> = ({ index, total, label }) => (
  <div className="reel-counter">
    <span className="bar" />
    <span className="now">{String(index + 1).padStart(2, '0')}</span>
    <span>/ {String(total).padStart(2, '0')}</span>
    <span>. {label}</span>
  </div>
);

interface ReelFootProps {
  hint?: string;
}

export const ReelFoot: React.FC<ReelFootProps> = ({ hint = 'swipe up' }) => (
  <div className="reel-foot">
    <span className="reel-brand">ar<span>.</span>shakil</span>
    <span className="reel-hint">
      {hint}
      <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
        <path d="M5 1 L5 11 M1 5 L5 1 L9 5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    </span>
  </div>
);

interface RailNavProps {
  count: number;
  active: number;
  onJump: (index: number) => void;
}

export const RailNav: React.FC<RailNavProps> = ({ count, active, onJump }) => (
  <div className="railnav" aria-label="reel navigation">
    {Array.from({ length: count }).map((_, i) => (
      <button
        key={i}
        aria-current={active === i}
        aria-label={`Reel ${i + 1}`}
        onClick={() => onJump(i)}
      >
        <span className="tick" />
      </button>
    ))}
  </div>
);

/* global React */
const { useEffect, useRef, useState } = React;

// ---------- Status Bar (iOS-style) -----------------------------------
function StatusBar() {
  return (
    <div className="status">
      <span>9:41</span>
      <div className="status-right">
        {/* signal */}
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
          <rect x="0" y="7" width="3" height="4" rx=".5" fill="currentColor"/>
          <rect x="4.5" y="5" width="3" height="6" rx=".5" fill="currentColor"/>
          <rect x="9" y="2.5" width="3" height="8.5" rx=".5" fill="currentColor"/>
          <rect x="13.5" y="0" width="3" height="11" rx=".5" fill="currentColor"/>
        </svg>
        {/* wifi */}
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path d="M7.5 2.2c2.6 0 5 .95 6.86 2.5l-1.1 1.3A8.64 8.64 0 0 0 7.5 3.9c-2.14 0-4.1.8-5.6 2.1L.8 4.7A10.34 10.34 0 0 1 7.5 2.2z" fill="currentColor"/>
          <path d="M7.5 6c1.6 0 3.1.6 4.24 1.55l-1.1 1.3A4.9 4.9 0 0 0 7.5 7.7c-1.22 0-2.33.45-3.2 1.2L3.2 7.6A6.52 6.52 0 0 1 7.5 6z" fill="currentColor"/>
          <circle cx="7.5" cy="10.5" r=".9" fill="currentColor"/>
        </svg>
        {/* battery */}
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x=".5" y=".5" width="22" height="11" rx="2.6" stroke="currentColor" opacity=".6"/>
          <rect x="2" y="2" width="19" height="8" rx="1.4" fill="currentColor"/>
          <rect x="23.5" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".6"/>
        </svg>
      </div>
    </div>
  );
}

// ---------- Reel Chrome (counter + foot hint) ------------------------
function ReelCounter({ index, total, label }) {
  return (
    <div className="reel-counter">
      <span className="bar"/>
      <span className="now">{String(index+1).padStart(2,'0')}</span>
      <span>/ {String(total).padStart(2,'0')}</span>
      <span>· {label}</span>
    </div>
  );
}
function ReelFoot({ hint = 'swipe up' }) {
  return (
    <div className="reel-foot">
      <span className="reel-brand">ar<span>.</span>shakil</span>
      <span className="reel-hint">
        {hint}
        <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
          <path d="M5 1 L5 11 M1 5 L5 1 L9 5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        </svg>
      </span>
    </div>
  );
}

// ---------- Rail Nav -------------------------------------------------
function RailNav({ count, active, onJump }) {
  return (
    <div className="railnav" aria-label="reel navigation">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          aria-current={active === i}
          aria-label={`Reel ${i+1}`}
          onClick={() => onJump(i)}
        >
          <span className="tick"/>
        </button>
      ))}
    </div>
  );
}

window.StatusBar = StatusBar;
window.ReelCounter = ReelCounter;
window.ReelFoot = ReelFoot;
window.RailNav = RailNav;

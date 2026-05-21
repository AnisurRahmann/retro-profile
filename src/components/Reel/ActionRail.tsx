import React from 'react';
import { SOCIALS } from '../../data/portfolio';

const Icons = {
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13" /><path d="M7 11l5 5 5-5" /><path d="M5 21h14" />
    </svg>
  ),
  socials: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="5.5" r="2.4" />
      <circle cx="18" cy="18.5" r="2.4" />
      <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.05c-3.19.69-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.82 1.19 3.08 0 4.41-2.68 5.38-5.24 5.67.41.35.78 1.05.78 2.12v3.14c0 .31.21.68.79.56 4.57-1.52 7.86-5.83 7.86-10.91C23.5 5.65 18.35.5 12 .5z" /></svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S.02 4.88.02 3.5 1.13 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8h4.56v14H.22V8zM8.22 8h4.37v1.92h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 6.99V22h-4.56v-6.23c0-1.48-.03-3.39-2.07-3.39-2.07 0-2.39 1.62-2.39 3.29V22H8.22V8z" /></svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2h3.35l-7.32 8.37L24 22h-6.75l-5.28-6.92L5.92 22H2.56l7.83-8.95L2 2h6.92l4.77 6.32L18.9 2z" /></svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 7 9-7" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </svg>
  ),
};

const socialIcons: Record<string, React.ReactNode> = {
  github: Icons.github,
  linkedin: Icons.linkedin,
  x: Icons.x,
  email: Icons.mail,
};

interface ActionRailProps {
  onToast: (msg: string) => void;
  onOpenSocials: () => void;
}

const ActionRail: React.FC<ActionRailProps> = ({ onToast, onOpenSocials }) => {
  const actions = [
    {
      icon: Icons.download,
      label: 'Download resume',
      onClick: () => {
        const a = document.createElement('a');
        a.href = '/resume.pdf';
        a.download = 'Shakil-Resume.pdf';
        a.click();
        onToast('resume downloading');
      },
    },
    {
      icon: Icons.socials,
      label: 'Find me online',
      onClick: onOpenSocials,
    },
    {
      icon: Icons.calendar,
      label: 'Book a call',
      onClick: () => window.open('https://cal.com/shakil-nee/30min', '_blank', 'noopener'),
    },
  ];

  return (
    <div className="action-rail" aria-label="actions">
      {actions.map((a, i) => (
        <button className="act" key={i} onClick={a.onClick} aria-label={a.label} title={a.label}>
          {a.icon}
        </button>
      ))}
    </div>
  );
};

interface SocialsSheetProps {
  open: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

const SocialsSheet: React.FC<SocialsSheetProps> = ({ open, onClose, onToast }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      onToast('link copied');
    } catch {
      onToast('copy failed');
    }
  };

  return (
    <>
      <div className={`sheet-scrim ${open ? 'on' : ''}`} onClick={onClose} aria-hidden={!open} />
      <div className={`sheet ${open ? 'open' : ''}`} role="dialog" aria-label="Find me on">
        <div className="sheet-grab" onClick={onClose}><span /></div>
        <div className="sheet-title">
          <span>Find me on</span>
          <button className="sheet-close" onClick={onClose} aria-label="Close">&#x2715;</button>
        </div>
        <div className="sheet-list">
          {SOCIALS.map(s => (
            <a
              key={s.id}
              href={s.href}
              target={s.href.startsWith('mailto') ? '_self' : '_blank'}
              rel="noreferrer"
              className="sheet-row"
            >
              <span className="sheet-ic">{socialIcons[s.id]}</span>
              <span className="sheet-text">
                <span className="sheet-lbl">{s.label}</span>
                <span className="sheet-hdl">{s.handle}</span>
              </span>
              <span className="sheet-arrow">&#x2197;</span>
            </a>
          ))}
          <button className="sheet-row sheet-row-btn" onClick={copyLink}>
            <span className="sheet-ic">{Icons.copy}</span>
            <span className="sheet-text">
              <span className="sheet-lbl">Share this page</span>
              <span className="sheet-hdl">Copy link to clipboard</span>
            </span>
            <span className="sheet-arrow">&#x2318;</span>
          </button>
        </div>
      </div>
    </>
  );
};

export { ActionRail, SocialsSheet };

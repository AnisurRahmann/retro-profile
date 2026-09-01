import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneFrame from '../Reel';
import { usePageMeta } from '../../lib/pageMeta';
import { GYM_DAYS } from '../../data/gym';
import type { GymDay } from '../../data/gym';

// Date.getDay(): 0 = Sunday … 6 = Saturday — GYM_DAYS is Monday-first
const JS_DAY_IDS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const todayDayId = () => JS_DAY_IDS[new Date().getDay()];

function resolveStartIndex(): number {
  const hash = window.location.hash.replace(/^#/, '').trim().toLowerCase();
  const byHash = GYM_DAYS.findIndex(d => d.id === hash);
  if (byHash !== -1) return byHash;
  const byToday = GYM_DAYS.findIndex(d => d.id === todayDayId());
  return byToday !== -1 ? byToday : 0;
}

const workingSets = (day: GymDay) =>
  day.exercises.reduce((total, ex) => {
    const match = /^(\d+)\s*[x×]/.exec(ex.prescription);
    return total + (match ? Number(match[1]) : 0);
  }, 0);

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface DayPanelProps {
  day: GymDay;
  idx: number;
  today: boolean;
  revealed: boolean;
  hint: 'on' | 'off' | null;
  panelRef: (el: HTMLElement | null) => void;
}

const DayPanel: React.FC<DayPanelProps> = ({ day, idx, today, revealed, hint, panelRef }) => {
  const label = day.rest
    ? `${day.weekday} — rest day`
    : `${day.weekday} — ${day.split}${day.emphasis ? ` ${day.emphasis}` : ''}`;

  return (
    <section
      ref={panelRef}
      data-idx={idx}
      id={day.id}
      className={`gym-panel ${day.rest ? 'gym-rest' : ''} ${revealed ? 'in' : ''}`}
      aria-labelledby={`${day.id}-title`}
      aria-label={label}
    >
      {day.photo && (
        <div
          className="gym-photo"
          style={{
            backgroundImage: `url(${day.photo})`,
            ...(day.photoDim !== undefined ? { '--dim': day.photoDim } : {}),
          } as React.CSSProperties}
          aria-hidden="true"
        />
      )}
      <div className="gym-col">
        <span className="gym-mark rv" style={{ '--i': 0 } as React.CSSProperties} aria-hidden="true">{day.num}</span>

        {hint && (
          <div className={`gym-hint ${hint === 'off' ? 'off' : ''}`} aria-hidden={hint === 'off'}>
            <span>swipe up</span>
            <svg width="10" height="12" viewBox="0 0 10 12" fill="none" aria-hidden="true">
              <path d="M5 1 L5 11 M1 5 L5 1 L9 5" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
          </div>
        )}

        <div className="gym-head rv" style={{ '--i': 0 } as React.CSSProperties}>
          <p className="eyebrow">Day {day.num} &middot; {day.weekday}</p>
          {today && (
            <span className="gym-today"><span className="dot" />today</span>
          )}
        </div>

        <h2 className="gym-title rv" id={`${day.id}-title`} style={{ '--i': 1 } as React.CSSProperties}>
          {day.rest ? <>Rest<em>.</em></> : <>{day.split}{day.emphasis && <> <em>{day.emphasis}</em></>}</>}
        </h2>

        {day.rest ? (
          <p className="gym-restline rv" style={{ '--i': 2 } as React.CSSProperties}>{day.restLine}</p>
        ) : (
          <>
            <p className="gym-meta rv" style={{ '--i': 2 } as React.CSSProperties}>
              <span>{day.exercises.length} exercises</span>
              <span>&middot;</span>
              <span>{workingSets(day)} working sets</span>
              <span>&middot;</span>
              <span>{day.duration}</span>
            </p>
            <ul className="gym-rows">
              {day.exercises.map((ex, i) => (
                <li
                  key={ex.name}
                  className="gym-row rv"
                  style={{ '--i': 3 + i } as React.CSSProperties}
                >
                  <span className="gym-ex-name">
                    {ex.name}
                    {ex.note && <span className="gym-ex-note">{ex.note}</span>}
                  </span>
                  <span className="gym-ex-sets">{ex.prescription}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
};

const GymPage: React.FC = () => {
  const navigate = useNavigate();
  const trackRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLElement | null)[]>([]);
  const hashRef = useRef<string | null>(null);

  // Resolved synchronously on first render + scrolled pre-paint below,
  // so there is no Monday flash and no layout shift.
  const [startIdx] = useState(resolveStartIndex);
  const [todayIdx] = useState(() => GYM_DAYS.findIndex(d => d.id === todayDayId()));
  const [active, setActive] = useState(startIdx);
  // The start panel is visible at mount — reveal it synchronously, never via IO.
  const [revealed, setRevealed] = useState<number[]>([startIdx]);
  const [interacted, setInteracted] = useState(false);

  // Instant jump to the start panel before first paint
  useLayoutEffect(() => {
    const el = panelRefs.current[startIdx];
    if (trackRef.current && el) trackRef.current.scrollTop = el.offsetTop;
  }, [startIdx]);

  // Single source of truth while scrolling: nearest panel drives the active
  // dot, the deep-link hash and the once-per-panel reveal. Scroll-position
  // math, not IntersectionObserver — deterministic even in throttled tabs.
  const syncFromScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientHeight === 0) return;
    const i = Math.max(0, Math.min(
      GYM_DAYS.length - 1,
      Math.round(track.scrollTop / track.clientHeight)
    ));
    setActive(prev => (prev === i ? prev : i));
    setRevealed(prev => (prev.includes(i) ? prev : [...prev, i]));
    const id = GYM_DAYS[i]?.id;
    if (id && id !== hashRef.current) {
      hashRef.current = id;
      window.history.replaceState(null, '', `/gym#${id}`);
    }
  }, []);

  useEffect(() => { syncFromScroll(); }, [syncFromScroll]);

  // Mark interacted on real user input only (not the programmatic jump above)
  const markInteracted = useCallback(() => setInteracted(true), []);

  const jump = useCallback((i: number) => {
    const el = panelRefs.current[i];
    if (!el) return;
    markInteracted();
    el.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [markInteracted]);

  // Keyboard: arrows / space / page up-down / home / end jump panels; escape exits
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
        return;
      }
      const el = e.target as HTMLElement | null;
      if (el && typeof el.closest === 'function' && el.closest('button, a, input, textarea, select')) return;

      const last = GYM_DAYS.length - 1;
      let target: number | null = null;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') target = Math.min(active + 1, last);
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') target = Math.max(active - 1, 0);
      else if (e.key === 'Home') target = 0;
      else if (e.key === 'End') target = last;
      if (target === null) return;
      e.preventDefault();
      jump(target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, jump, navigate]);

  // Page title, description and social preview for /gym
  usePageMeta('gym');

  return (
    <PhoneFrame label="SHAKIL · GYM · v1">
      <div className="gym-page">
      <header className="gym-top">
        <button className="gym-back" onClick={() => navigate('/')} aria-label="Back to home">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6-6" />
          </svg>
          back
        </button>
        <div className="gym-top-right">
          <span className="gym-path">~/gym</span>
          <button className="gym-home" onClick={() => navigate('/')} aria-label="Go to home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5 9.5V21h14V9.5" />
              <path d="M10 21v-6h4v6" />
            </svg>
          </button>
        </div>
      </header>

      <div
        className="gym-track"
        ref={trackRef}
        tabIndex={0}
        role="region"
        aria-label="Weekly training split, one day per screen"
        onScroll={syncFromScroll}
        onWheel={markInteracted}
        onTouchStart={markInteracted}
        onPointerDown={markInteracted}
      >
        {GYM_DAYS.map((day, i) => (
          <DayPanel
            key={day.id}
            day={day}
            idx={i}
            today={i === todayIdx}
            revealed={revealed.includes(i)}
            hint={i === 0 ? (interacted ? 'off' : 'on') : null}
            panelRef={el => { panelRefs.current[i] = el; }}
          />
        ))}
      </div>

      <nav className="gym-rail" aria-label="Jump to day">
        {GYM_DAYS.map((d, i) => (
          <button
            key={d.id}
            onClick={() => jump(i)}
            aria-label={`Jump to ${d.weekday}${i === todayIdx ? ' — today' : ''}`}
            aria-current={active === i}
          >
            <span className="gym-rail-lbl" aria-hidden="true">{d.weekday[0]}</span>
            <span className="gym-rail-dot" />
          </button>
        ))}
      </nav>

      <span className="gym-foot" aria-hidden="true">ar<span>.</span>shakil</span>
      </div>
    </PhoneFrame>
  );
};

export default GymPage;

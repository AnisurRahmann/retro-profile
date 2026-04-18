import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Blog } from '../../data/portfolio';

interface BlogViewerProps {
  blog: Blog;
  onClose: () => void;
}

const BlogViewer: React.FC<BlogViewerProps> = ({ blog, onClose }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const chRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const startY = useRef<number | null>(null);

  const jump = useCallback((i: number) => {
    const track = trackRef.current;
    const el = chRefs.current[i];
    if (!track || !el) return;
    track.scrollTop = el.offsetTop;
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (trackRef.current) trackRef.current.scrollTop = 0;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' || e.key === 'j') {
        const next = Math.min(active + 1, blog.chapters.length - 1);
        jump(next);
      }
      if (e.key === 'ArrowUp' || e.key === 'k') {
        if (active === 0) onClose();
        else jump(Math.max(active - 1, 0));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, blog.chapters.length, jump, onClose]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            setActive(Number((e.target as HTMLElement).dataset.idx));
          }
        });
      },
      { root: track, threshold: [0.6, 0.9] }
    );
    chRefs.current.forEach(el => { if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (active === 0 && dy > 80 && trackRef.current && trackRef.current.scrollTop < 10) onClose();
    startY.current = null;
  };

  return (
    <div
      className="blog-viewer"
      style={{ '--c1': blog.cover.c1, '--c2': blog.cover.c2 } as React.CSSProperties}
    >
      <div className="blog-viewer-top">
        <button className="bv-close" onClick={onClose} aria-label="Close blog">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
          <span>back</span>
        </button>
        <div className="bv-meta">
          <span>{blog.cat}</span>
          <span>&middot;</span>
          <span>{blog.date} {blog.year}</span>
        </div>
        <div className="bv-progress">
          {blog.chapters.map((_, i) => (
            <span key={i} className={`seg ${i <= active ? 'on' : ''}`} />
          ))}
        </div>
      </div>

      <div
        className="bv-track"
        ref={trackRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {blog.chapters.map((ch, i) => (
          <section
            key={i}
            ref={el => { chRefs.current[i] = el as HTMLDivElement; }}
            data-idx={i}
            className={`bv-chapter bv-${ch.kind} ${active === i ? 'active' : ''}`}
          >
            {ch.kind === 'title' && (
              <>
                <div className="bv-cover-bg" aria-hidden="true">
                  <span className="bv-glyph">{blog.cover.glyph}</span>
                </div>
                <div className="bv-ch-eyebrow">{ch.eyebrow}</div>
                <h2 className="bv-ch-title">{ch.title}</h2>
                <p className="bv-ch-sub">{ch.sub}</p>
                <div className="bv-ch-hint">swipe up to read &uarr;</div>
              </>
            )}
            {ch.kind === 'body' && (
              <>
                <div className="bv-ch-num">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="bv-ch-head">{ch.head}</h3>
                <p className="bv-ch-body">{ch.body}</p>
              </>
            )}
            {ch.kind === 'quote' && (
              <>
                <div className="bv-ch-mark">&ldquo;</div>
                <p className="bv-ch-quote">{ch.q}</p>
                {ch.by && <div className="bv-ch-by">{ch.by}</div>}
              </>
            )}
            {ch.kind === 'end' && (
              <>
                <div className="bv-ch-eyebrow">&mdash; end of post &mdash;</div>
                <h3 className="bv-ch-head">Thanks for reading.</h3>
                <div className="bv-ch-ctas">
                  {ch.cta && <a className="btn btn-primary" href={ch.href}>{ch.cta}</a>}
                  <button className="btn" onClick={onClose}>Back to blogs</button>
                </div>
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
};

export default BlogViewer;

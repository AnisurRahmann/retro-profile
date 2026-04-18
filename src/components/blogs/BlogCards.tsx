import React from 'react';
import { BLOGS } from '../../data/portfolio';

interface BlogCardsProps {
  onOpen: (index: number) => void;
}

const BlogCards: React.FC<BlogCardsProps> = ({ onOpen }) => (
  <>
    <div className="animate-in d1 eyebrow" style={{ marginTop: 20 }}>Activity</div>
    <h2 className="animate-in d2 h2" style={{ marginTop: 12 }}>
      What I&apos;m <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>building</em>, weekly.
    </h2>
    <p className="animate-in d3 lede" style={{ marginTop: 6 }}>
      Tap any card to dive in &mdash; each post opens as its own mini-reel. Swipe down to come back.
    </p>
    <div className="animate-in d4 blog-cards">
      {BLOGS.map((b, i) => (
        <button
          className="blog-card"
          key={b.id}
          onClick={() => onOpen(i)}
          style={{ '--c1': b.cover.c1, '--c2': b.cover.c2 } as React.CSSProperties}
        >
          <div className="blog-cover" aria-hidden="true">
            <span className="blog-glyph">{b.cover.glyph}</span>
            <span className="blog-date">
              <span className="d">{b.date}</span>
              <span className="y">{b.year}</span>
            </span>
          </div>
          <div className="blog-body">
            <div className="blog-meta">
              <span className="blog-cat">{b.cat}</span>
              <span>&middot;</span>
              <span>{b.read}</span>
            </div>
            <div className="blog-title">{b.title}</div>
            <div className="blog-excerpt">{b.excerpt}</div>
          </div>
          <span className="blog-open">&#x2197;</span>
        </button>
      ))}
    </div>
  </>
);

export default BlogCards;

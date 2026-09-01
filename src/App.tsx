import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PhoneFrame from './components/Reel';
import { ReelCounter, ReelFoot, RailNav } from './components/Reel/ReelChrome';
import { ActionRail, SocialsSheet } from './components/Reel/ActionRail';
import Toast from './components/Reel/Toast';
import Hero from './components/reels/Hero';
import Now from './components/reels/Now';
import Stats from './components/reels/Stats';
import Project from './components/reels/Project';
import Companies from './components/reels/Companies';
import Skills from './components/reels/Skills';
import Contact from './components/reels/Contact';
import About from './components/reels/About';
import Outro from './components/reels/Outro';
import BlogCards from './components/blogs/BlogCards';
import BlogViewer from './components/blogs/BlogViewer';
import GymPage from './components/gym/GymPage';
import { BLOGS } from './data/portfolio';
import type { Blog } from './data/portfolio';
import { usePageMeta, applyPageMeta, PAGES } from './lib/pageMeta';

interface ReelDef {
  id: string;
  label: string;
  className: string;
  render: (props: ReelRenderProps) => React.ReactNode;
}

interface ReelRenderProps {
  onOpenBlog: (index: number) => void;
  onRestart: () => void;
}

const REELS: ReelDef[] = [
  { id: 'hero', label: 'Intro', className: 'reel-hero', render: () => <Hero /> },
  { id: 'about', label: 'About', className: 'reel-about', render: () => <About /> },
  { id: 'now', label: 'Now', className: 'reel-now', render: () => <Now /> },
  { id: 'stats', label: 'Impact', className: 'reel-stats', render: () => <Stats /> },
  {
    id: 'p-plaid', label: 'Project', className: 'reel-project',
    render: () => <Project num="001" title="Plaid" italic="Optimizer" desc="Reduced Plaid bank connection costs 75% — from $100K to $25K monthly — through strategic funnel optimization. $900K annual savings." tags={['Python', 'FastAPI', 'Analytics']} />,
  },
  {
    id: 'p-seo', label: 'Project', className: 'reel-project',
    render: () => <Project num="002" title="AI" italic="SEO Engine" desc="AI system generating 2,500 SEO-optimized posts/hour with automated backlinking. $96K/yr saved, 40% conversion lift, $1M+ monthly GMV." tags={['AI/ML', 'Automation', 'SEO']} />,
  },
  {
    id: 'p-amazon', label: 'Project', className: 'reel-project',
    render: () => <Project num="003" title="Amazon" italic="Integration" desc="Integrated Zinc API enabling Amazon product sales on Gerald. $1M+ monthly order value with zero inventory risk." tags={['Zinc API', 'Integration', 'E-commerce']} />,
  },
  { id: 'cos', label: 'Companies', className: 'reel-companies', render: () => <Companies /> },
  { id: 'skills', label: 'Stack', className: 'reel-skills', render: () => <Skills /> },
  { id: 'blogs', label: 'Blogs', className: 'reel-blogs', render: ({ onOpenBlog }) => <BlogCards onOpen={onOpenBlog} /> },
  { id: 'contact', label: 'Contact', className: 'reel-contact', render: () => <Contact /> },
  { id: 'outro', label: 'Outro', className: 'reel-outro', render: ({ onRestart }) => <Outro onRestart={onRestart} /> },
];

function HomeReels() {
  const [active, setActive] = useState(0);
  const [blogViewerOpen, setBlogViewerOpen] = useState(false);
  const [blogIndex, setBlogIndex] = useState(0);
  const [socialsOpen, setSocialsOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  usePageMeta('home');

  // Blog overlay gets its own tab title/description; restore home meta on close
  useEffect(() => {
    const blog = BLOGS[blogIndex];
    if (blogViewerOpen && blog) {
      applyPageMeta({
        title: `${blog.title} | Shakil`,
        description: blog.excerpt,
        image: PAGES.home.image,
        path: '/',
      });
    } else {
      applyPageMeta(PAGES.home);
    }
  }, [blogViewerOpen, blogIndex]);

  const reelsRef = useRef<HTMLDivElement>(null);
  const reelRefs = useRef<(HTMLDivElement | null)[]>([]);

  // IntersectionObserver for active reel tracking
  useEffect(() => {
    const track = reelsRef.current;
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
    reelRefs.current.forEach(el => { if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);

  const jump = useCallback((i: number) => {
    const track = reelsRef.current;
    const el = reelRefs.current[i];
    if (!track || !el) return;
    track.scrollTop = el.offsetTop;
  }, []);

  const handleRestart = useCallback(() => {
    jump(0);
  }, [jump]);

  const handleOpenBlog = useCallback((index: number) => {
    setBlogIndex(index);
    setBlogViewerOpen(true);
  }, []);

  const handleCloseBlog = useCallback(() => {
    setBlogViewerOpen(false);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  const dismissToast = useCallback(() => {
    setToastMsg(null);
  }, []);

  // Set body data attributes for variant/transition
  useEffect(() => {
    document.body.setAttribute('data-variant', 'editorial');
    document.body.setAttribute('data-transition', 'slide');
  }, []);

  const renderProps: ReelRenderProps = {
    onOpenBlog: handleOpenBlog,
    onRestart: handleRestart,
  };

  return (
    <PhoneFrame>
      <div className="reels" ref={reelsRef}>
        {REELS.map((reel, i) => (
          <div
            key={reel.id}
            ref={el => { reelRefs.current[i] = el; }}
            data-idx={i}
            className={`reel ${reel.className} ${active === i ? 'active' : ''}`}
          >
            <ReelCounter index={i} total={REELS.length} label={reel.label} />
            {reel.render(renderProps)}
            <ReelFoot />
          </div>
        ))}
      </div>

      <RailNav count={REELS.length} active={active} onJump={jump} />
      <ActionRail onToast={showToast} onOpenSocials={() => setSocialsOpen(true)} />

      {socialsOpen && (
        <SocialsSheet
          open={socialsOpen}
          onClose={() => setSocialsOpen(false)}
          onToast={showToast}
        />
      )}

      {blogViewerOpen && BLOGS[blogIndex] && (
        <BlogViewer
          blog={BLOGS[blogIndex] as Blog}
          onClose={handleCloseBlog}
        />
      )}

      {toastMsg && <Toast msg={toastMsg} onDone={dismissToast} />}
    </PhoneFrame>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/gym" element={<GymPage />} />
        <Route path="*" element={<HomeReels />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

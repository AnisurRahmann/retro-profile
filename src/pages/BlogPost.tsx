import React, { useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { marked } from "marked";
import {
  getPostBySlug,
  getRelatedPosts,
  calculateReadTime,
  formatDate,
  isInsight,
  BlogPost as BlogPostType,
} from "../content/blog/posts";

// Configure marked for better output
marked.setOptions({
  gfm: true,
  breaks: true,
});

const BlogPost: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [activeHeading, setActiveHeading] = useState<string>("");
  const contentRef = useRef<HTMLDivElement>(null);

  const post = slug ? getPostBySlug(slug) : undefined;
  const isShortPost = post ? isInsight(post) : false;
  const relatedPosts = post ? getRelatedPosts(post.slug, post.category, 3) : [];

  // Extract headings for TOC
  const headings = post
    ? post.content
        .split("\n")
        .filter((line) => line.startsWith("## "))
        .map((line) => ({
          id: line
            .replace("## ", "")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^\w-]/g, ""),
          text: line.replace("## ", ""),
        }))
    : [];

  // Handle scroll to track active heading
  useEffect(() => {
    if (isShortPost || !contentRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveHeading(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -80% 0px" }
    );

    const h2Elements = contentRef.current.querySelectorAll("h2");
    h2Elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [isShortPost, post]);

  // Redirect to 404 if post not found
  useEffect(() => {
    if (slug && !post) {
      navigate("/404");
    }
  }, [slug, post, navigate]);

  if (!post) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareTwitter = () => {
    const text = encodeURIComponent(`${post.title} by @ar_shakil23`);
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank"
    );
  };

  const shareLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      "_blank"
    );
  };

  // Render markdown content with proper ID for headings
  const renderContent = () => {
    let html = marked(post.content) as string;

    // Add IDs to h2 elements for TOC navigation
    headings.forEach((heading) => {
      const regex = new RegExp(`<h2>${heading.text}</h2>`, "g");
      html = html.replace(regex, `<h2 id="${heading.id}">${heading.text}</h2>`);
    });

    return html;
  };

  // Short post layout (Insight)
  if (isShortPost) {
    return (
      <div className="min-h-screen">
        {/* Navigation */}
        <nav className="nav">
          <Link to="/" className="nav-logo">
            SHAKIL.
          </Link>
          <ul className="nav-links">
            <li>
              <Link to="/#now" className="nav-link">
                Bio
              </Link>
            </li>
            <li>
              <Link to="/#projects" className="nav-link">
                Projects
              </Link>
            </li>
            <li>
              <Link to="/blog" className="nav-link nav-link-active">
                Writing
              </Link>
            </li>
            <li>
              <Link to="/#about" className="nav-link">
                About
              </Link>
            </li>
            <li>
              <Link to="/#contact" className="nav-link">
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        <main className="insight-page">
          <Link to="/blog" className="back-link">
            <ArrowLeftIcon width={16} />
            <span>All posts</span>
          </Link>

          <article className="insight-article">
            <div className="insight-article-header">
              <span className="insight-article-category">{post.category}</span>
              <span className="insight-article-date">
                {formatDate(post.date)}
              </span>
            </div>
            <div className="insight-article-content">
              <p>{post.content}</p>
            </div>
            <div className="insight-article-tags">
              {post.tags.map((tag) => (
                <span key={tag} className="insight-article-tag">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Share Buttons */}
            <div className="share-buttons">
              <button onClick={copyLink} className="share-btn">
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button onClick={shareTwitter} className="share-btn">
                Share on X
              </button>
            </div>
          </article>

          {/* More Insights */}
          {relatedPosts.length > 0 && (
            <section className="more-insights">
              <h3 className="more-insights-title">More insights</h3>
              <div className="more-insights-grid">
                {relatedPosts.map((relatedPost) => (
                  <Link
                    key={relatedPost.slug}
                    to={`/blog/${relatedPost.slug}`}
                    className="more-insight-card"
                  >
                    <span className="more-insight-category">
                      {relatedPost.category}
                    </span>
                    <p className="more-insight-excerpt">
                      {relatedPost.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </main>

        <footer className="footer">
          <p>&copy; {new Date().getFullYear()} Shakil. All rights reserved.</p>
        </footer>
      </div>
    );
  }

  // Full article layout
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="nav">
        <Link to="/" className="nav-logo">
          SHAKIL.
        </Link>
        <ul className="nav-links">
          <li>
            <Link to="/#now" className="nav-link">
              Bio
            </Link>
          </li>
          <li>
            <Link to="/#projects" className="nav-link">
              Projects
            </Link>
          </li>
          <li>
            <Link to="/blog" className="nav-link nav-link-active">
              Writing
            </Link>
          </li>
          <li>
            <Link to="/#about" className="nav-link">
              About
            </Link>
          </li>
          <li>
            <Link to="/#contact" className="nav-link">
              Contact
            </Link>
          </li>
        </ul>
      </nav>

      <main className="article-page">
        <Link to="/blog" className="back-link">
          <ArrowLeftIcon width={16} />
          <span>All posts</span>
        </Link>

        <div className="article-layout">
          {/* Main Content */}
          <article className="article-content" ref={contentRef}>
            {/* Header */}
            <header className="article-header">
              <div className="article-header-meta">
                <span className="article-header-category">{post.category}</span>
                <span className="article-header-separator">·</span>
                <span className="article-header-date">
                  {formatDate(post.date)}
                </span>
                <span className="article-header-separator">·</span>
                <span className="article-header-readtime">
                  {calculateReadTime(post.content)} min read
                </span>
              </div>
              <h1 className="article-header-title">{post.title}</h1>
              <p className="article-header-excerpt">{post.excerpt}</p>
              <div className="article-header-tags">
                {post.tags.map((tag) => (
                  <span key={tag} className="article-header-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </header>

            {/* Cover Image */}
            {post.image && (
              <div className="article-cover">
                <img src={post.image} alt={post.title} />
              </div>
            )}

            {/* Article Body */}
            <div
              className="article-body prose"
              dangerouslySetInnerHTML={{ __html: renderContent() }}
            />

            {/* Footer */}
            <footer className="article-footer">
              {/* Share Buttons */}
              <div className="article-share">
                <span className="article-share-label">Share this article</span>
                <div className="article-share-buttons">
                  <button onClick={shareTwitter} className="article-share-btn">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Twitter
                  </button>
                  <button onClick={shareLinkedIn} className="article-share-btn">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </button>
                  <button onClick={copyLink} className="article-share-btn">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>
              </div>

              {/* Author Card */}
              <div className="author-card">
                <div className="author-avatar">S</div>
                <div className="author-info">
                  <h4 className="author-name">Shakil</h4>
                  <p className="author-bio">
                    AI Engineer building production systems at YC startups.
                    Passionate about LLMs, agents, and shipping code that works.
                  </p>
                  <Link to="/#about" className="author-link">
                    More about me →
                  </Link>
                </div>
              </div>
            </footer>

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
              <section className="related-posts">
                <h3 className="related-posts-title">Related articles</h3>
                <div className="related-posts-grid">
                  {relatedPosts.map((relatedPost) => (
                    <Link
                      key={relatedPost.slug}
                      to={`/blog/${relatedPost.slug}`}
                      className="related-post-card"
                    >
                      <span className="related-post-category">
                        {relatedPost.category}
                      </span>
                      <h4 className="related-post-title">
                        {relatedPost.title}
                      </h4>
                      <p className="related-post-excerpt">
                        {relatedPost.excerpt}
                      </p>
                      <span className="related-post-readtime">
                        {calculateReadTime(relatedPost.content)} min read
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* TOC Sidebar */}
          {headings.length > 0 && (
            <aside className="toc-sidebar">
              <div className="toc-sticky">
                <span className="toc-label">On this page</span>
                <nav className="toc-nav">
                  {headings.map((heading) => (
                    <a
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={`toc-link ${
                        activeHeading === heading.id ? "toc-link-active" : ""
                      }`}
                    >
                      {heading.text}
                    </a>
                  ))}
                </nav>
              </div>
            </aside>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Shakil. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default BlogPost;

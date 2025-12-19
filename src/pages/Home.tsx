import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRightIcon } from "@heroicons/react/24/outline";

const projects = [
  {
    number: "001",
    title: "Foxreach",
    description:
      "AI-powered outreach platform that helps founders connect with investors using intelligent matching and personalized messaging.",
    tags: ["AI/ML", "LLM", "Next.js", "Python"],
    link: "#",
  },
  {
    number: "002",
    title: "create-mvpkit",
    description:
      "CLI tool to scaffold production-ready MVP projects with AI integrations, authentication, and database setup in minutes.",
    tags: ["CLI", "TypeScript", "Templates"],
    link: "#",
  },
  {
    number: "003",
    title: "Tabsense",
    description:
      "Chrome extension using AI to intelligently organize, group, and manage browser tabs based on content and context.",
    tags: ["Chrome Extension", "AI", "React"],
    link: "#",
  },
  {
    number: "004",
    title: "YC Startup Work",
    description:
      "Built core backend systems and AI features for multiple Y Combinator-backed startups across fintech and edtech.",
    tags: ["Backend", "AI", "Startups"],
    link: "#",
  },
];

const nowItems = [
  {
    title: "Building AI Agents",
    description:
      "Developing autonomous agents that can reason, plan, and execute complex tasks using LLMs and tool orchestration.",
  },
  {
    title: "LLM Integration Patterns",
    description:
      "Exploring best practices for integrating large language models into production applications reliably.",
  },
  {
    title: "Open Source Tools",
    description:
      "Contributing to and building open source developer tools that make AI more accessible to engineers.",
  },
];

const writings = [
  {
    title: "Building Production-Ready AI Agents",
    date: "2024",
    link: "/blog/building-ai-agents-that-actually-ship",
    readTime: "8 min read",
    category: "ai-engineering",
    excerpt: "A deep dive into architecting autonomous agents that can reason, plan, and execute complex tasks reliably in production environments.",
    featured: true,
  },
  {
    title: "The Art of Prompt Engineering",
    date: "2024",
    link: "/blog/prompt-engineering-tips",
    readTime: "5 min read",
    category: "ai-engineering",
    excerpt: "Techniques and patterns for crafting effective prompts that consistently produce high-quality outputs from large language models.",
    featured: false,
  },
  {
    title: "From Backend to AI: A Developer's Journey",
    date: "2023",
    link: "/blog/from-backend-to-ai-engineering",
    readTime: "6 min read",
    category: "career",
    excerpt: "How I transitioned from traditional backend development to becoming an AI engineer, and lessons learned along the way.",
    featured: false,
  },
  {
    title: "Essential Dev Tools for AI Engineers",
    date: "2023",
    link: "/blog/vector-databases-compared",
    readTime: "4 min read",
    category: "dev-tools",
    excerpt: "A curated list of development tools and frameworks that every AI engineer should have in their toolkit.",
    featured: false,
  },
];

const stats = [
  { number: "5+", label: "Years Experience" },
  { number: "3", label: "YC Startups" },
  { number: "YC", label: "Backed Companies" },
  { number: "∞", label: "Curiosity" },
];

// Typing animation phrases
const typingPhrases = ["AI Engineer", "Builder", "Problem Solver"];

const Home: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  // Typing animation effect
  useEffect(() => {
    const currentPhrase = typingPhrases[currentPhraseIndex];
    const typeSpeed = isDeleting ? 50 : 100;
    const pauseTime = isDeleting ? 500 : 2000;

    if (!isDeleting && displayText === currentPhrase) {
      setTimeout(() => setIsDeleting(true), pauseTime);
      return;
    }

    if (isDeleting && displayText === "") {
      setIsDeleting(false);
      setCurrentPhraseIndex((prev) => (prev + 1) % typingPhrases.length);
      return;
    }

    const timeout = setTimeout(() => {
      setDisplayText((prev) =>
        isDeleting
          ? prev.slice(0, -1)
          : currentPhrase.slice(0, prev.length + 1)
      );
    }, typeSpeed);

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentPhraseIndex]);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText("hello@arshakil.com");
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy email");
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="nav">
        <Link to="/" className="nav-logo">
          SHAKIL.
        </Link>
        <ul className={`nav-links ${mobileMenuOpen ? "nav-links-open" : ""}`}>
          <li>
            <a href="#now" className="nav-link" onClick={closeMobileMenu}>
              Now
            </a>
          </li>
          <li>
            <a href="#projects" className="nav-link" onClick={closeMobileMenu}>
              Projects
            </a>
          </li>
          <li>
            <Link to="/blog" className="nav-link" onClick={closeMobileMenu}>
              Writing
            </Link>
          </li>
          <li>
            <a href="#about" className="nav-link" onClick={closeMobileMenu}>
              About
            </a>
          </li>
          <li>
            <a href="#contact" className="nav-link" onClick={closeMobileMenu}>
              Contact
            </a>
          </li>
        </ul>
        <button
          className={`hamburger ${mobileMenuOpen ? "hamburger-open" : ""}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={closeMobileMenu}></div>
      )}

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div>
            <div className="hero-label">
              <span className="typing-text">{displayText}</span>
              <span className="typing-cursor">|</span>
            </div>
            <h1 className="hero-title hero-title-gradient">
              I'm Shakil, an <span className="accent">AI Engineer</span>
              <br />& Builder
            </h1>
            <p className="hero-description">
              I build intelligent systems and AI-powered products. Currently
              focused on LLM integrations, agent development, and helping
              startups ship AI features that users love.
            </p>
            <div className="hero-buttons">
              <a href="#projects" className="btn btn-primary">
                View Projects
              </a>
              <a href="#contact" className="btn">
                Get in Touch
              </a>
            </div>
          </div>
          <div className="status">
            <div className="status-indicator">
              <span className="status-dot"></span>
              Available for work
            </div>
          </div>
        </div>
        {/* Scroll Indicator */}
        <div className="scroll-indicator">
          <span className="scroll-text">Scroll</span>
          <div className="scroll-chevron">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 13l5 5 5-5M7 6l5 5 5-5"/>
            </svg>
          </div>
        </div>
      </section>

      {/* Now Section */}
      <section id="now" className="section">
        <div className="section-header">
          <span className="section-badge">Now</span>
          <h2 className="section-title">What I'm Building</h2>
          <div className="section-line"></div>
        </div>
        <div className="now-grid">
          {nowItems.map((item, index) => (
            <div key={index} className="now-card">
              <h3 className="now-card-title">{item.title}</h3>
              <p className="now-card-description">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Projects Section */}
      <section id="projects" className="section">
        <div className="section-header">
          <span className="section-badge">Work</span>
          <h2 className="section-title">Selected Projects</h2>
          <div className="section-line"></div>
        </div>
        <div className="projects-grid">
          {projects.map((project) => (
            <a
              key={project.number}
              href={project.link}
              className="project-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <span className="project-number">{project.number}</span>
              <h3 className="project-title">{project.title}</h3>
              <p className="project-description">{project.description}</p>
              <div className="project-tags">
                {project.tags.map((tag) => (
                  <span key={tag} className="project-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <ArrowUpRightIcon className="project-arrow" width={20} />
            </a>
          ))}
        </div>
      </section>

      {/* Writing Section */}
      <section id="writing" className="section">
        <div className="section-header">
          <span className="section-badge">Blog</span>
          <h2 className="section-title">Writing</h2>
          <div className="section-line"></div>
        </div>
        <div className="writing-list">
          {writings.map((post, index) => (
            <Link
              key={index}
              to={post.link}
              className={`writing-item ${post.featured ? "writing-item-featured" : ""}`}
            >
              <div className="writing-main">
                <div className="writing-header">
                  <span className={`writing-category writing-category-${post.category}`}>
                    {post.category === "ai-engineering"
                      ? "AI Engineering"
                      : post.category === "career"
                      ? "Career"
                      : "Dev Tools"}
                  </span>
                  {post.featured && <span className="writing-featured-badge">Featured</span>}
                </div>
                <span className="writing-title">{post.title}</span>
                <span className="writing-excerpt">{post.excerpt}</span>
              </div>
              <div className="writing-meta">
                <span className="writing-read-time">{post.readTime}</span>
                <span className="writing-date">{post.date}</span>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link to="/blog" className="btn">
            View All Posts
          </Link>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="section">
        <div className="section-header">
          <span className="section-badge">About</span>
          <h2 className="section-title">Background</h2>
          <div className="section-line"></div>
        </div>
        <div className="about-grid">
          <div className="about-text">
            <p>
              Since 2015, I've been on an exciting journey in the world of
              coding, turning professional in 2017. Over the years, I've had
              the privilege of working with multiple Y Combinator-backed
              startups, building everything from fintech platforms to
              AI-powered educational tools.
            </p>
            <p>
              My expertise spans backend development, AI/ML integration, and
              building production systems that scale. I'm particularly
              passionate about LLM applications, agent development, and
              creating tools that make AI accessible to developers.
            </p>
            <p>
              I thrive on embracing challenges beyond routine responsibilities
              and am always eager to master new technologies. Currently seeking
              opportunities to push the boundaries of what's possible with AI.
            </p>
          </div>
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div key={index} className="stat">
                <div className="stat-number">{stat.number}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact">
        {/* Availability Status */}
        <div className="availability-status">
          <span className="availability-dot"></span>
          <span>Available for contracts & full-time roles</span>
        </div>

        <h2 className="contact-title">Let's Work Together</h2>
        <p className="contact-description">
          Have an interesting project or opportunity? I'd love to hear from you.
        </p>

        {/* Email with Copy Button */}
        <div className="email-wrapper">
          <a href="mailto:hello@arshakil.com" className="contact-email-large">
            hello@arshakil.com
          </a>
          <button
            className={`copy-button ${emailCopied ? "copy-button-success" : ""}`}
            onClick={copyEmail}
            aria-label="Copy email"
          >
            {emailCopied ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            )}
            <span className="copy-text">{emailCopied ? "Copied!" : "Copy"}</span>
          </button>
        </div>

        {/* Book a Call Button */}
        <a href="#" className="book-call-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Book a Call
        </a>

        {/* Contact Form */}
        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
          <h3 className="form-title">Send a Message</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name" className="form-label">Name</label>
              <input type="text" id="name" className="form-input" placeholder="Your name" />
            </div>
            <div className="form-group">
              <label htmlFor="email" className="form-label">Email</label>
              <input type="email" id="email" className="form-input" placeholder="your@email.com" />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="message" className="form-label">Message</label>
            <textarea id="message" className="form-textarea" placeholder="Your message..." rows={4}></textarea>
          </div>
          <button type="submit" className="btn btn-primary form-submit">
            Send Message
          </button>
        </form>

        {/* Social Links */}
        <div className="social-links-enhanced">
          <a
            href="https://github.com/arshakil"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link-enhanced"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span className="social-label">GitHub</span>
          </a>
          <a
            href="https://twitter.com/arshakil"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link-enhanced"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span className="social-label">Twitter</span>
          </a>
          <a
            href="https://linkedin.com/in/arshakil"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link-enhanced"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span className="social-label">LinkedIn</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Shakil. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Home;

import React from "react";
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
    link: "#",
  },
  {
    title: "The Art of Prompt Engineering",
    date: "2024",
    link: "#",
  },
  {
    title: "From Backend to AI: A Developer's Journey",
    date: "2023",
    link: "#",
  },
];

const stats = [
  { number: "5+", label: "Years Experience" },
  { number: "3", label: "YC Startups" },
  { number: "YC", label: "Backed Companies" },
  { number: "∞", label: "Curiosity" },
];

function App() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="nav">
        <a href="#" className="nav-logo">
          SHAKIL.
        </a>
        <ul className="nav-links">
          <li>
            <a href="#now" className="nav-link">
              Now
            </a>
          </li>
          <li>
            <a href="#projects" className="nav-link">
              Projects
            </a>
          </li>
          <li>
            <a href="#writing" className="nav-link">
              Writing
            </a>
          </li>
          <li>
            <a href="#about" className="nav-link">
              About
            </a>
          </li>
          <li>
            <a href="#contact" className="nav-link">
              Contact
            </a>
          </li>
        </ul>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <div>
            <div className="hero-label">AI Engineer</div>
            <h1 className="hero-title">
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
            <a key={index} href={post.link} className="writing-item">
              <span className="writing-title">{post.title}</span>
              <span className="writing-date">{post.date}</span>
            </a>
          ))}
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
        <h2 className="contact-title">Let's Work Together</h2>
        <p className="contact-description">
          Have an interesting project or opportunity? I'd love to hear from you.
        </p>
        <a href="mailto:hello@arshakil.com" className="contact-email">
          hello@arshakil.com
        </a>
        <div className="social-links">
          <a
            href="https://github.com/arshakil"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
          >
            GitHub
          </a>
          <a
            href="https://twitter.com/arshakil"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
          >
            Twitter
          </a>
          <a
            href="https://linkedin.com/in/arshakil"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
          >
            LinkedIn
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Shakil. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;

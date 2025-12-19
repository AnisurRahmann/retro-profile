import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import {
  blogPosts,
  getFeaturedPost,
  getInsights,
  getArticles,
  getCategories,
  getPostsByCategory,
  calculateReadTime,
  formatMonthYear,
  isInsight,
  BlogPost
} from '../content/blog/posts';

const BlogList: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [email, setEmail] = useState('');

  const categories = getCategories();
  const filteredPosts = getPostsByCategory(selectedCategory);
  const featuredPost = getFeaturedPost();

  // Filter insights and articles based on selected category
  const insights = filteredPosts.filter(post => isInsight(post));
  const articles = filteredPosts.filter(post => !isInsight(post) && !post.featured);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle subscription logic here
    alert('Thanks for subscribing!');
    setEmail('');
  };

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="nav">
        <Link to="/" className="nav-logo">
          SHAKIL.
        </Link>
        <ul className="nav-links">
          <li><Link to="/#now" className="nav-link">Bio</Link></li>
          <li><Link to="/#projects" className="nav-link">Projects</Link></li>
          <li><Link to="/blog" className="nav-link nav-link-active">Writing</Link></li>
          <li><Link to="/#about" className="nav-link">About</Link></li>
          <li><Link to="/#contact" className="nav-link">Contact</Link></li>
        </ul>
      </nav>

      {/* Hero Section */}
      <section className="blog-hero">
        <div className="blog-hero-content">
          <div className="blog-hero-label">
            <span>Writing</span>
          </div>
          <h1 className="blog-hero-title">
            Thoughts on <span className="accent-italic">AI</span>, building,
            <br />and shipping code that works.
          </h1>
          <p className="blog-hero-description">
            Technical deep-dives, build logs, and occasional hot takes from the trenches of AI engineering.
          </p>

          {/* Category Filters */}
          <div className="blog-filters">
            {categories.map(category => (
              <button
                key={category}
                className={`blog-filter-btn ${selectedCategory === category ? 'blog-filter-btn-active' : ''}`}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="blog-divider"></div>

      {/* Featured Post Section */}
      {featuredPost && selectedCategory === 'All' && (
        <section className="blog-section">
          <Link to={`/blog/${featuredPost.slug}`} className="featured-card">
            <div className="featured-card-badges">
              <span className="featured-badge">Featured</span>
              <span className="category-badge">{featuredPost.category}</span>
            </div>
            <h2 className="featured-card-title">{featuredPost.title}</h2>
            <p className="featured-card-excerpt">{featuredPost.excerpt}</p>
            <div className="featured-card-meta">
              <span className="featured-card-date">{formatMonthYear(featuredPost.date)}</span>
              <span className="featured-card-separator">·</span>
              <span className="featured-card-readtime">{calculateReadTime(featuredPost.content)} min read</span>
            </div>
          </Link>
        </section>
      )}

      {/* Quick Insights Section */}
      {insights.length > 0 && (
        <section className="blog-section">
          <div className="blog-section-header">
            <h2 className="blog-section-title">Quick Insights</h2>
            <span className="blog-section-count">{insights.length}</span>
          </div>
          <div className="insights-grid">
            {insights.map(post => (
              <InsightCard key={post.slug} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Articles Section */}
      {articles.length > 0 && (
        <section className="blog-section">
          <div className="blog-section-header">
            <h2 className="blog-section-title">Articles</h2>
            <span className="blog-section-count">{articles.length}</span>
          </div>
          <div className="articles-list">
            {articles.map((post, index) => (
              <ArticleRow key={post.slug} post={post} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* Newsletter Section */}
      <section className="newsletter-section">
        <div className="newsletter-content">
          <h2 className="newsletter-title">Stay in the loop</h2>
          <p className="newsletter-description">
            Get notified when I publish new articles and insights.
          </p>
          <form onSubmit={handleSubscribe} className="newsletter-form">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="newsletter-input"
              required
            />
            <button type="submit" className="newsletter-btn">
              Subscribe
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} Shakil. All rights reserved.</p>
      </footer>
    </div>
  );
};

// Insight Card Component
const InsightCard: React.FC<{ post: BlogPost }> = ({ post }) => {
  return (
    <Link to={`/blog/${post.slug}`} className="insight-card">
      <div className="insight-card-header">
        <span className="insight-category">{post.category}</span>
        <span className="insight-date">{formatMonthYear(post.date)}</span>
      </div>
      <p className="insight-content">{post.excerpt}</p>
      <div className="insight-tags">
        {post.tags.slice(0, 3).map(tag => (
          <span key={tag} className="insight-tag">#{tag}</span>
        ))}
      </div>
    </Link>
  );
};

// Article Row Component
const ArticleRow: React.FC<{ post: BlogPost; index: number }> = ({ post, index }) => {
  return (
    <Link to={`/blog/${post.slug}`} className="article-row">
      <span className="article-number">{String(index + 1).padStart(2, '0')}</span>
      <div className="article-main">
        <h3 className="article-title">{post.title}</h3>
        <p className="article-excerpt">{post.excerpt}</p>
      </div>
      <div className="article-meta">
        <span className="article-category">{post.category}</span>
        <span className="article-date">{formatMonthYear(post.date)}</span>
        <span className="article-readtime">{calculateReadTime(post.content)} min</span>
      </div>
      <ArrowRightIcon className="article-arrow" width={20} />
    </Link>
  );
};

export default BlogList;

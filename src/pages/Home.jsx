import React from 'react';
import { Link } from 'react-router-dom';
import FeatureCard from '../components/FeatureCard';
import LanguageCard from '../components/LanguageCard';
import supportedLanguages from '../data/languages';
import Icon from '../components/Icons';

/**
 * Home Page Component for CodeForge.
 * Features Hero, Core Capabilities, Supported Languages, Platform Stats, and Call to Action.
 */
export default function Home() {
  const features = [
    {
      title: 'Interactive Practice',
      icon: 'code',
      badge: 'Monaco Sandbox',
      description: 'Solve real-world algorithmic problems with multi-language starter code and instantaneous test evaluation.'
    },
    {
      title: 'Evidence-Based Learning',
      icon: 'book-open',
      badge: 'Diagnostic Loops',
      description: 'Benchmark foundational strengths and identify topic-level revision needs through structured assessments.'
    },
    {
      title: 'Performance Analytics',
      icon: 'chart',
      badge: 'Multi-Source',
      description: 'Track chronological score trajectory, topic mastery percentages, and verified attempt histories.'
    }
  ];

  const statistics = [
    {
      value: '50+',
      label: 'Curated Challenges',
      description: 'Carefully categorized by difficulty and core algorithmic patterns.'
    },
    {
      value: '10+',
      label: 'Computer Science Topics',
      description: 'Comprehensive coverage from data structures to systems and networks.'
    },
    {
      value: '100%',
      label: 'Fail-Closed Security',
      description: 'Strict Docker container isolation with zero untrusted host execution.'
    }
  ];

  return (
    <div className="home-page">
      {/* SECTION A — HERO */}
      <section className="hero-section py-5 bg-dark text-white border-bottom border-secondary position-relative">
        <div className="container py-lg-4">
          <div className="row align-items-center g-4 g-lg-5">
            <div className="col-lg-7 text-center text-lg-start">
              <div className="d-inline-flex align-items-center gap-2 px-3 py-1 mb-3 rounded-pill bg-primary bg-opacity-25 border border-primary border-opacity-50 text-primary-emphasis mw-100">
                <span className="badge bg-primary text-white rounded-pill px-2">v2.0</span>
                <span className="small fw-semibold text-info text-truncate">Developer Training &amp; Assessment Platform</span>
              </div>
              <h1 className="display-4 fw-black text-white lh-1 mb-3 text-uppercase tracking-tight">
                Master Programming.<br />
                <span className="text-primary">One Problem at a Time.</span>
              </h1>
              <p className="lead text-secondary mb-4 col-lg-11 fs-5">
                Practice coding problems in a secure environment. Test your core computer science knowledge.
                Track verified progress with longitudinal analytics.
              </p>
              <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center justify-content-lg-start">
                <Link
                  to="/practice"
                  className="btn btn-primary btn-lg px-4 py-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
                >
                  <span>Start Practicing</span>
                  <Icon name="arrow-right" size={18} />
                </Link>
                <Link
                  to="/quiz"
                  className="btn btn-outline-light btn-lg px-4 py-3 fw-semibold d-flex align-items-center justify-content-center gap-2"
                >
                  <Icon name="clipboard" size={18} />
                  <span>Take a Quiz</span>
                </Link>
              </div>
            </div>

            {/* Developer Code/Terminal Preview Mockup */}
            <div className="col-lg-5 d-none d-lg-block">
              <div className="card bg-black border border-secondary shadow-lg rounded-3 overflow-hidden">
                <div className="card-header bg-dark border-bottom border-secondary d-flex align-items-center justify-content-between py-2 px-3">
                  <div className="d-flex gap-2 align-items-center">
                    <span className="rounded-circle bg-danger d-inline-block" style={{ width: '10px', height: '10px' }}></span>
                    <span className="rounded-circle bg-warning d-inline-block" style={{ width: '10px', height: '10px' }}></span>
                    <span className="rounded-circle bg-success d-inline-block" style={{ width: '10px', height: '10px' }}></span>
                  </div>
                  <span className="text-secondary small font-monospace">twoSum.js</span>
                  <span className="badge bg-success-subtle text-success border border-success-subtle small font-monospace d-inline-flex align-items-center gap-1">
                    <Icon name="check" size={12} />
                    <span>Accepted</span>
                  </span>
                </div>
                <div className="card-body p-3 font-monospace small text-light bg-black lh-base">
                  <p className="mb-1 text-secondary">// Two Sum - Optimal O(n) Hash Map</p>
                  <p className="mb-1">
                    <span className="text-primary">function</span> <span className="text-warning">twoSum</span>(nums, target) &#123;
                  </p>
                  <p className="mb-1 ps-3">
                    <span className="text-primary">const</span> map = <span className="text-primary">new</span> <span className="text-info">Map</span>();
                  </p>
                  <p className="mb-1 ps-3">
                    <span className="text-primary">for</span> (<span className="text-primary">let</span> i = 0; i &lt; nums.length; i++) &#123;
                  </p>
                  <p className="mb-1 ps-4">
                    <span className="text-primary">const</span> complement = target - nums[i];
                  </p>
                  <p className="mb-1 ps-4">
                    <span className="text-primary">if</span> (map.<span className="text-info">has</span>(complement)) &#123;
                  </p>
                  <p className="mb-1 ps-5 text-success">
                    <span className="text-primary">return</span> [map.<span className="text-info">get</span>(complement), i];
                  </p>
                  <p className="mb-1 ps-4">&#125;</p>
                  <p className="mb-1 ps-4">map.<span className="text-info">set</span>(nums[i], i);</p>
                  <p className="mb-1 ps-3">&#125;</p>
                  <p className="mb-0">&#125;</p>
                </div>
                <div className="card-footer bg-dark border-top border-secondary py-2 px-3 d-flex justify-content-between text-secondary small font-monospace">
                  <span>Runtime: 48ms</span>
                  <span className="text-success fw-bold d-inline-flex align-items-center gap-1">
                    <Icon name="check-circle" size={14} />
                    <span>100% Test Cases Passed</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION B — FEATURES */}
      <section className="features-section py-5 bg-white border-bottom">
        <div className="container py-lg-4">
          <div className="text-center mb-5">
            <h2 className="display-6 fw-bold text-dark mb-2">Everything You Need to Improve</h2>
            <p className="text-secondary lead fs-6">
              A comprehensive toolkit engineered to develop intuition, rigor, and technical fluency.
            </p>
          </div>
          <div className="row g-4">
            {features.map((feature) => (
              <div key={feature.title} className="col-md-4">
                <FeatureCard
                  title={feature.title}
                  icon={feature.icon}
                  badge={feature.badge}
                  description={feature.description}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION C — PROGRAMMING LANGUAGES */}
      <section className="languages-section py-5 bg-light border-bottom">
        <div className="container py-lg-4">
          <div className="text-center mb-5">
            <h2 className="display-6 fw-bold text-dark mb-2">Practice Your Preferred Languages</h2>
            <p className="text-secondary lead fs-6">
              CodeForge supports industry-standard environments with Monaco Editor integration.
            </p>
          </div>
          <div className="row g-4 justify-content-center">
            {supportedLanguages.map((language) => (
              <div key={language.id} className="col-md-6 col-lg-4">
                <LanguageCard language={language} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION D — WHY CODEFORGE */}
      <section className="stats-section py-5 bg-white border-bottom">
        <div className="container py-lg-4">
          <div className="text-center mb-5">
            <h2 className="display-6 fw-bold text-dark mb-2">Why CodeForge</h2>
            <p className="text-secondary lead fs-6">
              Designed specifically for verified skill acquisition and academic demonstrations.
            </p>
          </div>
          <div className="row g-4 text-center">
            {statistics.map((stat) => (
              <div key={stat.label} className="col-md-4">
                <div className="card h-100 border shadow-sm p-3 stat-card">
                  <div className="card-body p-4">
                    <div className="display-4 fw-black text-primary mb-2 font-monospace">
                      {stat.value}
                    </div>
                    <h3 className="h5 fw-bold text-dark mb-2">{stat.label}</h3>
                    <p className="text-secondary small mb-0">{stat.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION E — CALL TO ACTION */}
      <section className="cta-section py-5 bg-dark text-white">
        <div className="container py-lg-4">
          <div className="row justify-content-center text-center">
            <div className="col-lg-8">
              <h2 className="display-5 fw-bold text-white mb-3">
                Ready to sharpen your programming skills?
              </h2>
              <p className="lead text-secondary mb-4 fs-5">
                Start solving problems, benchmark your knowledge, and build demonstrable confidence.
              </p>
              <div>
                <Link
                  to="/practice"
                  className="btn btn-primary btn-lg px-5 py-3 fw-bold shadow d-inline-flex align-items-center gap-2"
                >
                  <span>Start Practicing</span>
                  <Icon name="arrow-right" size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

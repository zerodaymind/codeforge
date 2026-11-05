import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Professional responsive Footer component for CodeForge.
 * Features platform description, quick navigation links, technology stack overview, and copyright.
 */
export default function Footer() {
  const quickLinks = [
    { name: 'Home', path: '/' },
    { name: 'Practice', path: '/practice' },
    { name: 'Quiz', path: '/quiz' },
    { name: 'Dashboard', path: '/dashboard' }
  ];

  const technologies = [
    'JavaScript',
    'React',
    'Bootstrap',
    'Node.js',
    'MongoDB'
  ];

  return (
    <footer className="bg-dark text-light pt-5 pb-4 mt-auto border-top border-secondary">
      <div className="container">
        <div className="row g-4">
          {/* Brand and Description */}
          <div className="col-lg-5 col-md-6">
            <h5 className="fw-bold mb-2 d-flex align-items-center gap-2">
              <img src="/favicon.svg" alt="CodeForge Logo" width="24" height="24" className="d-inline-block rounded-2" />
              <span><span className="text-white">Code</span><span className="text-primary">Forge</span></span>
            </h5>
            <p className="text-light-50 fw-semibold small mb-2 text-info">
              Programming Practice &amp; Assessment Platform
            </p>
            <p className="text-secondary small pe-lg-4 mb-3 lh-base">
              A comprehensive programming assessment environment designed to help developers master algorithms,
              evaluate core concepts, and track their technical journey.
            </p>
            <span className="badge bg-secondary-subtle text-light border border-secondary px-2.5 py-1.5 small font-monospace">
              Practice · Solve · Improve
            </span>
          </div>

          {/* Quick Links */}
          <div className="col-lg-3 col-md-6 col-6">
            <h6 className="text-uppercase fw-bold text-white mb-3 small tracking-wider">
              Quick Links
            </h6>
            <ul className="list-unstyled mb-0">
              {quickLinks.map((link) => (
                <li key={link.name} className="mb-2">
                  <Link
                    to={link.path}
                    className="text-secondary text-decoration-none small footer-link transition-all"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Technologies */}
          <div className="col-lg-4 col-md-12 col-6">
            <h6 className="text-uppercase fw-bold text-white mb-3 small tracking-wider">
              Technologies
            </h6>
            <div className="d-flex flex-wrap gap-2 mb-3">
              {technologies.map((tech) => (
                <span
                  key={tech}
                  className="badge bg-dark border border-secondary text-light py-1.5 px-2.5 fw-normal small font-monospace"
                >
                  {tech}
                </span>
              ))}
            </div>
            <p className="text-secondary small mb-0">
              Engineered with modern frontend components and robust architectural standards.
            </p>
          </div>
        </div>

        {/* Bottom Copyright */}
        <hr className="my-4 border-secondary opacity-50" />
        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center small text-secondary">
          <p className="mb-0">
            &copy; 2026 <strong>CodeForge</strong>. All rights reserved.
          </p>
          <p className="mb-0 mt-2 mt-sm-0 text-muted font-monospace">
            Practice. Solve. Improve.
          </p>
        </div>
      </div>
    </footer>
  );
}

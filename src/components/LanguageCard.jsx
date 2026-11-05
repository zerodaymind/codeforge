import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Reusable card displaying a supported programming language, its description, and a link to practice.
 */
export default function LanguageCard({ language }) {
  const { name, category, description, badge } = language;

  return (
    <div className="card h-100 border shadow-sm language-card transition-all">
      <div className="card-body p-4 d-flex flex-column">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h4 className="card-title fw-bold text-dark mb-0 fs-5">{name}</h4>
          {badge && (
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle small px-2 py-1">
              {badge}
            </span>
          )}
        </div>
        <p className="text-muted small fw-semibold mb-2">{category}</p>
        <p className="card-text text-secondary small mb-4 flex-grow-1 lh-base">
          {description}
        </p>
        <div>
          <Link
            to="/practice"
            className="btn btn-outline-primary btn-sm w-100 fw-semibold d-flex align-items-center justify-content-center gap-1.5 py-2"
          >
            <span>Practice {name}</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

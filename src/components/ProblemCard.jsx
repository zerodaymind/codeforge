import React from 'react';
import { Link } from 'react-router-dom';
import { getDifficultyBadgeClass } from '../utils/helpers';
import Icon from './Icons';

/**
 * Reusable ProblemCard displaying challenge metadata, difficulty, language, topic tags,
 * completion status badge for authenticated users, and navigation to the problem detail screen.
 */
export default function ProblemCard({ problem, isCompleted = false, isAuthenticated = false }) {
  const { title, description, language, difficulty } = problem;
  const slug = problem.slug || problem.id;
  const tagsToDisplay = (problem.tags && problem.tags.length > 0)
    ? problem.tags
    : (problem.topics || [problem.topic]).filter(Boolean);

  return (
    <div className={`card h-100 border shadow-sm problem-card transition-all ${isCompleted ? 'border-start border-success border-4' : ''}`}>
      <div className="card-body p-4 d-flex flex-column">
        {/* Header: Title and Badges */}
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <h5 className="card-title fw-bold text-dark mb-0 fs-5">{title}</h5>
          <div className="d-flex align-items-center gap-1 flex-wrap justify-content-end">
            {isAuthenticated ? (
              isCompleted ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small fw-semibold d-inline-flex align-items-center gap-1">
                  <Icon name="check" size={12} />
                  <span>Solved</span>
                </span>
              ) : (
                <span className="badge bg-light text-secondary border px-2 py-1 small fw-normal d-inline-flex align-items-center gap-1">
                  <span className="status-dot bg-secondary"></span>
                  <span>Unsolved</span>
                </span>
              )
            ) : null}
            <span className={`badge ${getDifficultyBadgeClass(difficulty)} px-2 py-1`}>
              {difficulty ? difficulty.toUpperCase() : 'EASY'}
            </span>
          </div>
        </div>

        {/* Short Description */}
        <p className="card-text text-secondary small mb-3 flex-grow-1 lh-base">
          {description}
        </p>

        {/* Language Badge */}
        {language && (
          <div className="mb-2">
            <span className="badge bg-body-secondary text-body border small font-monospace">
              {language}
            </span>
          </div>
        )}

        {/* Tags / Topic Badges */}
        <div className="d-flex flex-wrap gap-1 mb-4">
          {tagsToDisplay.map((tag) => (
            <span
              key={tag}
              className="badge bg-light text-secondary border small fw-normal"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* Navigation Action */}
        <div className="mt-auto">
          <Link
            to={`/practice/${slug}`}
            className={`btn ${isCompleted ? 'btn-outline-success' : 'btn-outline-primary'} btn-sm w-100 fw-semibold d-flex align-items-center justify-content-center gap-1.5 py-2`}
          >
            <span>{isCompleted ? 'Review Solution' : 'Solve Problem'}</span>
            <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

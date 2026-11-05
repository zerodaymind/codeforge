import React from 'react';

/**
 * Reusable ProgressBar component for the assessment experience.
 * Displays title, current question counter, percentage, and dynamic Bootstrap progress bar.
 */
export default function ProgressBar({ current, total, topic = 'JavaScript Fundamentals' }) {
  const percentage = Math.round((current / total) * 100);

  return (
    <div className="quiz-progress-wrapper mb-4">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <span className="badge bg-primary-subtle text-primary border border-primary-subtle small me-2">
            Assessment
          </span>
          <span className="fw-semibold text-dark">{topic}</span>
        </div>
        <span className="fw-bold text-secondary small">
          Question {current} of {total} ({percentage}%)
        </span>
      </div>

      <div
        className="progress"
        style={{ height: '8px' }}
        role="progressbar"
        aria-label="Quiz completion progress"
        aria-valuenow={percentage}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          className="progress-bar bg-primary progress-bar-striped progress-bar-animated transition-all"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

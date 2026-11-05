import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icons';

const STATE_CONFIG = {
  needs_revision: {
    label: 'Needs Revision',
    badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle',
    cardBorderClass: 'border-danger-subtle',
    icon: 'alert',
    priorityPrefix: 'Priority Gap'
  },
  promising: {
    label: 'Promising',
    badgeClass: 'bg-success-subtle text-success border border-success-subtle',
    cardBorderClass: 'border-success-subtle',
    icon: 'check-circle',
    priorityPrefix: 'Reinforce'
  },
  not_enough_evidence: {
    label: 'Limited Evidence',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    cardBorderClass: 'border-warning-subtle',
    icon: 'clock',
    priorityPrefix: 'Assess'
  },
  unassessed: {
    label: 'Unassessed',
    badgeClass: 'bg-secondary-subtle text-secondary border border-secondary-subtle',
    cardBorderClass: '',
    icon: 'circle',
    priorityPrefix: 'Explore'
  },
  not_started: {
    label: 'Not Started',
    badgeClass: 'bg-info-subtle text-info-emphasis border border-info-subtle',
    cardBorderClass: '',
    icon: 'code',
    priorityPrefix: 'Begin'
  }
};

const DIFFICULTY_BADGES = {
  Easy: 'bg-success-subtle text-success',
  Medium: 'bg-warning-subtle text-warning-emphasis',
  Hard: 'bg-danger-subtle text-danger'
};

/**
 * RevisionRoadmap Component (Milestone 15C)
 * Interactive, accessible revision roadmap presenting prioritized, evidence-based learning items.
 */
export default function RevisionRoadmap({
  roadmap,
  onRecalculate,
  onToggleComplete,
  isRecalculating = false
}) {
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  if (!roadmap) {
    return (
      <div className="card border shadow-sm p-4 text-center">
        <p className="text-secondary mb-0">No active roadmap found. Please configure your learning preferences.</p>
      </div>
    );
  }

  const recommendations = roadmap.recommendations || [];
  const stats = roadmap.stats || {
    totalItems: recommendations.length,
    completedItems: recommendations.filter((r) => r.isCompleted).length,
    needsRevisionCount: recommendations.filter((r) => r.state === 'needs_revision').length,
    promisingCount: recommendations.filter((r) => r.state === 'promising').length,
    pendingCount: recommendations.filter((r) => !r.isCompleted).length
  };

  const progressPercent = stats.totalItems > 0
    ? Math.round((stats.completedItems / stats.totalItems) * 100)
    : 0;

  // Filter items
  const filteredItems = recommendations.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return item.isCompleted;
    if (filter === 'pending') return !item.isCompleted;
    if (filter === 'needs_revision') return item.state === 'needs_revision';
    if (filter === 'promising') return item.state === 'promising';
    return true;
  });

  const handleToggle = async (item) => {
    if (!onToggleComplete) return;
    setUpdatingId(item.id);
    try {
      await onToggleComplete(item.id, !item.isCompleted);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="card border shadow-sm mb-5" data-testid="revision-roadmap">
      {/* 1. Header with Stats and Recalculate */}
      <div className="card-header bg-white border-bottom py-3 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <Icon name="map" size={20} className="text-primary" />
            <h2 className="h5 fw-bold text-dark mb-0">Adaptive Revision Roadmap</h2>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle small ms-1">
              Personalized Learning Plan
            </span>
          </div>
          <p className="text-secondary small mb-0">{roadmap.summary}</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-shrink-0">
          {onRecalculate && (
            <button
              type="button"
              className="btn btn-outline-primary btn-sm fw-semibold d-inline-flex align-items-center gap-1.5"
              onClick={onRecalculate}
              disabled={isRecalculating}
              aria-label="Recalculate revision roadmap"
            >
              {isRecalculating ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span>Recalculating...</span>
                </>
              ) : (
                <>
                  <Icon name="refresh" size={14} />
                  <span>Recalculate Roadmap</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Reassessment Feedback Banner (Milestone 15D) */}
      {roadmap.reassessmentComparison?.hasComparison && (
        <div className="bg-primary-subtle border-bottom px-4 py-2.5 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 small">
            <Icon name="refresh" size={14} className="text-primary" />
            <span className="fw-semibold text-primary-emphasis">
              Reassessment Evidence Integrated:
            </span>
            <span className="text-secondary">
              Overall delta {roadmap.reassessmentComparison.overallDeltaPercentage > 0 ? `+${roadmap.reassessmentComparison.overallDeltaPercentage}` : roadmap.reassessmentComparison.overallDeltaPercentage}% compared to prior baseline.
            </span>
          </div>
          <Link to="/roadmap" className="small fw-semibold text-primary text-decoration-none d-inline-flex align-items-center gap-1">
            <span>View Assessment Details</span>
            <Icon name="arrow-right" size={12} />
          </Link>
        </div>
      )}

      {/* 2. Progress Metric Bar */}
      <div className="card-body border-bottom bg-light bg-opacity-50 py-3 px-4">
        <div className="row g-3 align-items-center">
          <div className="col-12 col-md-6">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="small fw-semibold text-secondary">Roadmap Mastery Progress</span>
              <span className="small fw-bold text-primary font-monospace">{progressPercent}%</span>
            </div>
            <div className="progress" style={{ height: '8px' }}>
              <div
                className="progress-bar bg-primary"
                role="progressbar"
                style={{ width: `${progressPercent}%` }}
                aria-valuenow={progressPercent}
                aria-valuemin="0"
                aria-valuemax="100"
              ></div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="d-flex justify-content-md-end gap-2 flex-wrap">
              <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 small d-inline-flex align-items-center gap-1">
                <span className="status-dot bg-danger"></span>
                <span>{stats.needsRevisionCount} Needs Revision</span>
              </span>
              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 small d-inline-flex align-items-center gap-1">
                <span className="status-dot bg-success"></span>
                <span>{stats.promisingCount} Promising</span>
              </span>
              <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-1 small d-inline-flex align-items-center gap-1">
                <Icon name="check" size={12} />
                <span>{stats.completedItems} / {stats.totalItems} Done</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Navigation Tabs */}
      <div className="card-body border-bottom py-2 px-4 bg-white">
        <ul className="nav nav-pills gap-1 small" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link py-1 px-3 fw-semibold ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({recommendations.length})
            </button>
          </li>
          {stats.needsRevisionCount > 0 && (
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link py-1 px-3 fw-semibold ${filter === 'needs_revision' ? 'active' : ''}`}
                onClick={() => setFilter('needs_revision')}
              >
                Needs Revision ({stats.needsRevisionCount})
              </button>
            </li>
          )}
          {stats.promisingCount > 0 && (
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`nav-link py-1 px-3 fw-semibold ${filter === 'promising' ? 'active' : ''}`}
                onClick={() => setFilter('promising')}
              >
                Promising ({stats.promisingCount})
              </button>
            </li>
          )}
          <li className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link py-1 px-3 fw-semibold ${filter === 'pending' ? 'active' : ''}`}
              onClick={() => setFilter('pending')}
            >
              Pending ({stats.pendingCount})
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link py-1 px-3 fw-semibold ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Completed ({stats.completedItems})
            </button>
          </li>
        </ul>
      </div>

      {/* 4. Recommendation Cards List */}
      <div className="card-body p-4">
        {filteredItems.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-secondary mb-0">No recommendations match the selected filter.</p>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {filteredItems.map((item) => {
              const stateCfg = STATE_CONFIG[item.state] || STATE_CONFIG.not_started;
              const diffBadge = DIFFICULTY_BADGES[item.difficulty] || 'bg-light text-secondary';
              const isUpdating = updatingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`card border shadow-sm transition-all ${
                    item.isCompleted ? 'bg-light bg-opacity-40 border-success-subtle' : stateCfg.cardBorderClass
                  }`}
                  data-testid={`roadmap-item-${item.id}`}
                >
                  <div className="card-body p-3 p-md-4">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                      {/* Left: Priority, Title, Details */}
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                          <span className="badge bg-dark text-white font-monospace small px-2 py-1">
                            #{item.priority}
                          </span>
                          <span className={`badge ${stateCfg.badgeClass} px-2.5 py-1 small fw-semibold d-inline-flex align-items-center gap-1`}>
                            <Icon name={stateCfg.icon} size={12} />
                            <span>{stateCfg.label}</span>
                          </span>
                          <span className={`badge ${diffBadge} border px-2 py-0.5 small`}>
                            {item.difficulty}
                          </span>
                          <span className="badge bg-light text-dark border px-2 py-0.5 small text-uppercase">
                            {item.resourceType}
                          </span>
                          {item.isCompleted && (
                            <span className="badge bg-success text-white px-2 py-0.5 small d-inline-flex align-items-center gap-1">
                              <Icon name="check" size={12} />
                              <span>Completed</span>
                            </span>
                          )}
                        </div>

                        <h3 className={`h6 fw-bold mb-1 ${item.isCompleted ? 'text-decoration-line-through text-secondary' : 'text-dark'}`}>
                          {item.title}
                        </h3>

                        <p className="text-secondary small mb-2">{item.reason}</p>

                        {/* Evidence & Sample Details */}
                        {item.evidenceSummary && item.evidenceSummary.note && (
                          <div className="small text-muted fst-italic mb-1">
                            Evidence: {item.evidenceSummary.note}
                          </div>
                        )}

                        {/* Reassessment Status (Milestone 15D) */}
                        {item.reassessmentSummary && (
                          <div className="mt-1 small d-flex align-items-center gap-2 flex-wrap">
                            <span className={`badge ${
                              item.reassessmentSummary.status === 'encouraging_progress'
                                ? 'bg-success text-white'
                                : item.reassessmentSummary.status === 'further_revision_recommended'
                                ? 'bg-warning text-dark'
                                : 'bg-secondary text-white'
                            } px-2 py-0.5`}>
                              Reassessment: {item.reassessmentSummary.label}
                              {item.reassessmentSummary.deltaPercentage !== null && ` (${item.reassessmentSummary.deltaPercentage > 0 ? '+' : ''}${item.reassessmentSummary.deltaPercentage}%)`}
                            </span>
                            {item.reassessmentSummary.interpretation && (
                              <span className="text-secondary small">{item.reassessmentSummary.interpretation}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 flex-shrink-0 w-100 w-md-auto">
                        <Link
                          to={item.destinationUrl}
                          className={`btn btn-sm fw-semibold text-nowrap d-inline-flex align-items-center justify-content-center gap-1 ${
                            item.state === 'needs_revision'
                              ? 'btn-danger'
                              : item.state === 'promising'
                              ? 'btn-success'
                              : 'btn-primary'
                          }`}
                        >
                          <span>
                            {item.actionType === 'review'
                              ? 'Revise Now'
                              : item.actionType === 'advance'
                              ? 'Solve Challenge'
                              : item.actionType === 'quiz'
                              ? 'Take Quiz'
                              : item.actionType === 'diagnose'
                              ? 'Take Diagnostic'
                              : 'Start Practice'}
                          </span>
                          <Icon name="arrow-right" size={14} />
                        </Link>

                        <button
                          type="button"
                          className={`btn btn-sm text-nowrap ${
                            item.isCompleted ? 'btn-outline-success' : 'btn-outline-secondary'
                          }`}
                          onClick={() => handleToggle(item)}
                          disabled={isUpdating}
                          aria-label={item.isCompleted ? `Mark ${item.title} as incomplete` : `Mark ${item.title} as completed`}
                        >
                          {isUpdating ? (
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          ) : item.isCompleted ? (
                            '✓ Done'
                          ) : (
                            'Mark Done'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

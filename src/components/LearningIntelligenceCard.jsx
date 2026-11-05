import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icons';

const STATE_CONFIG = {
  mastered: {
    label: 'Mastered',
    badgeClass: 'bg-success text-white',
    subtleBadge: 'bg-success-subtle text-success border border-success-subtle',
    icon: 'award',
    description: 'High accuracy across multiple problem sets including Medium/Hard challenges'
  },
  proficient: {
    label: 'Proficient',
    badgeClass: 'bg-primary text-white',
    subtleBadge: 'bg-primary-subtle text-primary border border-primary-subtle',
    icon: 'check-circle',
    description: 'Solid conceptual understanding and reliable problem-solving'
  },
  developing: {
    label: 'Developing',
    badgeClass: 'bg-info text-dark',
    subtleBadge: 'bg-info-subtle text-info-emphasis border border-info-subtle',
    icon: 'chart',
    description: 'Partial competence demonstrated; ongoing practice will solidify proficiency'
  },
  struggling: {
    label: 'Foundational Gap',
    badgeClass: 'bg-danger text-white',
    subtleBadge: 'bg-danger-subtle text-danger border border-danger-subtle',
    icon: 'alert',
    description: 'Observed accuracy indicates prerequisite concepts require revision'
  },
  insufficient_evidence: {
    label: 'Sparse Evidence',
    badgeClass: 'bg-warning text-dark',
    subtleBadge: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    icon: 'search',
    description: 'Sample size is too small (<2 items) to draw confident conclusions'
  },
  unassessed: {
    label: 'Unassessed',
    badgeClass: 'bg-secondary text-white',
    subtleBadge: 'bg-secondary-subtle text-secondary border border-secondary-subtle',
    icon: 'circle',
    description: 'No diagnostic, quiz, or code submission records exist yet'
  }
};

const CONFIDENCE_BADGES = {
  high: 'bg-success-subtle text-success',
  moderate: 'bg-primary-subtle text-primary',
  low: 'bg-warning-subtle text-warning-emphasis',
  none: 'bg-secondary-subtle text-secondary'
};

const DIFFICULTY_BADGES = {
  Easy: 'bg-success-subtle text-success',
  Medium: 'bg-warning-subtle text-warning-emphasis',
  Hard: 'bg-danger-subtle text-danger'
};

/**
 * LearningIntelligenceCard Component (Milestone 16A)
 *
 * Visualizes the authenticated learner's synthesized topic-level intelligence,
 * explainable state rationale, confidence ratings, and catalog-grounded next actions.
 */
export default function LearningIntelligenceCard({
  intelligence,
  recommendationsPlan,
  onRefresh,
  isRefreshing = false
}) {
  const [filter, setFilter] = useState('all');
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [showLimitations, setShowLimitations] = useState(false);

  if (!intelligence || !intelligence.topicStates) {
    return (
      <div className="card border-0 shadow-sm p-4 text-center">
        <p className="text-secondary mb-0">Learning Intelligence profile is not yet available.</p>
      </div>
    );
  }

  const { overview, topicStates, limitations = [] } = intelligence;
  const topRec = recommendationsPlan?.topRecommendation;

  const filteredTopics = topicStates.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'attention') {
      return t.state === 'struggling' || t.state === 'insufficient_evidence' || t.state === 'developing';
    }
    if (filter === 'proficient') {
      return t.state === 'proficient' || t.state === 'mastered';
    }
    return t.state === filter;
  });

  return (
    <div className="card border shadow-sm mb-4">
      {/* Card Header */}
      <div className="card-header bg-transparent border-bottom py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <Icon name="brain" size={20} className="text-primary" />
            <h5 className="mb-0 fw-semibold text-dark">Learning Insights</h5>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
              Personalized Insights
            </span>
          </div>
          <small className="text-secondary">
            Multi-source evidence synthesis across diagnostics, practice code, and quizzes.
          </small>
        </div>
        {onRefresh && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1.5"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Evaluating...</span>
              </>
            ) : (
              <>
                <Icon name="refresh" size={14} />
                <span>Refresh Insights</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="card-body p-4">
        {/* Top Metric Bar */}
        <div className="row g-3 mb-4">
          <div className="col-12 col-sm-6 col-md-3">
            <div className="p-3 bg-body-tertiary rounded-3 border h-100">
              <span className="text-secondary small fw-medium d-block">Overall Mastery</span>
              <div className="fs-3 fw-bold text-primary mt-1 font-monospace">
                {overview.overallMasteryScore !== null ? `${overview.overallMasteryScore}%` : 'N/A'}
              </div>
              <small className="text-secondary">
                Across {overview.evaluatedTopicsCount} evaluated topic{overview.evaluatedTopicsCount === 1 ? '' : 's'}
              </small>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-md-3">
            <div className="p-3 bg-body-tertiary rounded-3 border h-100">
              <span className="text-secondary small fw-medium d-block">Evaluated Topics</span>
              <div className="fs-3 fw-bold text-dark mt-1 font-monospace">
                {overview.evaluatedTopicsCount}
                <span className="fs-6 fw-normal text-secondary ms-1">/ {overview.totalKnownTopics}</span>
              </div>
              <small className="text-secondary">
                {overview.totalKnownTopics - overview.evaluatedTopicsCount} unassessed
              </small>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-md-3">
            <div className="p-3 bg-body-tertiary rounded-3 border h-100">
              <span className="text-secondary small fw-medium d-block">Needs Attention</span>
              <div className="fs-3 fw-bold text-danger mt-1 font-monospace">
                {overview.topicsNeedingAttention?.length || 0}
              </div>
              <small className="text-secondary">
                {overview.countsByState?.struggling || 0} gaps, {overview.countsByState?.insufficient_evidence || 0} sparse
              </small>
            </div>
          </div>

          <div className="col-12 col-sm-6 col-md-3">
            <div className="p-3 bg-body-tertiary rounded-3 border h-100">
              <span className="text-secondary small fw-medium d-block">Strong Topics</span>
              <div className="fs-3 fw-bold text-success mt-1 font-monospace">
                {overview.strongestTopics?.length || 0}
              </div>
              <small className="text-secondary">
                {overview.countsByState?.mastered || 0} mastered, {overview.countsByState?.proficient || 0} proficient
              </small>
            </div>
          </div>
        </div>

        {/* Explainable Top Recommendation Spotlight */}
        {topRec && (
          <div className="p-3 p-md-4 rounded-3 border border-primary-subtle bg-primary-subtle bg-opacity-10 mb-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary text-white">Recommended Next Action</span>
                <span className={`badge ${DIFFICULTY_BADGES[topRec.difficulty] || 'bg-secondary'}`}>
                  {topRec.difficulty}
                </span>
                <span className="badge bg-light text-dark border">
                  {topRec.topic}
                </span>
              </div>
              <small className="text-secondary font-monospace">Top Recommended Step</small>
            </div>

            <h5 className="fw-bold mb-2 text-dark">{topRec.title}</h5>
            <p className="text-body small mb-3">{topRec.reason}</p>

            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pt-2 border-top border-primary-subtle">
              <div className="d-flex align-items-center gap-2 small text-secondary">
                <span>Evidence basis:</span>
                <span className="fw-semibold text-body">
                  {topRec.evidenceBasis?.sampleSize} items evaluated
                </span>
                <span>•</span>
                <span className="fw-semibold text-body">
                  {topRec.evidenceBasis?.confidence} confidence
                </span>
              </div>
              {topRec.resource?.url && (
                <Link to={topRec.resource.url} className="btn btn-primary btn-sm px-3 fw-medium d-inline-flex align-items-center gap-1">
                  <span>Take Action</span>
                  <Icon name="arrow-right" size={14} />
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Filter Tabs for Topics */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div className="btn-group btn-group-sm" role="group" aria-label="Topic filter">
            <button
              type="button"
              className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilter('all')}
            >
              All Topics ({topicStates.length})
            </button>
            <button
              type="button"
              className={`btn ${filter === 'attention' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilter('attention')}
            >
              Needs Attention ({overview.topicsNeedingAttention?.length || 0})
            </button>
            <button
              type="button"
              className={`btn ${filter === 'proficient' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilter('proficient')}
            >
              Proficient / Mastered ({overview.strongestTopics?.length || 0})
            </button>
          </div>
          <small className="text-secondary">
            Showing {filteredTopics.length} of {topicStates.length} topics
          </small>
        </div>

        {/* Topics List with Explainable Rationale */}
        <div className="list-group list-group-flush border rounded-3 overflow-hidden">
          {filteredTopics.map((item) => {
            const config = STATE_CONFIG[item.state] || STATE_CONFIG.unassessed;
            const isExpanded = expandedTopic === item.topic;

            return (
              <div key={item.topic} className="list-group-item p-3">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="d-inline-flex align-items-center justify-content-center p-1 rounded bg-body-tertiary">
                      <Icon name={config.icon} size={16} />
                    </span>
                    <span className="fw-bold text-dark">{item.topic}</span>
                    <span className={`badge ${config.subtleBadge}`}>
                      {config.label}
                    </span>
                    {item.isGoalAligned && (
                      <span className="badge bg-secondary-subtle text-secondary border small">
                        Goal Focus
                      </span>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-3">
                    <div className="text-end small">
                      <div className="fw-semibold text-dark">
                        {item.masteryScore !== null ? `${item.masteryScore}% Mastery` : 'Unassessed'}
                      </div>
                      <div className="text-secondary d-flex align-items-center justify-content-end gap-1 mt-1">
                        <span>{item.sampleSize} item{item.sampleSize === 1 ? '' : 's'}</span>
                        <span>•</span>
                        <span className={`badge ${CONFIDENCE_BADGES[item.confidence] || 'bg-secondary'} small`}>
                          {item.confidence}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setExpandedTopic(isExpanded ? null : item.topic)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? 'Hide' : 'Details'}
                    </button>
                  </div>
                </div>

                {/* Always-visible brief rationale */}
                <p className="text-secondary small mt-2 mb-0">
                  {item.rationale}
                </p>

                {/* Collapsible Deep Breakdown */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-top bg-body-tertiary p-3 rounded-2">
                    <div className="row g-2 small mb-2">
                      <div className="col-12 col-md-4">
                        <span className="fw-medium text-secondary">Diagnostic Accuracy:</span>{' '}
                        {item.evidenceBreakdown?.diagnostic?.accuracy !== null && item.evidenceBreakdown?.diagnostic?.accuracy !== undefined
                          ? `${item.evidenceBreakdown.diagnostic.accuracy}% (${item.evidenceBreakdown.diagnostic.correct}/${item.evidenceBreakdown.diagnostic.count})`
                          : 'Not assessed'}
                      </div>
                      <div className="col-12 col-md-4">
                        <span className="fw-medium text-secondary">Practice Problems:</span>{' '}
                        {item.distinctProblemsSolved} solved / {item.distinctProblemsAttempted} attempted
                        ({item.evidenceBreakdown?.practice?.totalSubmissions || 0} submissions)
                      </div>
                      <div className="col-12 col-md-4">
                        <span className="fw-medium text-secondary">Quizzes Passed:</span>{' '}
                        {item.quizPassCount} passed / {item.evidenceBreakdown?.quiz?.attempts || 0} attempted
                      </div>
                    </div>

                    <div className="row g-2 small mb-2">
                      <div className="col-12 col-md-6">
                        <span className="fw-medium text-secondary">Difficulty Solved:</span>{' '}
                        Easy: {item.evidenceBreakdown?.practice?.solvedDifficulty?.Easy || 0}, Medium:{' '}
                        {item.evidenceBreakdown?.practice?.solvedDifficulty?.Medium || 0}, Hard:{' '}
                        {item.evidenceBreakdown?.practice?.solvedDifficulty?.Hard || 0}
                      </div>
                      <div className="col-12 col-md-6">
                        <span className="fw-medium text-secondary">Freshness Index:</span>{' '}
                        <span className="badge bg-light text-dark border">
                          {Math.round(item.freshnessScore * 100)}%
                        </span>
                      </div>
                    </div>

                    {item.limitations && item.limitations.length > 0 && (
                      <div className="alert alert-warning py-1 px-2 small mb-0 mt-2">
                        <span className="fw-semibold">Limitations: </span>
                        {item.limitations.join(' ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Transparent Measurement Limitations Footer */}
        <div className="mt-4 pt-3 border-top">
          <button
            type="button"
            className="btn btn-link btn-sm text-secondary p-0 text-decoration-none d-flex align-items-center gap-1.5"
            onClick={() => setShowLimitations(!showLimitations)}
          >
            <Icon name="help-circle" size={14} />
            <span>{showLimitations ? 'Hide' : 'View'} Measurement Methodology &amp; Limitations</span>
          </button>

          {showLimitations && (
            <div className="alert alert-secondary mt-2 mb-0 small">
              <h6 className="alert-heading fw-bold small mb-2">Measurement Methodology:</h6>
              <ul className="mb-0 ps-3">
                {limitations.map((lim, idx) => (
                  <li key={idx} className="mb-1">{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

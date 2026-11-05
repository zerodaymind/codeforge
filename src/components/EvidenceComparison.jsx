import React from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icons';

/**
 * Status styling configurations for diagnostic comparisons.
 */
const COMPARISON_STATUS_CONFIG = {
  encouraging_progress: {
    label: 'Encouraging Progress',
    badgeClass: 'bg-success text-white',
    iconName: 'chart',
    cardBorder: 'border-success-subtle'
  },
  further_revision_recommended: {
    label: 'Further Revision Recommended',
    badgeClass: 'bg-warning text-dark',
    iconName: 'alert-triangle',
    cardBorder: 'border-warning-subtle'
  },
  performance_stable: {
    label: 'Performance Stable',
    badgeClass: 'bg-info text-dark',
    iconName: 'arrow-right',
    cardBorder: 'border-info-subtle'
  },
  insufficient_sample: {
    label: 'Sample Size Too Small',
    badgeClass: 'bg-secondary text-white',
    iconName: 'search',
    cardBorder: 'border-secondary-subtle'
  },
  first_assessment: {
    label: 'First Assessment',
    badgeClass: 'bg-primary text-white',
    iconName: 'target',
    cardBorder: 'border-primary-subtle'
  },
  not_reassessed: {
    label: 'Not Reassessed',
    badgeClass: 'bg-light text-secondary border',
    iconName: 'clock',
    cardBorder: ''
  }
};

/**
 * EvidenceComparison Component (Milestone 15D)
 *
 * Side-by-side diagnostic assessment comparison card displaying:
 * - Overall percentage-point delta between previous and current sessions.
 * - Granular topic-by-topic comparison with sample sizes and question overlap disclosures.
 * - Conservative classifications (encouraging_progress, further_revision_recommended, etc.).
 * - Honest limitations banner (prompt variation, sample sizes, non-causal disclosures).
 */
export default function EvidenceComparison({ comparison, isLoading = false, onRefresh }) {
  if (isLoading) {
    return (
      <div className="card border-0 shadow-sm p-4 text-center">
        <div className="spinner-border text-primary mx-auto mb-2" role="status">
          <span className="visually-hidden">Loading diagnostic comparison...</span>
        </div>
        <p className="text-secondary small mb-0">Analyzing diagnostic reassessment evidence...</p>
      </div>
    );
  }

  if (!comparison) {
    return null;
  }

  // Handle single assessment or no assessments state
  if (!comparison.hasComparison) {
    return (
      <div className="card border shadow-sm p-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <Icon name="chart" size={20} className="text-primary" />
            <div>
              <h3 className="h6 fw-bold mb-0 text-dark">Diagnostic Reassessment Baseline</h3>
              <p className="small text-secondary mb-0">Longitudinal Evidence Tracker</p>
            </div>
          </div>
          <Link to="/diagnostic" className="btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-1.5">
            <span>Take Reassessment</span>
            <Icon name="brain" size={14} />
          </Link>
        </div>

        <div className="alert alert-info py-2 px-3 small d-flex align-items-center gap-2 mb-3">
          <Icon name="alert-triangle" size={14} className="flex-shrink-0 text-info" />
          <div>
            {comparison.message || 'Complete two diagnostic assessments to unlock side-by-side progress comparisons and evidence tracking.'}
          </div>
        </div>

        {comparison.latestOverallScore && (
          <div className="p-3 bg-light rounded-3 border">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <span className="small text-secondary d-block">Initial Assessment Score</span>
                <span className="fs-5 fw-bold text-primary">
                  {comparison.latestOverallScore.percentage}%
                </span>
                <span className="text-muted small ms-2">
                  ({comparison.latestOverallScore.score}/{comparison.latestOverallScore.maxScore} correct)
                </span>
              </div>
              {comparison.latestSessionDate && (
                <div className="text-end">
                  <span className="small text-secondary d-block">Completed Date</span>
                  <span className="small fw-semibold text-dark">
                    {new Date(comparison.latestSessionDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const {
    previousOverallScore,
    currentOverallScore,
    overallDeltaPercentage,
    overallInterpretation,
    previousDate,
    currentDate,
    topicComparisons = [],
    limitations = []
  } = comparison;

  const deltaPositive = overallDeltaPercentage > 0;
  const deltaZero = overallDeltaPercentage === 0;

  return (
    <div className="card border shadow-sm mb-4" data-testid="evidence-comparison-card">
      {/* Header */}
      <div className="card-header bg-white border-bottom p-3 p-md-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 small fw-semibold">
                Review &amp; Reassessment • Progress Tracking
              </span>
              <span className="small text-secondary">Diagnostic Progression</span>
            </div>
            <h2 className="h5 fw-bold mb-0 text-dark">
              Diagnostic Assessment Comparison
            </h2>
          </div>
          {onRefresh && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
              onClick={onRefresh}
              aria-label="Refresh comparison"
            >
              <Icon name="refresh" size={13} /> Refresh
            </button>
          )}
        </div>
      </div>

      <div className="card-body p-3 p-md-4">
        {/* Overall Delta & Side-by-side Overview */}
        <div className="row g-3 mb-4">
          {/* Previous Session */}
          <div className="col-12 col-md-4">
            <div className="p-3 bg-light rounded-3 border h-100 text-center">
              <span className="small text-secondary text-uppercase fw-semibold d-block mb-1">
                Prior Assessment
              </span>
              <div className="fs-3 fw-bold text-dark mb-1">
                {previousOverallScore.percentage}%
              </div>
              <div className="small text-muted mb-1">
                {previousOverallScore.score} / {previousOverallScore.maxScore} correct
              </div>
              <div className="small text-secondary">
                {previousDate ? new Date(previousDate).toLocaleDateString() : 'Initial'}
              </div>
            </div>
          </div>

          {/* Delta Indicator */}
          <div className="col-12 col-md-4">
            <div className={`p-3 rounded-3 border h-100 text-center ${
              deltaPositive
                ? 'bg-success-subtle border-success-subtle'
                : deltaZero
                ? 'bg-info-subtle border-info-subtle'
                : 'bg-warning-subtle border-warning-subtle'
            }`}>
              <span className="small text-secondary text-uppercase fw-semibold d-block mb-1">
                Observed Shift
              </span>
              <div className={`fs-3 fw-bold mb-1 ${
                deltaPositive ? 'text-success' : deltaZero ? 'text-info-emphasis' : 'text-danger'
              }`}>
                {deltaPositive ? `+${overallDeltaPercentage}` : overallDeltaPercentage}%
              </div>
              <div className="small fw-semibold text-secondary">
                {deltaPositive ? (
                  <span className="d-inline-flex align-items-center gap-1">
                    <Icon name="chart" size={13} /> Encouraging Progress
                  </span>
                ) : deltaZero ? (
                  <span className="d-inline-flex align-items-center gap-1">
                    <Icon name="arrow-right" size={13} /> Performance Stable
                  </span>
                ) : (
                  <span className="d-inline-flex align-items-center gap-1">
                    <Icon name="alert-triangle" size={13} /> Further Revision Advised
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Current Session */}
          <div className="col-12 col-md-4">
            <div className="p-3 bg-light rounded-3 border h-100 text-center">
              <span className="small text-secondary text-uppercase fw-semibold d-block mb-1">
                Reassessment
              </span>
              <div className="fs-3 fw-bold text-primary mb-1">
                {currentOverallScore.percentage}%
              </div>
              <div className="small text-muted mb-1">
                {currentOverallScore.score} / {currentOverallScore.maxScore} correct
              </div>
              <div className="small text-secondary">
                {currentDate ? new Date(currentDate).toLocaleDateString() : 'Latest'}
              </div>
            </div>
          </div>
        </div>

        {overallInterpretation && (
          <p className="text-secondary small mb-4 bg-light p-2.5 rounded border">
            <strong>Interpretation:</strong> {overallInterpretation}
          </p>
        )}

        {/* Granular Topic Breakdown Table */}
        <div className="table-responsive mb-4">
          <table className="table table-hover align-middle mb-0 border">
            <thead className="table-light small text-uppercase">
              <tr>
                <th scope="col" style={{ minWidth: '160px' }}>Topic</th>
                <th scope="col" className="text-center" style={{ minWidth: '110px' }}>Prior Score</th>
                <th scope="col" className="text-center" style={{ minWidth: '110px' }}>Current Score</th>
                <th scope="col" className="text-center" style={{ minWidth: '100px' }}>Shift</th>
                <th scope="col" style={{ minWidth: '180px' }}>Status</th>
                <th scope="col" style={{ minWidth: '220px' }}>Overlap & Notes</th>
              </tr>
            </thead>
            <tbody className="small">
              {topicComparisons.map((tc) => {
                const statusCfg = COMPARISON_STATUS_CONFIG[tc.status] || COMPARISON_STATUS_CONFIG.performance_stable;
                const tcPositive = tc.deltaPercentage !== null && tc.deltaPercentage > 0;
                const tcNegative = tc.deltaPercentage !== null && tc.deltaPercentage < 0;

                return (
                  <tr key={tc.topic}>
                    <td className="fw-semibold text-dark">
                      {tc.topic}
                    </td>
                    <td className="text-center">
                      {tc.previous ? (
                        <div>
                          <span className="fw-semibold">{tc.previous.accuracyPercentage}%</span>
                          <span className="text-muted d-block small">({tc.previous.correctCount}/{tc.previous.sampleSize} q)</span>
                        </div>
                      ) : (
                        <span className="text-muted fst-italic">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {tc.current ? (
                        <div>
                          <span className="fw-semibold text-primary">{tc.current.accuracyPercentage}%</span>
                          <span className="text-muted d-block small">({tc.current.correctCount}/{tc.current.sampleSize} q)</span>
                        </div>
                      ) : (
                        <span className="text-muted fst-italic">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      {tc.deltaPercentage !== null ? (
                        <span className={`badge ${
                          tcPositive ? 'bg-success' : tcNegative ? 'bg-danger' : 'bg-secondary'
                        }`}>
                          {tcPositive ? `+${tc.deltaPercentage}` : tc.deltaPercentage}%
                        </span>
                      ) : (
                        <span className="text-muted fst-italic">N/A</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${statusCfg.badgeClass} px-2 py-1 d-inline-flex align-items-center gap-1`}>
                        <Icon name={statusCfg.iconName || 'circle'} size={12} />
                        <span>{statusCfg.label}</span>
                      </span>
                    </td>
                    <td>
                      <div>
                        <span className="badge bg-light text-dark border me-1 small">
                          {tc.sharedQuestionsCount > 0 ? `${tc.sharedQuestionsCount} shared` : 'No shared questions'}
                        </span>
                        {tc.newQuestionsCount > 0 && (
                          <span className="badge bg-light text-dark border small">
                            {tc.newQuestionsCount} new
                          </span>
                        )}
                      </div>
                      {tc.interpretation && (
                        <div className="text-muted small mt-1">
                          {tc.interpretation}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Honest Limitations & Transparency Callout */}
        {limitations.length > 0 && (
          <div className="p-3 bg-light rounded-3 border">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Icon name="alert-triangle" size={16} className="text-warning-emphasis flex-shrink-0" />
              <h4 className="h6 fw-bold mb-0 text-dark">
                Important Disclosures &amp; Measurement Limitations
              </h4>
            </div>
            <ul className="small text-secondary mb-0 ps-3">
              {limitations.map((limit, idx) => (
                <li key={idx} className="mb-1">{limit}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

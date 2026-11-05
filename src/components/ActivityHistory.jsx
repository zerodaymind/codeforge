import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getActivityHistory } from '../utils/api';
import Icon from './Icons';

const ACTIVITY_ICONS = {
  practice_code: 'code',
  practice_answer: 'terminal',
  quiz: 'target',
  diagnostic: 'brain'
};

const ACTIVITY_LABELS = {
  practice_code: 'Code Execution',
  practice_answer: 'Problem Attempt',
  quiz: 'Quiz Assessment',
  diagnostic: 'Diagnostic Session'
};

/**
 * ActivityHistory Component (Milestone 15D)
 * Displays authoritative, server-verified activity history with filters and pagination.
 */
export default function ActivityHistory({ initialTopic = 'all' }) {
  const [activities, setActivities] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false });
  const [filterType, setFilterType] = useState('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [filterTopic, setFilterTopic] = useState(initialTopic);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    getActivityHistory({
      type: filterType,
      verifiedOnly,
      topic: filterTopic,
      page: 1,
      limit: 10
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.data) {
          setActivities(res.data.data.activities || []);
          setPagination(res.data.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1, hasMore: false });
        } else {
          setErrorMessage(res.data?.message || 'Failed to load activity history.');
        }
      })
      .catch(() => {
        if (isMounted) setErrorMessage('Network error while retrieving activity history.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filterType, verifiedOnly, filterTopic]);

  const handlePageChange = async (newPage) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setIsLoading(true);
    try {
      const res = await getActivityHistory({
        type: filterType,
        verifiedOnly,
        topic: filterTopic,
        page: newPage,
        limit: 10
      });
      if (res.ok && res.data?.data) {
        setActivities(res.data.data.activities || []);
        setPagination(res.data.data.pagination || { page: newPage, limit: 10, total: 0, totalPages: 1, hasMore: false });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card border shadow-sm" data-testid="activity-history-card">
      {/* Header & Filter Controls */}
      <div className="card-header bg-white border-bottom p-3 p-md-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-secondary-subtle text-secondary border px-2 py-0.5 small fw-semibold">
                Authoritative Record
              </span>
              <span className="small text-secondary">Integrity-Enforced History</span>
            </div>
            <h2 className="h5 fw-bold mb-0 text-dark">
              Verified Learning Activity
            </h2>
          </div>

          {/* Filters */}
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {/* Type selector */}
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              aria-label="Filter by activity type"
            >
              <option value="all">All Types</option>
              <option value="practice">Practice (Code/Problems)</option>
              <option value="quiz">Quizzes</option>
              <option value="diagnostic">Diagnostics</option>
            </select>

            {/* Topic selector */}
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
              aria-label="Filter by topic"
            >
              <option value="all">All Topics</option>
              <option value="JavaScript">JavaScript</option>
              <option value="Data Structures & Algorithms">Data Structures & Algorithms</option>
              <option value="Operating Systems">Operating Systems</option>
              <option value="Computer Networks">Computer Networks</option>
              <option value="Arrays">Arrays</option>
              <option value="Strings">Strings</option>
            </select>

            {/* Verified only checkbox */}
            <div className="form-check form-switch mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="verifiedOnlySwitch"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
              />
              <label className="form-check-label small fw-semibold text-secondary" htmlFor="verifiedOnlySwitch">
                Verified Only
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card-body p-3 p-md-4">
        {errorMessage && (
          <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
            <Icon name="alert-triangle" size={16} className="text-danger flex-shrink-0" />
            <div>{errorMessage}</div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary mx-auto mb-2" role="status">
              <span className="visually-hidden">Loading activity records...</span>
            </div>
            <p className="text-secondary small mb-0">Querying authoritative completion history...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-5">
            <div className="mb-2 text-secondary">
              <Icon name="clipboard" size={48} />
            </div>
            <h3 className="h6 fw-bold text-dark mb-1">No Activity Records Found</h3>
            <p className="text-secondary small mb-3">
              {verifiedOnly
                ? 'No verified completions found matching your filters. Submit code or take an assessment to build your verified record.'
                : 'Solve practice problems or take quizzes to track your learning journey here.'}
            </p>
            <div className="d-flex justify-content-center gap-2">
              <Link to="/practice" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5">
                <Icon name="code" size={14} />
                <span>Practice Problems</span>
              </Link>
              <Link to="/diagnostic" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1.5">
                <Icon name="brain" size={14} />
                <span>Diagnostic Assessment</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {activities.map((act) => {
              const iconName = ACTIVITY_ICONS[act.activityType] || 'circle';
              const typeLabel = ACTIVITY_LABELS[act.activityType] || 'Activity';

              return (
                <div
                  key={act.activityId}
                  className="p-3 bg-light rounded-3 border d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3"
                  data-testid={`activity-row-${act.activityId}`}
                >
                  {/* Left: Icon, Title, Tags */}
                  <div className="d-flex align-items-start gap-3">
                    <span className="mt-1 d-inline-flex text-primary">
                      <Icon name={iconName} size={24} />
                    </span>
                    <div>
                      <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <span className="badge bg-secondary text-white small px-2 py-0.5">
                          {typeLabel}
                        </span>
                        {act.topic && (
                          <span className="badge bg-light text-dark border small px-2 py-0.5">
                            {act.topic}
                          </span>
                        )}
                        {act.difficulty && (
                          <span className="badge bg-light text-secondary border small px-2 py-0.5">
                            {act.difficulty}
                          </span>
                        )}
                        {act.isVerifiedCompletion ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle small px-2 py-0.5 d-inline-flex align-items-center gap-1">
                            <Icon name="check" size={12} /> Verified Completion
                          </span>
                        ) : (
                          <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle small px-2 py-0.5">
                            Attempted
                          </span>
                        )}
                      </div>

                      <h3 className="h6 fw-bold mb-1 text-dark">
                        {act.title}
                      </h3>

                      <div className="small text-secondary d-flex align-items-center gap-3 flex-wrap">
                        {act.verdict && (
                          <span>Verdict: <strong>{act.verdict}</strong></span>
                        )}
                        {act.score !== undefined && act.maxScore !== undefined && (
                          <span>Score: <strong>{act.score}/{act.maxScore}</strong> ({act.percentage}%)</span>
                        )}
                        {act.language && (
                          <span>Language: <code>{act.language}</code></span>
                        )}
                        <span>
                          {new Date(act.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: CTA button */}
                  {act.actionUrl && (
                    <div className="flex-shrink-0 w-100 w-sm-auto text-end">
                      <Link
                        to={act.actionUrl}
                        className="btn btn-sm btn-outline-primary fw-semibold text-nowrap"
                      >
                        View Details →
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-3">
            <span className="small text-secondary">
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total activities)
            </span>
            <div className="btn-group btn-group-sm">
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

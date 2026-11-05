import React, { useState, useEffect } from 'react';
import { getSubmissions } from '../utils/api';

/**
 * Reusable SubmissionHistory component.
 * Features:
 * - Fetches authenticated user's submission history for the selected problem
 * - Displays verdict, passed tests count, duration, and timestamp
 * - Modal/preview to view submitted source code
 * - Strictly tenant-isolated: only shows the authenticated user's submissions
 */
export default function SubmissionHistory({ problemId, refreshTrigger = 0 }) {
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(Boolean(problemId));
  const [selectedCode, setSelectedCode] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (!problemId) return;

    getSubmissions({ problemId, limit: 10 })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.submissions) {
          setSubmissions(res.data.submissions);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [problemId, refreshTrigger]);

  const getVerdictBadge = (verdict) => {
    switch (verdict) {
      case 'Accepted':
        return 'bg-success';
      case 'Wrong Answer':
        return 'bg-danger';
      case 'Time Limit Exceeded':
      case 'Runtime Error':
      case 'Compilation Error':
        return 'bg-warning text-dark';
      case 'Sandbox Unavailable':
        return 'bg-secondary';
      default:
        return 'bg-primary';
    }
  };

  return (
    <div className="card shadow-sm border-0 mt-4">
      <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
        <h3 className="h6 fw-bold text-dark mb-0">Submission History</h3>
        <span className="badge bg-light text-secondary border small">
          {submissions.length} {submissions.length === 1 ? 'submission' : 'submissions'}
        </span>
      </div>

      <div className="card-body p-3">
        {isLoading ? (
          <div className="text-center py-4">
            <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>
            <span className="small text-muted ms-2">Loading submissions...</span>
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-muted small text-center my-3">
            No submissions recorded yet for this problem.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover table-sm align-middle mb-0 small">
              <thead>
                <tr className="text-secondary">
                  <th>Status</th>
                  <th>Passed</th>
                  <th>Runtime</th>
                  <th>Submitted</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub._id}>
                    <td>
                      <span className={`badge ${getVerdictBadge(sub.verdict)} px-2 py-1`}>
                        {sub.verdict}
                      </span>
                    </td>
                    <td className="font-monospace">
                      {sub.passedTests} / {sub.totalTests}
                    </td>
                    <td className="text-muted font-monospace">
                      {sub.executionDuration ? `${sub.executionDuration} ms` : '—'}
                    </td>
                    <td className="text-muted">
                      {new Date(sub.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm py-0 px-2"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => setSelectedCode(sub.sourceCode)}
                      >
                        View Code
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Code View Modal */}
      {selectedCode !== null && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title fs-6 fw-bold">Submitted Solution</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedCode(null)}
                ></button>
              </div>
              <div className="modal-body p-3">
                <pre
                  className="bg-dark text-white p-3 rounded font-monospace small mb-0"
                  style={{ maxHeight: '380px', overflowY: 'auto' }}
                >
                  {selectedCode}
                </pre>
              </div>
              <div className="modal-footer py-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm px-3"
                  onClick={() => setSelectedCode(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

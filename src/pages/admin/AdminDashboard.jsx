import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminHeader from '../../components/admin/AdminHeader';
import { getAdminOverview } from '../../utils/api';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = () => {
    setIsLoading(true);
    setError(null);
    getAdminOverview()
      .then((res) => {
        if (res.ok && res.data?.success) {
          setData(res.data.data);
        } else {
          setError(res.data?.message || 'Failed to fetch administrator metrics.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Network error fetching admin metrics.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    getAdminOverview()
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success) {
          setData(res.data.data);
        } else {
          setError(res.data?.message || 'Failed to fetch administrator metrics.');
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Network error fetching admin metrics.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <AdminHeader
        title="Admin Overview"
        subtitle="Live metrics, question bank inventory, and platform activity logs"
        actions={
          <div className="d-flex gap-2">
            <Link to="/admin/questions/new" className="btn btn-primary btn-sm">
              + New Question
            </Link>
            <Link to="/admin/quizzes/new" className="btn btn-success btn-sm">
              + New Quiz
            </Link>
          </div>
        }
      />

      <div className="container pb-5">
        {isLoading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading overview...</span>
            </div>
            <p className="text-secondary small mt-2">Loading platform metrics...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
            <div>
              <strong>Error:</strong> {error}
            </div>
            <button className="btn btn-sm btn-outline-danger" onClick={fetchOverview}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && data && (
          <>
            {/* KPI Metrics Cards */}
            <div className="row g-3 mb-4">
              {/* Questions Metric */}
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="card shadow-sm h-100 border-0 bg-dark text-white">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-secondary text-uppercase small fw-bold">Questions</span>
                      <span className="badge bg-primary">Bank</span>
                    </div>
                    <h2 className="display-6 fw-bold mb-2">{data.questions?.total ?? 0}</h2>
                    <div className="small text-secondary">
                      <span className="text-success fw-semibold">{data.questions?.active ?? 0} active</span> •{' '}
                      <span>{data.questions?.draft ?? 0} draft</span> •{' '}
                      <span className="text-warning">{data.questions?.archived ?? 0} archived</span>
                    </div>
                  </div>
                  <div className="card-footer bg-transparent border-secondary py-2">
                    <Link to="/admin/questions" className="text-decoration-none small text-info fw-semibold">
                      Manage Questions &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Quizzes Metric */}
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="card shadow-sm h-100 border-0 bg-dark text-white">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-secondary text-uppercase small fw-bold">Quizzes</span>
                      <span className="badge bg-success">Assessments</span>
                    </div>
                    <h2 className="display-6 fw-bold mb-2">{data.quizzes?.total ?? 0}</h2>
                    <div className="small text-secondary">
                      <span className="text-success fw-semibold">{data.quizzes?.published ?? 0} published</span> •{' '}
                      <span>{data.quizzes?.draft ?? 0} draft</span> •{' '}
                      <span className="text-warning">{data.quizzes?.archived ?? 0} archived</span>
                    </div>
                  </div>
                  <div className="card-footer bg-transparent border-secondary py-2">
                    <Link to="/admin/quizzes" className="text-decoration-none small text-info fw-semibold">
                      Manage Quizzes &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Quiz Attempts Metric */}
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="card shadow-sm h-100 border-0 bg-dark text-white">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-secondary text-uppercase small fw-bold">Learner Attempts</span>
                      <span className="badge bg-info text-dark">Activity</span>
                    </div>
                    <h2 className="display-6 fw-bold mb-2">{data.attempts?.total ?? 0}</h2>
                    <div className="small text-secondary">
                      <span className="text-success fw-semibold">{data.attempts?.passed ?? 0} passed</span> •{' '}
                      <span className="text-danger">
                        {(data.attempts?.total ?? 0) - (data.attempts?.passed ?? 0)} failed
                      </span>
                    </div>
                  </div>
                  <div className="card-footer bg-transparent border-secondary py-2">
                    <span className="text-secondary small">
                      Pass rate:{' '}
                      {data.attempts?.total > 0
                        ? `${Math.round((data.attempts.passed / data.attempts.total) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Users Metric */}
              <div className="col-12 col-sm-6 col-lg-3">
                <div className="card shadow-sm h-100 border-0 bg-dark text-white">
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-secondary text-uppercase small fw-bold">Platform Users</span>
                      <span className="badge bg-warning text-dark">Accounts</span>
                    </div>
                    <h2 className="display-6 fw-bold mb-2">{data.users?.total ?? 0}</h2>
                    <div className="small text-secondary">
                      <span className="text-light">{data.users?.learners ?? 0} learners</span> •{' '}
                      <span className="text-warning fw-semibold">{data.users?.admins ?? 0} admins</span>
                    </div>
                  </div>
                  <div className="card-footer bg-transparent border-secondary py-2">
                    <span className="text-secondary small">Role-based security active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="card border-secondary shadow-sm mb-4">
              <div className="card-body p-3">
                <h6 className="card-title text-secondary text-uppercase small fw-bold mb-3">
                  Quick Actions
                </h6>
                <div className="d-flex flex-wrap gap-2">
                  <Link to="/admin/questions/new" className="btn btn-primary btn-sm">
                    + Add New Question
                  </Link>
                  <Link to="/admin/quizzes/new" className="btn btn-success btn-sm">
                    + Build New Quiz
                  </Link>
                  <Link to="/admin/questions" className="btn btn-outline-light btn-sm">
                    Browse Question Bank
                  </Link>
                  <Link to="/admin/quizzes" className="btn btn-outline-light btn-sm">
                    Manage Quiz Catalog
                  </Link>
                  <Link to="/admin/audit-logs" className="btn btn-outline-warning btn-sm">
                    Review System Audit Logs
                  </Link>
                </div>
              </div>
            </div>

            {/* Recent Audit Trail Preview */}
            <div className="card border-secondary shadow-sm">
              <div className="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
                <h5 className="mb-0 fw-bold">Recent Administrative Activity</h5>
                <Link to="/admin/audit-logs" className="btn btn-outline-light btn-sm">
                  View Full Audit Log &rarr;
                </Link>
              </div>
              <div className="card-body p-0">
                {(!data.recentAuditLogs || data.recentAuditLogs.length === 0) ? (
                  <div className="p-4 text-center text-secondary small">
                    No recent administrative activities logged.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-dark table-hover mb-0 align-middle">
                      <thead className="table-secondary text-dark">
                        <tr>
                          <th>Timestamp</th>
                          <th>Action</th>
                          <th>Entity</th>
                          <th>Admin Actor</th>
                          <th>Entity ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.recentAuditLogs.map((log) => {
                          const actionColor = log.action.includes('ARCHIVE')
                            ? 'warning'
                            : log.action.includes('PUBLISH')
                            ? 'success'
                            : log.action.includes('CREATE')
                            ? 'primary'
                            : 'secondary';
                          return (
                            <tr key={log._id}>
                              <td className="small text-secondary">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td>
                                <span className={`badge bg-${actionColor}`}>{log.action}</span>
                              </td>
                              <td>
                                <span className="badge bg-outline-light border">{log.entity}</span>
                              </td>
                              <td className="small">
                                <span className="text-light fw-semibold">{log.actorEmail}</span>
                              </td>
                              <td className="small font-monospace text-secondary">
                                {log.entityId}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

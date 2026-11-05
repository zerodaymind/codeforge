import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getQuizAttempts } from '../utils/api';
import Icon from '../components/Icons';

/**
 * QuizHistory Page Component
 * Renders the authenticated user's persistent quiz attempt history with
 * status badges, score percentages, durations, filters, and direct review links.
 */
export default function QuizHistory() {
  const [attempts, setAttempts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getQuizAttempts({
      page: 1,
      limit: 10,
      topic: selectedTopic,
      status: selectedStatus
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success) {
          setAttempts(res.data.data || []);
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        } else {
          setError(res.data?.message || 'Failed to load quiz history.');
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Network error fetching history.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTopic, selectedStatus]);

  const handlePageChange = (page) => {
    setIsLoading(true);
    setError(null);
    getQuizAttempts({
      page,
      limit: 10,
      topic: selectedTopic,
      status: selectedStatus
    })
      .then((res) => {
        if (res.ok && res.data?.success) {
          setAttempts(res.data.data || []);
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        } else {
          setError(res.data?.message || 'Failed to load quiz history.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Network error fetching history.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };


  const formatDuration = (secs) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container py-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 pb-3 border-bottom gap-3">
        <div>
          <h1 className="h2 fw-bold text-dark mb-1">My Quiz History</h1>
          <p className="text-secondary mb-0">
            Review your past quiz attempts, verified scores, and topic performance.
          </p>
        </div>
        <Link to="/quiz" className="btn btn-primary fw-semibold px-4">
          + Take a New Quiz
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="card shadow-sm border-0 mb-4 bg-light">
        <div className="card-body p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="small text-secondary fw-semibold">Status:</span>
            {['All', 'submitted', 'in_progress'].map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${
                  selectedStatus === st ? 'btn-primary text-white' : 'btn-outline-secondary'
                } rounded-pill px-3`}
                onClick={() => setSelectedStatus(st)}
              >
                {st === 'All' ? 'All' : st === 'submitted' ? 'Submitted' : 'In Progress'}
              </button>
            ))}
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="small text-secondary fw-semibold">Topic:</span>
            <select
              className="form-select form-select-sm w-auto"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              aria-label="Filter attempts by topic"
            >
              <option value="All">All Topics</option>
              <option value="JavaScript">JavaScript</option>
              <option value="Data Structures & Algorithms">Data Structures & Algorithms</option>
              <option value="Operating Systems">Operating Systems</option>
              <option value="Computer Networks">Computer Networks</option>
              <option value="Cybersecurity">Cybersecurity</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading attempts...</span>
          </div>
          <p className="text-secondary mt-2">Loading your attempt history...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger p-4 text-center">
          <p className="mb-2">{error}</p>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => fetchHistory(1)}>
            Retry
          </button>
        </div>
      ) : attempts.length === 0 ? (
        <div className="card shadow-sm border text-center p-5">
          <div className="card-body">
            <div className="text-muted mb-3">
              <Icon name="clipboard" size={48} />
            </div>
            <h2 className="h4 fw-bold text-dark mb-2">No Quiz Attempts Found</h2>
            <p className="text-secondary mb-4">
              You haven't completed any quizzes matching the selected filters yet.
            </p>
            <Link to="/quiz" className="btn btn-primary px-4 fw-semibold d-inline-flex align-items-center gap-1.5">
              <span>Browse Available Quizzes</span>
              <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card shadow-sm border-0 overflow-hidden mb-4">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-secondary small">
                  <tr>
                    <th scope="col" className="ps-4">Quiz Title</th>
                    <th scope="col">Topic</th>
                    <th scope="col">Score</th>
                    <th scope="col">Status</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="text-end pe-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((att) => {
                    const isSubmitted = att.status === 'submitted' || att.status === 'completed';
                    const isPassed = (att.percentage || 0) >= 70;

                    return (
                      <tr key={att._id}>
                        <td className="ps-4">
                          <strong className="text-dark d-block">{att.quizTitle}</strong>
                          <span className="small text-muted">{att.difficulty}</span>
                        </td>
                        <td>
                          <span className="badge bg-secondary-subtle text-secondary">
                            {att.topic}
                          </span>
                        </td>
                        <td>
                          {isSubmitted ? (
                            <div>
                              <strong className={`d-block ${isPassed ? 'text-success' : 'text-warning'}`}>
                                {att.percentage}%
                              </strong>
                              <span className="small text-muted">
                                {att.score} / {att.maxScore}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              isSubmitted
                                ? isPassed
                                  ? 'bg-success'
                                  : 'bg-warning text-dark'
                                : 'bg-info text-dark'
                            }`}
                          >
                            {isSubmitted ? (isPassed ? 'Passed' : 'Needs Practice') : 'In Progress'}
                          </span>
                        </td>
                        <td className="small text-secondary">
                          {formatDuration(att.durationSeconds)}
                        </td>
                        <td className="small text-secondary">
                          {formatDate(att.submittedAt || att.startedAt || att.createdAt)}
                        </td>
                        <td className="text-end pe-4">
                          {isSubmitted ? (
                            <Link
                              to={`/quiz/result?attemptId=${att._id}`}
                              className="btn btn-sm btn-outline-primary fw-medium"
                            >
                              Review Result &rarr;
                            </Link>
                          ) : (
                            <Link
                              to={`/quiz?quizId=${att.quizId}`}
                              className="btn btn-sm btn-primary fw-medium"
                            >
                              Resume Quiz &rarr;
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center">
              <span className="small text-secondary">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} total attempts)
              </span>
              <div className="btn-group">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  &larr; Previous
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

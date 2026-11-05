import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  getAdminQuizzes,
  publishAdminQuiz,
  unpublishAdminQuiz,
  archiveAdminQuiz
} from '../../utils/api';

export default function QuizManagement() {
  const [quizzes, setQuizzes] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('All');
  const [status, setStatus] = useState('All');

  useEffect(() => {
    let isMounted = true;
    getAdminQuizzes({
      page: 1,
      limit: 10,
      search,
      topic,
      status
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success) {
          setQuizzes(res.data.data.quizzes || []);
          setPagination(res.data.data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
        } else {
          setError(res.data?.message || 'Failed to fetch quizzes.');
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Error connecting to quiz service.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [search, topic, status]);

  const fetchQuizzes = (page = 1) => {
    setIsLoading(true);
    setError(null);
    getAdminQuizzes({
      page,
      limit: 10,
      search,
      topic,
      status
    })
      .then((res) => {
        if (res.ok && res.data?.success) {
          setQuizzes(res.data.data.quizzes || []);
          setPagination(res.data.data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
        } else {
          setError(res.data?.message || 'Failed to fetch quizzes.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Error connecting to quiz service.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handlePublishToggle = async (quiz) => {
    try {
      const res = quiz.isPublished
        ? await unpublishAdminQuiz(quiz._id)
        : await publishAdminQuiz(quiz._id);

      if (res.ok && res.data?.success) {
        setActionNotice({
          type: 'success',
          text: `Quiz "${quiz.title}" successfully ${quiz.isPublished ? 'unpublished (reverted to draft)' : 'published to learners'}!`
        });
        fetchQuizzes(pagination.page);
      } else {
        setActionNotice({
          type: 'danger',
          text: res.data?.message || `Failed to update publishing state for "${quiz.title}".`
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'danger',
        text: err.message || 'Network error updating publishing state.'
      });
    }
  };

  const handleArchive = async (quiz) => {
    if (
      !window.confirm(
        `Are you sure you want to archive "${quiz.title}"? Learners will no longer be able to start this quiz, but existing learner attempt records will remain intact.`
      )
    ) {
      return;
    }

    try {
      const res = await archiveAdminQuiz(quiz._id);
      if (res.ok && res.data?.success) {
        setActionNotice({
          type: 'success',
          text: `Quiz "${quiz.title}" has been archived.`
        });
        fetchQuizzes(pagination.page);
      } else {
        setActionNotice({
          type: 'danger',
          text: res.data?.message || `Failed to archive quiz "${quiz.title}".`
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'danger',
        text: err.message || 'Network error archiving quiz.'
      });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setTopic('All');
    setStatus('All');
  };

  return (
    <div>
      <AdminHeader
        title="Quiz Catalog & Management"
        subtitle="Configure assessment blueprints, publish validated quizzes, and track version lifecycles"
        actions={
          <Link to="/admin/quizzes/new" className="btn btn-success btn-sm">
            + Build New Quiz
          </Link>
        }
      />

      <div className="container pb-5">
        {actionNotice && (
          <div
            className={`alert alert-${actionNotice.type} alert-dismissible fade show mb-4`}
            role="alert"
          >
            {actionNotice.text}
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => setActionNotice(null)}
            ></button>
          </div>
        )}

        {/* Filter Bar */}
        <div className="card bg-dark border-secondary text-white mb-4 shadow-sm">
          <div className="card-body p-3">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-5">
                <input
                  type="text"
                  className="form-control form-control-sm bg-secondary text-white border-0"
                  placeholder="Search quizzes by title or slug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-6 col-md-3">
                <select
                  className="form-select form-select-sm bg-secondary text-white border-0"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="All">All Topics</option>
                  <option value="JavaScript">JavaScript</option>
                  <option value="React">React</option>
                  <option value="Python">Python</option>
                  <option value="Full Stack">Full Stack</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="col-6 col-md-2">
                <select
                  className="form-select form-select-sm bg-secondary text-white border-0"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="col-12 col-md-2">
                <button
                  type="button"
                  className="btn btn-outline-light btn-sm w-100"
                  onClick={clearFilters}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quiz Content Table */}
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading quizzes...</span>
            </div>
            <p className="text-secondary small mt-2">Loading quiz catalog...</p>
          </div>
        ) : error ? (
          <div className="alert alert-danger" role="alert">
            <strong>Error:</strong> {error}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="card bg-dark border-secondary text-center p-5">
            <h5 className="text-white mb-2">No Quizzes Found</h5>
            <p className="text-secondary small mb-4">
              No quiz records match your active search and filter criteria.
            </p>
            <div className="d-flex justify-content-center gap-2">
              <button className="btn btn-outline-light btn-sm" onClick={clearFilters}>
                Clear Filters
              </button>
              <Link to="/admin/quizzes/new" className="btn btn-success btn-sm">
                + Create New Quiz
              </Link>
            </div>
          </div>
        ) : (
          <div className="card bg-dark border-secondary shadow-sm">
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0 align-middle">
                <thead className="table-secondary text-dark">
                  <tr>
                    <th>Quiz Title</th>
                    <th>Topic</th>
                    <th>Difficulty</th>
                    <th>Questions / Pts</th>
                    <th>Pass %</th>
                    <th>Status</th>
                    <th>Version</th>
                    <th className="text-end" style={{ width: '220px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {quizzes.map((quiz) => {
                    const statusBadge = quiz.isArchived
                      ? 'bg-dark border border-secondary text-muted'
                      : quiz.isPublished
                      ? 'bg-success'
                      : 'bg-secondary';
                    const statusText = quiz.isArchived
                      ? 'Archived'
                      : quiz.isPublished
                      ? 'Published'
                      : 'Draft';

                    return (
                      <tr key={quiz._id}>
                        <td>
                          <div className="fw-semibold text-white">{quiz.title}</div>
                          <span className="text-secondary small font-monospace">
                            /{quiz.slug}
                          </span>
                        </td>
                        <td>
                          <span className="badge bg-info text-dark">{quiz.topic}</span>
                        </td>
                        <td>
                          <span className="badge bg-secondary">{quiz.difficulty}</span>
                        </td>
                        <td>
                          <div className="small text-light">
                            <strong>{quiz.questions?.length ?? 0}</strong> questions
                          </div>
                          <div className="text-secondary small">
                            {quiz.totalPoints ?? 0} total pts
                          </div>
                        </td>
                        <td className="small text-light">
                          {quiz.passingPercentage ?? 70}%
                        </td>
                        <td>
                          <span className={`badge ${statusBadge}`}>{statusText}</span>
                        </td>
                        <td>
                          <span className="badge bg-dark border border-secondary text-secondary small">
                            v{quiz.version || 1}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <Link
                              to={`/admin/quizzes/${quiz._id}/edit`}
                              className="btn btn-outline-info"
                              title="Edit Quiz"
                            >
                              Edit
                            </Link>

                            {!quiz.isArchived && (
                              <button
                                type="button"
                                className={`btn ${quiz.isPublished ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                onClick={() => handlePublishToggle(quiz)}
                                title={quiz.isPublished ? 'Unpublish to draft' : 'Publish to learners'}
                              >
                                {quiz.isPublished ? 'Unpublish' : 'Publish'}
                              </button>
                            )}

                            {!quiz.isArchived && (
                              <button
                                type="button"
                                className="btn btn-outline-danger"
                                onClick={() => handleArchive(quiz)}
                                title="Archive quiz safely"
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="card-footer bg-dark border-secondary d-flex justify-content-between align-items-center py-3">
              <span className="text-secondary small">
                Showing {quizzes.length} of {pagination.total} quizzes (Page {pagination.page} of {pagination.pages})
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchQuizzes(pagination.page - 1)}
                >
                  &larr; Prev
                </button>
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => fetchQuizzes(pagination.page + 1)}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

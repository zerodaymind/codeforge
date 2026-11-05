import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminHeader from '../../components/admin/AdminHeader';
import { getAdminQuestions, archiveAdminQuestion, restoreAdminQuestion } from '../../utils/api';

export default function QuestionList() {
  const [questions, setQuestions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [status, setStatus] = useState('All');

  useEffect(() => {
    let isMounted = true;
    getAdminQuestions({
      page: 1,
      limit: 10,
      search,
      topic,
      difficulty,
      status
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success) {
          setQuestions(res.data.data.questions || []);
          setPagination(res.data.data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
        } else {
          setError(res.data?.message || 'Failed to fetch question bank records.');
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Error connecting to question service.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [search, topic, difficulty, status]);

  const fetchQuestions = (page = 1) => {
    setIsLoading(true);
    setError(null);
    getAdminQuestions({
      page,
      limit: 10,
      search,
      topic,
      difficulty,
      status
    })
      .then((res) => {
        if (res.ok && res.data?.success) {
          setQuestions(res.data.data.questions || []);
          setPagination(res.data.data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
        } else {
          setError(res.data?.message || 'Failed to fetch question bank records.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Error connecting to question service.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleArchiveToggle = async (question) => {
    const isCurrentlyArchived = question.status === 'archived';
    const confirmMsg = isCurrentlyArchived
      ? `Restore Question #${question.id}?`
      : `Archive Question #${question.id}? It will be removed from future quizzes.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = isCurrentlyArchived
        ? await restoreAdminQuestion(question.id)
        : await archiveAdminQuestion(question.id);

      if (res.ok && res.data?.success) {
        setActionNotice({
          type: 'success',
          text: `Question #${question.id} successfully ${isCurrentlyArchived ? 'restored' : 'archived'}.`
        });
        fetchQuestions(pagination.page);
      } else {
        setActionNotice({
          type: 'danger',
          text: res.data?.message || `Failed to update Question #${question.id}.`
        });
      }
    } catch (err) {
      setActionNotice({
        type: 'danger',
        text: err.message || 'Network error updating question.'
      });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setTopic('All');
    setDifficulty('All');
    setStatus('All');
  };

  return (
    <div>
      <AdminHeader
        title="Question Bank Management"
        subtitle="Author, configure, filter, and archive platform assessment questions"
        actions={
          <Link to="/admin/questions/new" className="btn btn-primary btn-sm">
            + Create Question
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

        {/* Filter Controls */}
        <div className="card bg-dark border-secondary text-white mb-4 shadow-sm">
          <div className="card-body p-3">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-4">
                <input
                  type="text"
                  className="form-control form-control-sm bg-secondary text-white border-0"
                  placeholder="Search questions or tags..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-6 col-md-2">
                <select
                  className="form-select form-select-sm bg-secondary text-white border-0"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="All">All Topics</option>
                  <option value="JavaScript">JavaScript</option>
                  <option value="React">React</option>
                  <option value="Node.js">Node.js</option>
                  <option value="Python">Python</option>
                  <option value="HTML & CSS">HTML & CSS</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="col-6 col-md-2">
                <select
                  className="form-select form-select-sm bg-secondary text-white border-0"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                >
                  <option value="All">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div className="col-6 col-md-2">
                <select
                  className="form-select form-select-sm bg-secondary text-white border-0"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="All">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="col-6 col-md-2 d-flex gap-2">
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

        {/* Question List Content */}
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading questions...</span>
            </div>
            <p className="text-secondary small mt-2">Loading question bank...</p>
          </div>
        ) : error ? (
          <div className="alert alert-danger" role="alert">
            <strong>Error:</strong> {error}
          </div>
        ) : questions.length === 0 ? (
          <div className="card bg-dark border-secondary text-center p-5">
            <h5 className="text-white mb-2">No Questions Found</h5>
            <p className="text-secondary small mb-4">
              No question records match your active search and filter criteria.
            </p>
            <div className="d-flex justify-content-center gap-2">
              <button className="btn btn-outline-light btn-sm" onClick={clearFilters}>
                Clear Filters
              </button>
              <Link to="/admin/questions/new" className="btn btn-primary btn-sm">
                + Create New Question
              </Link>
            </div>
          </div>
        ) : (
          <div className="card bg-dark border-secondary shadow-sm">
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0 align-middle">
                <thead className="table-secondary text-dark">
                  <tr>
                    <th style={{ width: '60px' }}>ID</th>
                    <th>Question Prompt</th>
                    <th>Topic</th>
                    <th>Difficulty</th>
                    <th>Points</th>
                    <th>Status</th>
                    <th className="text-end" style={{ width: '180px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const diffBadge =
                      q.difficulty === 'Easy'
                        ? 'bg-success'
                        : q.difficulty === 'Medium'
                        ? 'bg-warning text-dark'
                        : 'bg-danger';

                    const statusBadge =
                      q.status === 'active'
                        ? 'bg-success'
                        : q.status === 'draft'
                        ? 'bg-secondary'
                        : 'bg-dark border border-secondary text-muted';

                    return (
                      <tr key={q.id}>
                        <td className="font-monospace text-secondary small">#{q.id}</td>
                        <td>
                          <div className="fw-semibold text-white">
                            {q.prompt.length > 90 ? `${q.prompt.substring(0, 90)}...` : q.prompt}
                          </div>
                          {q.codeSnippet && (
                            <span className="badge bg-secondary-subtle text-light small me-2 mt-1">
                              &lt;/&gt; Code Snippet
                            </span>
                          )}
                          {q.tags && q.tags.length > 0 && (
                            <span className="text-secondary small">
                              {q.tags.join(', ')}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-info text-dark">{q.topic || 'General'}</span>
                        </td>
                        <td>
                          <span className={`badge ${diffBadge}`}>{q.difficulty || 'Medium'}</span>
                        </td>
                        <td className="text-light fw-bold">{q.points || 1} pt</td>
                        <td>
                          <span className={`badge ${statusBadge}`}>
                            {q.status || 'active'}
                          </span>
                        </td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <Link
                              to={`/admin/questions/${q.id}/edit`}
                              className="btn btn-outline-info"
                              title="Edit Question"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              className={`btn ${q.status === 'archived' ? 'btn-outline-success' : 'btn-outline-warning'}`}
                              onClick={() => handleArchiveToggle(q)}
                              title={q.status === 'archived' ? 'Restore Question' : 'Archive Question'}
                            >
                              {q.status === 'archived' ? 'Restore' : 'Archive'}
                            </button>
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
                Showing {questions.length} of {pagination.total} questions (Page {pagination.page} of {pagination.pages})
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchQuestions(pagination.page - 1)}
                >
                  &larr; Prev
                </button>
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => fetchQuestions(pagination.page + 1)}
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

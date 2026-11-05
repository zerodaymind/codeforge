import React, { useState, useEffect } from 'react';
import AdminHeader from '../../components/admin/AdminHeader';
import { getAdminAuditLogs } from '../../utils/api';

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetadata, setSelectedMetadata] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('All');
  const [entity, setEntity] = useState('All');

  useEffect(() => {
    let isMounted = true;
    getAdminAuditLogs({
      page: 1,
      limit: 15,
      search,
      action,
      entity
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success) {
          setLogs(res.data.data.logs || []);
          setPagination(res.data.data.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
        } else {
          setError(res.data?.message || 'Failed to fetch audit records.');
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Error connecting to audit service.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [search, action, entity]);

  const fetchLogs = (page = 1) => {
    setIsLoading(true);
    setError(null);
    getAdminAuditLogs({
      page,
      limit: 15,
      search,
      action,
      entity
    })
      .then((res) => {
        if (res.ok && res.data?.success) {
          setLogs(res.data.data.logs || []);
          setPagination(res.data.data.pagination || { page: 1, limit: 15, total: 0, pages: 1 });
        } else {
          setError(res.data?.message || 'Failed to fetch audit records.');
        }
      })
      .catch((err) => {
        setError(err.message || 'Error connecting to audit service.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const clearFilters = () => {
    setSearch('');
    setAction('All');
    setEntity('All');
  };

  const getActionBadgeColor = (actionType) => {
    if (actionType.includes('ARCHIVE')) return 'danger';
    if (actionType.includes('RESTORE')) return 'success';
    if (actionType.includes('PUBLISH')) return 'success';
    if (actionType.includes('UNPUBLISH')) return 'warning text-dark';
    if (actionType.includes('CREATE')) return 'primary';
    if (actionType.includes('UPDATE')) return 'info text-dark';
    return 'secondary';
  };

  return (
    <div>
      <AdminHeader
        title="Administrative Audit Trail"
        subtitle="Immutable log of system modifications, content authoring, and lifecycle events"
      />

      <div className="container pb-5">
        {/* Filters */}
        <div className="card bg-dark border-secondary text-white mb-4 shadow-sm">
          <div className="card-body p-3">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-5">
                <input
                  type="text"
                  className="form-control form-control-sm bg-secondary text-white border-0"
                  placeholder="Search by actor email or entity ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="col-6 col-md-3">
                <select
                  className="form-select form-select-sm bg-secondary text-white border-0"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                >
                  <option value="All">All Actions</option>
                  <option value="QUESTION_CREATE">QUESTION_CREATE</option>
                  <option value="QUESTION_UPDATE">QUESTION_UPDATE</option>
                  <option value="QUESTION_ARCHIVE">QUESTION_ARCHIVE</option>
                  <option value="QUESTION_RESTORE">QUESTION_RESTORE</option>
                  <option value="QUIZ_CREATE">QUIZ_CREATE</option>
                  <option value="QUIZ_UPDATE">QUIZ_UPDATE</option>
                  <option value="QUIZ_PUBLISH">QUIZ_PUBLISH</option>
                  <option value="QUIZ_UNPUBLISH">QUIZ_UNPUBLISH</option>
                  <option value="QUIZ_ARCHIVE">QUIZ_ARCHIVE</option>
                </select>
              </div>

              <div className="col-6 col-md-2">
                <select
                  className="form-select form-select-sm bg-secondary text-white border-0"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                >
                  <option value="All">All Entities</option>
                  <option value="Question">Question</option>
                  <option value="Quiz">Quiz</option>
                  <option value="User">User</option>
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

        {/* Audit Log Content */}
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading audit logs...</span>
            </div>
            <p className="text-secondary small mt-2">Loading audit trail...</p>
          </div>
        ) : error ? (
          <div className="alert alert-danger" role="alert">
            <strong>Error:</strong> {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="card bg-dark border-secondary text-center p-5">
            <h5 className="text-white mb-2">No Audit Records Found</h5>
            <p className="text-secondary small mb-3">
              No logged activities match your search and filter criteria.
            </p>
            <button className="btn btn-outline-light btn-sm mx-auto" onClick={clearFilters}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="card bg-dark border-secondary shadow-sm">
            <div className="table-responsive">
              <table className="table table-dark table-hover mb-0 align-middle">
                <thead className="table-secondary text-dark">
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Entity ID</th>
                    <th>IP / Client</th>
                    <th className="text-end">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td className="small text-secondary font-monospace" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge bg-${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{log.entity}</span>
                      </td>
                      <td>
                        <div className="text-white small fw-semibold">{log.actorEmail}</div>
                      </td>
                      <td className="font-monospace small text-info">
                        {log.entityId}
                      </td>
                      <td className="small text-secondary font-monospace">
                        {log.ipAddress || 'internal'}
                      </td>
                      <td className="text-end">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm py-0 px-2"
                            onClick={() => setSelectedMetadata(log)}
                          >
                            Inspect
                          </button>
                        ) : (
                          <span className="text-secondary small">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="card-footer bg-dark border-secondary d-flex justify-content-between align-items-center py-3">
              <span className="text-secondary small">
                Showing {logs.length} of {pagination.total} records (Page {pagination.page} of {pagination.pages})
              </span>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchLogs(pagination.page - 1)}
                >
                  &larr; Prev
                </button>
                <button
                  type="button"
                  className="btn btn-outline-light"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => fetchLogs(pagination.page + 1)}
                >
                  Next &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Inspection Modal */}
        {selectedMetadata && (
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content bg-dark border-secondary text-white">
                <div className="modal-header border-secondary">
                  <h6 className="modal-title fw-bold">
                    Audit Detail: {selectedMetadata.action}
                  </h6>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setSelectedMetadata(null)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-2 small text-secondary">
                    Logged at: {new Date(selectedMetadata.timestamp).toLocaleString()} by{' '}
                    <strong>{selectedMetadata.actorEmail}</strong>
                  </div>
                  <pre
                    className="bg-black text-info p-3 rounded font-monospace small mb-0"
                    style={{ maxHeight: '300px', overflowY: 'auto' }}
                  >
                    {JSON.stringify(selectedMetadata.metadata, null, 2)}
                  </pre>
                </div>
                <div className="modal-footer border-secondary">
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => setSelectedMetadata(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

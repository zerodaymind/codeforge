import React from 'react';
import { Navigate, useLocation, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import Icon from './Icons';

/**
 * AdminRoute component for guarding administrative routes in React Router.
 * - Redirects unauthenticated visitors to /login preserving target location.
 * - Displays a secure Access Denied screen for non-admin authenticated users.
 */
export default function AdminRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="container py-5 text-center my-5">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Verifying administrative privileges...</span>
        </div>
        <p className="text-secondary mt-3 small">Checking authorization credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="container py-5 my-5">
        <div className="card border-danger shadow-sm mx-auto" style={{ maxWidth: '560px' }}>
          <div className="card-body text-center p-5">
            <div className="mb-3">
              <span className="badge bg-danger-subtle text-danger p-3 rounded-circle d-inline-flex align-items-center justify-content-center">
                <Icon name="shield" size={36} />
              </span>
            </div>
            <h3 className="card-title text-danger fw-bold mb-3">Administrator Access Required</h3>
            <p className="card-text text-secondary mb-4">
              Your account does not have administrative privileges to view or manage CodeForge platform resources.
            </p>
            <div className="d-flex justify-content-center gap-3">
              <Link to="/dashboard" className="btn btn-primary">
                Return to Dashboard
              </Link>
              <Link to="/" className="btn btn-outline-secondary">
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return children ? children : <Outlet />;
}

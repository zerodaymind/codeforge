import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

/**
 * ProtectedRoute component for guarding authenticated routes in React Router.
 * Redirects unauthenticated visitors to /login preserving target location.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Display accessible Bootstrap spinner while verifying session on startup
  if (isLoading) {
    return (
      <div className="container py-5 text-center my-5">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading session...</span>
        </div>
        <p className="text-secondary mt-3 small">Verifying authentication session...</p>
      </div>
    );
  }

  // Redirect to /login if unauthenticated, preserving intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Render children or nested Outlet
  return children ? children : <Outlet />;
}

import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container py-5 text-center">
      <h1 className="display-1 fw-bold text-danger">404</h1>
      <h2 className="fw-bold mb-3">Page Not Found</h2>
      <p className="lead text-muted mb-4">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        Back to Home
      </Link>
    </div>
  );
}

import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

/**
 * Accessible fallback spinner displayed during lazy route loading.
 */
function PageLoadingSpinner() {
  return (
    <div
      className="d-flex justify-content-center align-items-center py-5 my-5"
      style={{ minHeight: '55vh' }}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="spinner-border text-primary mb-2" role="status">
          <span className="visually-hidden">Loading page...</span>
        </div>
        <p className="small text-muted mb-0">Loading page...</p>
      </div>
    </div>
  );
}

/**
 * Main application layout structure.
 * Wraps Navbar, page content rendered via React Router Outlet with Suspense fallback, and Footer.
 */
export default function MainLayout() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1">
        <Suspense fallback={<PageLoadingSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}


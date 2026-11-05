import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import ThemeToggle from './ThemeToggle';

/**
 * Responsive Navigation Bar component for CodeForge.
 * Includes brand logo, dynamic navigation according to JWT auth status,
 * accessible active pill indicators, and authenticated user controls.
 */
export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);

  const handleNavCollapse = () => setIsNavCollapsed(!isNavCollapsed);
  const closeNav = () => setIsNavCollapsed(true);

  const handleLogout = () => {
    logout();
    closeNav();
    navigate('/');
  };

  const getNavLinkClass = ({ isActive }) =>
    `nav-link px-3 py-1.5 ${isActive ? 'active fw-semibold text-white' : 'text-secondary'}`;

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark sticky-top border-bottom border-secondary shadow-sm py-2">
      <div className="container">
        {/* Brand */}
        <Link className="navbar-brand fw-bold fs-4 d-flex align-items-center gap-2" to="/" onClick={closeNav}>
          <img src="/favicon.svg" alt="CodeForge Logo" width="28" height="28" className="d-inline-block rounded-2" />
          <span><span className="text-white">Code</span><span className="text-primary">Forge</span></span>
        </Link>

        {/* Mobile toggler */}
        <button
          className="navbar-toggler border-secondary p-1"
          type="button"
          aria-controls="navbarContent"
          aria-expanded={!isNavCollapsed}
          aria-label="Toggle navigation"
          onClick={handleNavCollapse}
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Collapsible content */}
        <div className={`collapse navbar-collapse ${!isNavCollapsed ? 'show' : ''}`} id="navbarContent">
          {/* Main Navigation Links */}
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 align-items-lg-center">
            <li className="nav-item">
              <NavLink className={getNavLinkClass} to="/" end onClick={closeNav}>
                Home
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={getNavLinkClass} to="/practice" onClick={closeNav}>
                Practice
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink className={getNavLinkClass} to="/quiz" onClick={closeNav}>
                Quiz
              </NavLink>
            </li>
            {/* Authenticated Navigation Links */}
            {isAuthenticated && (
              <>
                <li className="nav-item">
                  <NavLink className={getNavLinkClass} to="/quiz/history" onClick={closeNav}>
                    Quiz History
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={getNavLinkClass} to="/dashboard" onClick={closeNav}>
                    Dashboard
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={getNavLinkClass} to="/roadmap" onClick={closeNav}>
                    Roadmap
                  </NavLink>
                </li>
                <li className="nav-item">
                  <NavLink className={getNavLinkClass} to="/profile" onClick={closeNav}>
                    Profile
                  </NavLink>
                </li>
                {user?.role === 'admin' && (
                  <li className="nav-item ms-lg-1">
                    <NavLink className={getNavLinkClass} to="/admin" onClick={closeNav}>
                      <span className="badge bg-warning text-dark me-1 fw-bold">Admin</span> Panel
                    </NavLink>
                  </li>
                )}
              </>
            )}
          </ul>

          {/* Actions & Theme Toggle */}
          <div className="d-flex align-items-center gap-2 pt-2 pt-lg-0">
            <ThemeToggle />
            {isAuthenticated ? (
              <div className="d-flex align-items-center gap-2 ms-lg-2">
                <span className="badge bg-secondary-subtle text-light border border-secondary px-2.5 py-1.5 d-none d-sm-inline-flex align-items-center gap-1.5">
                  <span className="status-dot bg-success"></span>
                  <span className="fw-semibold text-truncate" style={{ maxWidth: '140px' }}>
                    {user?.fullName || 'Programmer'}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm px-3 fw-semibold d-inline-flex align-items-center gap-1"
                  onClick={handleLogout}
                >
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <div className="d-flex align-items-center gap-2 ms-lg-2">
                <Link to="/login" className="btn btn-outline-light btn-sm px-3" onClick={closeNav}>
                  Login
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm px-3 fw-semibold" onClick={closeNav}>
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

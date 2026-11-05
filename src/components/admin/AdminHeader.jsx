import React from 'react';
import { NavLink, Link } from 'react-router-dom';

export default function AdminHeader({ title, subtitle, actions }) {
  const getTabClass = ({ isActive }) =>
    `nav-link px-3 py-2 ${isActive ? 'active bg-primary text-white fw-semibold rounded' : 'text-light'}`;

  return (
    <div className="bg-dark text-white border-bottom border-secondary mb-4 py-4">
      <div className="container">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="badge bg-warning text-dark fw-bold">Admin Portal</span>
              <span className="text-secondary small">• System Management</span>
            </div>
            <h2 className="fw-bold mb-0 text-white">{title || 'Admin Control Panel'}</h2>
            {subtitle && <p className="text-secondary small mb-0 mt-1">{subtitle}</p>}
          </div>
          <div className="d-flex align-items-center gap-2">
            {actions}
            <Link to="/dashboard" className="btn btn-outline-light btn-sm">
              Learner Dashboard &rarr;
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <ul className="nav nav-pills gap-2 pt-2 border-top border-secondary">
          <li className="nav-item">
            <NavLink to="/admin" end className={getTabClass}>
              Dashboard
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/admin/questions" className={getTabClass}>
              Question Bank
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/admin/quizzes" className={getTabClass}>
              Quizzes
            </NavLink>
          </li>
          <li className="nav-item">
            <NavLink to="/admin/audit-logs" className={getTabClass}>
              Audit Logs
            </NavLink>
          </li>
        </ul>
      </div>
    </div>
  );
}

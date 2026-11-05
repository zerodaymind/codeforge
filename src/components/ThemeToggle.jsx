import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/useTheme';

/**
 * Accessible ThemeToggle component for CodeForge navigation.
 * Supports 'light', 'dark', and 'system' modes with clean SVG icons,
 * full keyboard navigation (Arrows, Enter, Escape), ARIA attributes,
 * and zero layout shifts.
 */
export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
      if (!items || items.length === 0) return;
      const focusedIndex = Array.from(items).indexOf(document.activeElement);
      const nextIndex =
        e.key === 'ArrowDown'
          ? (focusedIndex + 1) % items.length
          : (focusedIndex - 1 + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  const options = [
    {
      id: 'light',
      label: 'Light',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      )
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )
    },
    {
      id: 'system',
      label: 'System',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )
    }
  ];

  const currentOption = options.find((opt) => opt.id === theme) || options[2];
  const activeIcon = theme === 'system' ? (
    resolvedTheme === 'dark' ? options[1].icon : options[0].icon
  ) : (
    currentOption.icon
  );

  return (
    <div className="position-relative d-inline-block" ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 px-2 py-1 theme-toggle-btn text-white border-secondary"
        style={{ minWidth: '38px', height: '32px' }}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Current theme: ${theme} (${resolvedTheme}). Click to change color theme.`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span className="theme-toggle-icon d-inline-flex align-items-center justify-content-center text-warning" aria-hidden="true">
          {activeIcon}
        </span>
        <span className="small text-capitalize d-none d-xl-inline">{theme}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-secondary" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Theme Selection"
          className="dropdown-menu dropdown-menu-end show position-absolute end-0 mt-1 shadow-lg border border-secondary py-1"
          style={{ minWidth: '140px', zIndex: 1080 }}
        >
          {options.map((opt) => {
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="menuitem"
                className={`dropdown-item d-flex align-items-center justify-content-between px-3 py-2 small ${
                  isSelected ? 'active fw-bold' : ''
                }`}
                onClick={() => {
                  setTheme(opt.id);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <span className="theme-opt-icon d-inline-flex text-secondary" aria-hidden="true">
                    {opt.icon}
                  </span>
                  <span>{opt.label}</span>
                </div>
                {isSelected && <span className="small text-primary fw-bold" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

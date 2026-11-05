import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useTheme } from '../context/useTheme';
import Icon from './Icons';
import { SUPPORTED_LANGUAGES, getMonacoLanguage } from '../utils/languages';

/**
 * Reusable CodeEditor component backed by Monaco Editor.
 * Features:
 * - Syntax highlighting & editing
 * - Language selector (initially JavaScript; designed for Python & C++ expansion)
 * - Run Code, Submit Solution, Reset Code controls
 * - Theme synchronization with application theme (vs-dark / light) + explicit user override persistence
 * - Safe local draft persistence per problem without storing credentials
 */
export default function CodeEditor({
  code,
  onChange,
  language = 'javascript',
  onLanguageChange,
  onRun,
  onSubmit,
  onReset,
  isRunning = false,
  isSubmitting = false,
  sandboxAvailable = false
}) {
  const { resolvedTheme } = useTheme();
  const [userThemeOverride, setUserThemeOverride] = useState(() => {
    try {
      return localStorage.getItem('codeforge-editor-theme');
    } catch {
      return null;
    }
  });

  const effectiveEditorTheme = userThemeOverride || (resolvedTheme === 'dark' ? 'vs-dark' : 'light');

  const handleEditorThemeChange = (newTheme) => {
    setUserThemeOverride(newTheme);
    try {
      localStorage.setItem('codeforge-editor-theme', newTheme);
    } catch {}
  };

  const handleEditorChange = (value) => {
    onChange(value || '');
  };

  return (
    <div className="card shadow-sm border-0 h-100 d-flex flex-column code-editor-shell">
      {/* Editor Header / Toolbar */}
      <div className="card-header bg-dark text-white py-2 px-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="small fw-semibold text-secondary">Language:</span>
          <select
            className="form-select form-select-sm bg-secondary text-white border-0 py-1"
            style={{ width: '180px', fontSize: '0.85rem' }}
            value={language}
            onChange={(e) => onLanguageChange && onLanguageChange(e.target.value)}
            aria-label="Programming language selector"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.displayName}
              </option>
            ))}
          </select>

          {/* Theme selector */}
          <select
            className="form-select form-select-sm bg-secondary text-white border-0 py-1"
            style={{ width: '110px', fontSize: '0.85rem' }}
            value={effectiveEditorTheme}
            onChange={(e) => handleEditorThemeChange(e.target.value)}
            aria-label="Code editor theme"
          >
            <option value="vs-dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        <div className="d-flex align-items-center gap-2">
          {!sandboxAvailable && (
            <span
              className="badge bg-warning text-dark small d-inline-flex align-items-center gap-1"
              title="Docker engine is not active. Execution is disabled."
            >
              <Icon name="alert-triangle" size={12} /> Sandbox Offline
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-light py-1 px-2 d-inline-flex align-items-center gap-1"
            onClick={onReset}
            disabled={isRunning || isSubmitting}
            title="Reset code to original starter template"
          >
            <Icon name="refresh" size={13} /> Reset
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-grow-1" style={{ minHeight: '340px', height: '420px' }}>
        <Editor
          height="100%"
          language={getMonacoLanguage(language)}
          value={code}
          theme={effectiveEditorTheme}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on'
          }}
          loading={
            <div className="d-flex justify-content-center align-items-center h-100 bg-dark text-white">
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              <span className="small">Loading Code Editor...</span>
            </div>
          }
        />
      </div>

      {/* Editor Footer / Action Controls */}
      <div className="card-footer bg-light py-3 px-3 border-top d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="small text-muted">
          <span>Auto-saved to local draft</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm px-3 fw-semibold d-flex align-items-center gap-1.5"
            onClick={onRun}
            disabled={isRunning || isSubmitting}
          >
            {isRunning ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              <Icon name="terminal" size={14} />
            )}
            <span>Run Code</span>
          </button>

          <button
            type="button"
            className="btn btn-success btn-sm px-4 fw-semibold d-flex align-items-center gap-1.5 shadow-sm"
            onClick={onSubmit}
            disabled={isRunning || isSubmitting}
          >
            {isSubmitting ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : (
              <Icon name="check" size={14} />
            )}
            <span>Submit Solution</span>
          </button>
        </div>
      </div>
    </div>
  );
}

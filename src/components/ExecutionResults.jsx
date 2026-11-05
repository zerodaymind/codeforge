import React, { useState } from 'react';
import Icon from './Icons';

/**
 * Reusable ExecutionResults component.
 * Features:
 * - Truthful verdict status badges distinguishing all execution states:
 *   Running, Passed, Failed, Compilation Error, Runtime Error, Timed Out,
 *   Execution Unavailable, Results Unavailable (custom run), Submission Rejected
 * - Passed / Failed test case counts and per-test breakdown
 * - Input, expected output, actual output, error message per test case
 * - Separate Standard output (stdout) & error streams (stderr)
 * - Execution duration and optional memory usage
 * - Docker sandbox setup guide when sandbox is offline
 */
export default function ExecutionResults({
  results,
  setupGuide,
  sandboxAvailable = false,
  isRunning = false,
  isSubmitting = false
}) {
  const [activeTab, setActiveTab] = useState('testcases'); // 'testcases' | 'console'

  // 1. Loading State
  if (isRunning || isSubmitting) {
    return (
      <div className="card shadow-sm border mt-4">
        <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <h3 className="h6 fw-bold text-dark mb-0">Execution Results</h3>
            <span className="badge bg-primary px-3 py-1.5 fs-6 fw-semibold d-inline-flex align-items-center gap-1.5">
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span>{isSubmitting ? 'Evaluating Solution...' : 'Running Code...'}</span>
            </span>
          </div>
        </div>
        <div className="card-body p-4 text-center py-5">
          <span className="spinner-border text-primary mb-3" role="status" aria-hidden="true"></span>
          <p className="text-secondary small mb-0">
            {isSubmitting
              ? 'Evaluating solution against test cases inside isolated sandbox...'
              : 'Executing code inside secure container sandbox...'}
          </p>
        </div>
      </div>
    );
  }

  // 2. Initial Empty State
  if (!results && !setupGuide) {
    return (
      <div className="card shadow-sm border mt-4 p-4 text-center bg-light">
        <p className="text-secondary small mb-0">
          Run your code or submit your solution to inspect execution output and test cases.
        </p>
      </div>
    );
  }

  // 3. Resolve honest status semantics
  const verdict = results?.verdict || results?.status || 'Executed';
  const isAccepted = verdict === 'Accepted' || verdict === 'Passed';
  const isWrongAnswer = verdict === 'Wrong Answer' || verdict === 'Failed';
  const isCompilationError = verdict === 'Compilation Error' || results?.status === 'COMPILATION_ERROR';
  const isRuntimeError = verdict === 'Runtime Error' || results?.status === 'RUNTIME_ERROR';
  const isTimeout = verdict === 'Time Limit Exceeded' || verdict === 'Timed Out' || results?.status === 'TIME_LIMIT_EXCEEDED';
  const isOutputLimit = verdict === 'Output Limit Exceeded' || results?.status === 'OUTPUT_LIMIT_EXCEEDED';
  const isSandboxOffline = !sandboxAvailable || verdict === 'Sandbox Unavailable' || verdict === 'Execution Unavailable' || results?.status === 'SANDBOX_UNAVAILABLE';
  const isRejected = verdict === 'Submission Rejected' || verdict === 'Malformed Submission' || verdict === 'Authentication Required' || results?.status === 'MALFORMED_SUBMISSION' || results?.status === 'AUTH_REQUIRED';
  const isExecutedNoTestCases = (verdict === 'Executed' || verdict === 'Completed') && (!results?.totalTests || results.totalTests === 0);

  // Derive badge class
  let badgeClass = 'bg-primary';
  let displayVerdict = verdict;

  if (isAccepted) {
    badgeClass = 'bg-success';
    displayVerdict = results?.verdict === 'Accepted' ? 'Accepted' : 'Passed';
  } else if (isWrongAnswer) {
    badgeClass = 'bg-danger';
    displayVerdict = results?.verdict === 'Wrong Answer' ? 'Wrong Answer' : 'Failed';
  } else if (isCompilationError) {
    badgeClass = 'bg-danger';
    displayVerdict = 'Compilation Error';
  } else if (isRuntimeError) {
    badgeClass = 'bg-danger';
    displayVerdict = 'Runtime Error';
  } else if (isTimeout) {
    badgeClass = 'bg-warning text-dark';
    displayVerdict = 'Time Limit Exceeded';
  } else if (isOutputLimit) {
    badgeClass = 'bg-warning text-dark';
    displayVerdict = 'Output Limit Exceeded';
  } else if (isSandboxOffline) {
    badgeClass = 'bg-secondary';
    displayVerdict = 'Sandbox Unavailable';
  } else if (isRejected) {
    badgeClass = 'bg-danger';
  } else if (isExecutedNoTestCases) {
    badgeClass = 'bg-info text-dark';
    displayVerdict = 'Executed';
  }

  const hasTestCases = Array.isArray(results?.results) && results.results.length > 0;
  const hasTotalTests = typeof results?.totalTests === 'number' && results.totalTests > 0;

  return (
    <div className="card shadow-sm border mt-4">
      {/* Header with verdict badge, duration, and optional memory */}
      <div className="card-header bg-white border-bottom py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="d-flex align-items-center gap-2">
          <h3 className="h6 fw-bold text-dark mb-0">Execution Results</h3>
          <span className={`badge ${badgeClass} px-3 py-1.5 fs-6 fw-semibold`}>
            {displayVerdict}
          </span>
        </div>

        <div className="d-flex align-items-center gap-3">
          {results?.executionDuration !== undefined && (
            <span className="small text-secondary font-monospace d-inline-flex align-items-center gap-1" title="Execution Time">
              <Icon name="clock" size={14} />
              <span>{results.executionDuration} ms</span>
            </span>
          )}
          {(results?.memoryUsage || results?.memory) && (
            <span className="small text-secondary font-monospace d-inline-flex align-items-center gap-1" title="Memory Usage">
              <Icon name="cpu" size={14} />
              <span>{results.memoryUsage || results.memory}</span>
            </span>
          )}
        </div>
      </div>

      <div className="card-body p-4">
        {/* Docker Sandbox Offline Alert & Setup Guide */}
        {isSandboxOffline && (
          <div className="alert alert-warning border-warning-subtle shadow-sm mb-4" role="alert">
            <div className="d-flex align-items-center gap-2 mb-2">
              <Icon name="alert-triangle" size={20} className="text-warning flex-shrink-0" />
              <strong className="fs-6">Secure Docker Sandbox is Offline</strong>
            </div>
            <p className="small mb-3">
              To protect the host operating system from untrusted code execution, CodeForge requires a Docker sandbox.
              Code execution is currently disabled to prevent unsafe execution on the host server.
            </p>
            {setupGuide && (
              <div className="bg-white p-3 rounded border small">
                <div className="fw-semibold text-dark mb-2">Windows Setup Instructions:</div>
                <ol className="mb-0 ps-3">
                  {setupGuide.steps?.map((step, idx) => (
                    <li key={idx} className="mb-1 text-secondary font-monospace">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* Tab navigation */}
        <ul className="nav nav-tabs mb-3" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link small fw-semibold ${activeTab === 'testcases' ? 'active' : ''}`}
              onClick={() => setActiveTab('testcases')}
            >
              Test Cases{' '}
              {hasTotalTests ? (
                <span className={`badge ms-1 ${results.passedTests === results.totalTests ? 'bg-success text-white' : 'bg-light text-dark border'}`}>
                  {results.passedTests} / {results.totalTests} Passed
                </span>
              ) : null}
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              type="button"
              className={`nav-link small fw-semibold ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => setActiveTab('console')}
            >
              Console Output
              {results?.stderr && (
                <span className="badge bg-danger text-white ms-1">Error</span>
              )}
            </button>
          </li>
        </ul>

        {/* Tab Content 1: Test Cases */}
        {activeTab === 'testcases' && (
          <div>
            {hasTestCases ? (
              <div className="d-flex flex-column gap-3">
                {results.results.map((tc, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-3 border ${
                      tc.passed ? 'border-success bg-success-subtle' : 'border-danger bg-danger-subtle'
                    }`}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-bold small text-dark">
                        Test Case {tc.testIndex || idx + 1}
                      </span>
                      <span
                        className={`badge ${tc.passed ? 'bg-success' : 'bg-danger'} px-2 py-1 small fw-semibold d-inline-flex align-items-center gap-1`}
                      >
                        <Icon name={tc.passed ? 'check' : 'x'} size={12} />
                        <span>{tc.passed ? 'Passed' : 'Failed'}</span>
                      </span>
                    </div>

                    <div className="small font-monospace mb-1 text-secondary">
                      <strong>Input:</strong> {tc.input}
                    </div>
                    <div className="small font-monospace mb-1 text-dark">
                      <strong>Expected Output:</strong> {tc.expectedOutput}
                    </div>
                    <div
                      className={`small font-monospace ${
                        tc.passed ? 'text-success' : 'text-danger'
                      }`}
                    >
                      <strong>Actual Output:</strong> {tc.actualOutput !== undefined && tc.actualOutput !== '' ? tc.actualOutput : '(no output)'}
                    </div>
                    {tc.error && (
                      <div className="small text-danger font-monospace mt-1">
                        <strong>Error:</strong> {tc.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-light rounded text-center">
                <p className="text-secondary small mb-0">
                  {isSandboxOffline
                    ? 'Execution sandbox is offline. Follow the setup guide above to enable container execution.'
                    : isCompilationError
                    ? 'A syntax or compilation error occurred prior to test evaluation. See the Console Output tab for details.'
                    : isRuntimeError
                    ? 'A runtime error occurred during execution. Inspect the error output in the Console Output tab.'
                    : isTimeout
                    ? 'Execution exceeded the 5000ms wall-clock limit before test results could be collected.'
                    : isRejected
                    ? 'Submission was rejected by the server. Check error messages in the Console Output tab.'
                    : isExecutedNoTestCases
                    ? 'Code executed successfully against custom input. No problem test-case breakdown is associated with this run.'
                    : 'No test case breakdown available for this run.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Console Output */}
        {activeTab === 'console' && (
          <div>
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">Standard Output (stdout):</label>
              <pre
                className="bg-dark text-light p-3 rounded font-monospace small"
                style={{ maxHeight: '180px', overflowY: 'auto' }}
              >
                {results?.stdout ? results.stdout : '<No standard output>'}
              </pre>
            </div>

            {results?.stderr ? (
              <div>
                <label className="form-label small fw-semibold text-danger">Standard Error (stderr):</label>
                <pre
                  className="bg-danger-subtle text-danger p-3 rounded font-monospace small border border-danger-subtle"
                  style={{ maxHeight: '180px', overflowY: 'auto' }}
                >
                  {results.stderr}
                </pre>
              </div>
            ) : (
              <div>
                <label className="form-label small fw-semibold text-secondary">Standard Error (stderr):</label>
                <pre className="bg-light text-secondary p-2 rounded font-monospace small mb-0">
                  &lt;No error stream logged&gt;
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

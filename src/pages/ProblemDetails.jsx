import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import problemsData from '../data/problems';
import { getDifficultyBadgeClass } from '../utils/helpers';
import { useAuth } from '../context/useAuth';
import {
  getProblem,
  getMyProblemProgress,
  getProblemProgress,
  markProblemCompleted,
  unmarkProblemCompleted,
  getSandboxStatus,
  runCode,
  submitCode
} from '../utils/api';
import ExecutionResults from '../components/ExecutionResults';
import SubmissionHistory from '../components/SubmissionHistory';
import Icon from '../components/Icons';
import { getStarterCodeForProblem, normalizeLanguageId } from '../utils/languages';

const CodeEditor = React.lazy(() => import('../components/CodeEditor'));

/**
 * ProblemDetails Page Component — Milestone 11
 * Features:
 * - Challenge specifications, difficulty, topic, examples, constraints
 * - Interactive Monaco Code Editor with language selector & theme toggle
 * - Safe local draft persistence per problem without storing secrets
 * - Execution controls: Run Code, Submit Solution, Reset Code
 * - Execution results with test-case breakdown and console output (stdout/stderr)
 * - Sandbox setup guide when Docker sandbox is offline
 * - Authenticated submission history with tenant isolation
 * - Manual progress marking and automatic progress update on Accepted verdict
 */
export default function ProblemDetails() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();

  const [problem, setProblem] = useState(() => {
    return problemsData.find((p) => p.id === id || p.slug === id) || null;
  });
  const [isLoadingProblem, setIsLoadingProblem] = useState(!problem);
  const [loadError, setLoadError] = useState(null);

  // Manual & automatic completion progress state
  const [isCompleted, setIsCompleted] = useState(false);
  const [isTogglingProgress, setIsTogglingProgress] = useState(false);
  const [progressMessage, setProgressMessage] = useState(null);

  // Code editor & execution state
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionResults, setExecutionResults] = useState(null);
  const [sandboxStatus, setSandboxStatus] = useState({
    sandboxAvailable: false,
    setupGuide: null
  });
  const [submissionsTrigger, setSubmissionsTrigger] = useState(0);

  // Check sandbox status on component mount
  useEffect(() => {
    let isMounted = true;
    getSandboxStatus().then((res) => {
      if (!isMounted) return;
      if (res.ok && res.data) {
        setSandboxStatus({
          sandboxAvailable: Boolean(res.data.sandboxAvailable),
          setupGuide: res.data.setupGuide
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch problem from MongoDB API
  useEffect(() => {
    let isMounted = true;

    getProblem(id)
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.problem) {
          const p = res.data.problem;
          setProblem(p);

          // Check if user has a stored local draft for this problem and current language
          const draftKey = `codeforge_draft_${p.slug || p.id || id}_${language}`;
          const legacyDraftKey = `codeforge_draft_${p.slug || p.id || id}`;
          const savedDraft =
            localStorage.getItem(draftKey) ??
            (language === 'javascript' ? localStorage.getItem(legacyDraftKey) : null);
          const starter = getStarterCodeForProblem(p, language);
          setCode(savedDraft !== null ? savedDraft : starter);
        } else {
          setLoadError(res.data?.message || 'Problem not found in CodeForge API.');
        }
      })
      .catch((err) => {
        if (isMounted) setLoadError(err.message || 'Unable to connect to CodeForge API.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingProblem(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, language]);

  // Check if authenticated user has completed this problem in MongoDB
  useEffect(() => {
    let isMounted = true;

    if (isAuthenticated && problem?._id) {
      getProblemProgress(problem._id).then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.progress?.completed) {
          setIsCompleted(true);
        } else {
          getMyProblemProgress().then((attemptRes) => {
            if (!isMounted) return;
            if (attemptRes.ok && attemptRes.data?.progress?.byProblem) {
              const solved = attemptRes.data.progress.byProblem.some(
                (item) =>
                  (item.problemId === problem.slug || item.problemId === problem.id) &&
                  item.status === 'Accepted'
              );
              if (solved) setIsCompleted(true);
            }
          });
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, problem?._id, problem?.slug, problem?.id]);

  // Handle code change and persist draft locally for current language
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (problem) {
      const draftKey = `codeforge_draft_${problem.slug || problem.id || id}_${language}`;
      localStorage.setItem(draftKey, newCode);
    }
  };

  // Handle switching programming language and restoring language-specific draft
  const handleLanguageChange = (newLang) => {
    const canonicalNew = normalizeLanguageId(newLang);
    if (canonicalNew === language) return;

    // Save current code to draft for current language
    if (problem) {
      const currentDraftKey = `codeforge_draft_${problem.slug || problem.id || id}_${language}`;
      localStorage.setItem(currentDraftKey, code);
    }

    // Check if new language has a saved draft
    const newDraftKey = `codeforge_draft_${problem?.slug || problem?.id || id}_${canonicalNew}`;
    const legacyDraftKey = `codeforge_draft_${problem?.slug || problem?.id || id}`;
    const savedDraft =
      localStorage.getItem(newDraftKey) ??
      (canonicalNew === 'javascript' ? localStorage.getItem(legacyDraftKey) : null);

    setLanguage(canonicalNew);
    if (savedDraft !== null) {
      setCode(savedDraft);
    } else {
      setCode(getStarterCodeForProblem(problem, canonicalNew));
    }
    setExecutionResults(null);
  };

  // Reset code back to default starter code for current language
  const handleResetCode = () => {
    if (!problem) return;
    const starter = getStarterCodeForProblem(problem, language);
    setCode(starter);
    const draftKey = `codeforge_draft_${problem.slug || problem.id || id}_${language}`;
    const legacyDraftKey = `codeforge_draft_${problem.slug || problem.id || id}`;
    localStorage.removeItem(draftKey);
    if (language === 'javascript') {
      localStorage.removeItem(legacyDraftKey);
    }
    setExecutionResults(null);
  };

  // Run Code handler -> POST /api/code/run
  const handleRunCode = async () => {
    if (isRunning || isSubmitting) return;
    setIsRunning(true);
    setExecutionResults(null);

    const problemKey = problem?._id || problem?.slug || id;
    const res = await runCode({
      language,
      sourceCode: code,
      problemId: problemKey
    });

    if (res.ok && res.data) {
      setExecutionResults(res.data);
    } else {
      const isRejected = res.status === 400;
      setExecutionResults({
        verdict: isRejected ? 'Submission Rejected' : (res.data?.verdict || 'Sandbox Unavailable'),
        status: isRejected ? 'MALFORMED_SUBMISSION' : (res.data?.status || 'SANDBOX_UNAVAILABLE'),
        stderr: res.data?.message || (isRejected ? 'Code execution payload was rejected.' : 'Code execution request failed.'),
        executionDuration: 0,
        sandboxAvailable: isRejected ? true : false,
        setupGuide: isRejected ? null : (res.data?.setupGuide || sandboxStatus.setupGuide)
      });
    }

    setIsRunning(false);
  };

  // Submit Solution handler -> POST /api/code/submit
  const handleSubmitCode = async () => {
    if (isRunning || isSubmitting) return;

    if (!isAuthenticated) {
      setExecutionResults({
        verdict: 'Authentication Required',
        status: 'AUTH_REQUIRED',
        stderr: 'Please log in to submit your solution and record your verified progress in MongoDB.',
        executionDuration: 0
      });
      return;
    }

    setIsSubmitting(true);
    setExecutionResults(null);

    const problemKey = problem?._id || problem?.slug || id;
    const res = await submitCode({
      language,
      sourceCode: code,
      problemId: problemKey
    });

    if (res.ok && res.data) {
      setExecutionResults(res.data);
      if (res.data.verdict === 'Accepted') {
        setIsCompleted(true);
        setProgressMessage('Problem accepted! All test cases passed.');
      }
      setSubmissionsTrigger((prev) => prev + 1);
    } else {
      const isRejected = res.status === 400;
      setExecutionResults({
        verdict: isRejected ? 'Submission Rejected' : (res.data?.verdict || 'Sandbox Unavailable'),
        status: isRejected ? 'MALFORMED_SUBMISSION' : (res.data?.status || 'SUBMISSION_FAILED'),
        stderr: res.data?.message || (isRejected ? 'Submission payload was rejected by validation.' : 'Submission could not be evaluated.'),
        executionDuration: 0,
        sandboxAvailable: isRejected ? true : false,
        setupGuide: isRejected ? null : (res.data?.setupGuide || sandboxStatus.setupGuide)
      });
      setSubmissionsTrigger((prev) => prev + 1);
    }

    setIsSubmitting(false);
  };

  // Handle Manual Mark as Completed
  const handleMarkCompleted = async () => {
    if (!isAuthenticated) {
      setProgressMessage('Authentication is required to save progress.');
      return;
    }
    if (!problem?._id) return;

    setIsTogglingProgress(true);
    setProgressMessage(null);
    const res = await markProblemCompleted(problem._id);
    setIsTogglingProgress(false);

    if (res.ok && res.data?.success) {
      setIsCompleted(true);
      setProgressMessage('Progress saved successfully.');
    } else {
      setProgressMessage(res.data?.message || 'Failed to update progress.');
    }
  };

  // Handle Manual Mark as Incomplete
  const handleMarkIncomplete = async () => {
    if (!isAuthenticated || !problem?._id) return;

    setIsTogglingProgress(true);
    setProgressMessage(null);
    const res = await unmarkProblemCompleted(problem._id);
    setIsTogglingProgress(false);

    if (res.ok && res.data?.success) {
      setIsCompleted(false);
      setProgressMessage('Problem marked as incomplete.');
    } else {
      setProgressMessage(res.data?.message || 'Failed to update progress.');
    }
  };

  if (isLoadingProblem && !problem) {
    return (
      <div className="container py-5 text-center">
        <div className="card shadow-sm border-0 p-5 col-12 col-md-8 col-lg-6 mx-auto">
          <div className="spinner-border text-primary mx-auto mb-3" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <h4 className="fw-bold text-dark">Loading Problem Details...</h4>
          <p className="text-secondary small mb-0">Retrieving challenge specifications from MongoDB</p>
        </div>
      </div>
    );
  }

  if (loadError && !problem) {
    return (
      <div className="container py-5 text-center">
        <div className="card shadow-sm border-0 p-5 col-12 col-md-8 col-lg-6 mx-auto">
          <div className="mb-3 text-secondary">
            <Icon name="search" size={48} />
          </div>
          <h2 className="h4 fw-bold text-dark mb-2">Problem Not Found</h2>
          <p className="text-secondary mb-4">{loadError}</p>
          <Link to="/practice" className="btn btn-primary px-4 fw-semibold mx-auto">
            &larr; Back to Practice
          </Link>
        </div>
      </div>
    );
  }

  if (!problem) return null;

  return (
    <div className="container-fluid px-lg-5 py-4">
      {/* NAVIGATION CRUMB & ENVIRONMENT STATUS */}
      <div className="mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <Link to="/practice" className="btn btn-outline-secondary btn-sm px-3">
          &larr; Back to Problem Catalog
        </Link>
        <div className="d-flex align-items-center gap-2">
          {sandboxStatus.sandboxAvailable ? (
            <span className="badge bg-success-subtle text-success border border-success-subtle small px-2 py-1 d-inline-flex align-items-center gap-1">
              <Icon name="check-circle" size={13} /> Docker Sandbox Active
            </span>
          ) : (
            <span className="badge bg-warning-subtle text-dark border border-warning-subtle small px-2 py-1 d-inline-flex align-items-center gap-1">
              <Icon name="alert-triangle" size={13} /> Docker Sandbox Offline
            </span>
          )}
          <span className="badge bg-light text-secondary border small">
            MongoDB Synchronized
          </span>
        </div>
      </div>

      <div className="row g-4">
        {/* LEFT COLUMN: PROBLEM SPECIFICATION & SUBMISSIONS */}
        <div className="col-12 col-xl-5">
          <div className="card shadow-sm border-0">
            <div className="card-body p-4 p-md-4">
              {/* TITLE & DIFFICULTY & MANUAL COMPLETION */}
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h1 className="h3 fw-bold text-dark mb-1">{problem.title}</h1>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <span className={`badge ${getDifficultyBadgeClass(problem.difficulty)} px-2 py-1`}>
                      {problem.difficulty}
                    </span>
                    <span className="badge bg-body-secondary text-body border font-monospace small">
                      {problem.language || 'JavaScript'}
                    </span>
                    {problem.topic && (
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                        {problem.topic}
                      </span>
                    )}
                  </div>
                </div>

                <div className="d-flex align-items-center gap-1">
                  {isCompleted && (
                    <span className="badge bg-success text-white px-3 py-2 small fw-semibold d-inline-flex align-items-center gap-1">
                      <Icon name="check" size={13} /> Solved
                    </span>
                  )}
                </div>
              </div>

              {/* MANUAL PROGRESS OVERRIDE CONTROLS */}
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3 pt-2 border-top">
                {isAuthenticated ? (
                  <>
                    <button
                      type="button"
                      id="toggle-completion-btn"
                      onClick={handleMarkCompleted}
                      disabled={isTogglingProgress || isCompleted}
                      className={`btn ${isCompleted ? 'btn-success' : 'btn-outline-success'} btn-sm px-3 fw-semibold d-flex align-items-center gap-1`}
                    >
                      {isTogglingProgress && (
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                      )}
                      <span className="d-inline-flex align-items-center gap-1">
                        {isCompleted && <Icon name="check" size={13} />}
                        {isCompleted ? 'Completed' : 'Mark as Completed'}
                      </span>
                    </button>
                    {isCompleted && (
                      <button
                        type="button"
                        onClick={handleMarkIncomplete}
                        disabled={isTogglingProgress}
                        className="btn btn-outline-secondary btn-sm px-2 text-muted"
                        title="Mark problem as incomplete"
                      >
                        Mark as Incomplete
                      </button>
                    )}
                  </>
                ) : (
                  <Link to="/login" className="btn btn-outline-primary btn-sm px-3 small">
                    Log in to track progress
                  </Link>
                )}
              </div>

              {progressMessage && (
                <div className="alert alert-success alert-dismissible fade show py-2 px-3 mb-3 small" role="alert">
                  <span>{progressMessage}</span>
                  <button
                    type="button"
                    className="btn-close btn-close-sm"
                    onClick={() => setProgressMessage(null)}
                    aria-label="Close"
                  ></button>
                </div>
              )}

              {/* PROBLEM STATEMENT */}
              <div className="mb-4">
                <h2 className="h6 fw-bold text-dark mb-2">Description</h2>
                <p className="text-secondary small mb-0 lh-base">
                  {problem.description}
                </p>
              </div>

              {/* EXAMPLES */}
              {problem.examples && problem.examples.length > 0 && (
                <div className="mb-4">
                  <h2 className="h6 fw-bold text-dark mb-2">Examples</h2>
                  <div className="d-flex flex-column gap-2">
                    {problem.examples.map((ex, idx) => (
                      <div key={idx} className="p-3 bg-light rounded border small">
                        <div className="fw-bold text-dark mb-1">Example {idx + 1}:</div>
                        <div className="font-monospace text-secondary mb-1">
                          <strong>Input:</strong> {ex.input}
                        </div>
                        <div className="font-monospace text-success mb-1">
                          <strong>Output:</strong> {ex.output}
                        </div>
                        {ex.explanation && (
                          <div className="text-muted fst-italic">
                            <strong>Explanation:</strong> {ex.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CONSTRAINTS */}
              {problem.constraints && problem.constraints.length > 0 && (
                <div className="mb-3">
                  <h2 className="h6 fw-bold text-dark mb-2">Constraints</h2>
                  <ul className="list-group list-group-flush bg-transparent">
                    {problem.constraints.map((c, idx) => (
                      <li key={idx} className="list-group-item px-0 py-1 bg-transparent text-secondary small font-monospace">
                        • {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* SUBMISSION HISTORY TABLE */}
          {isAuthenticated && problem?._id && (
            <SubmissionHistory
              problemId={problem._id}
              refreshTrigger={submissionsTrigger}
            />
          )}
        </div>

        {/* RIGHT COLUMN: MONACO CODE EDITOR & EXECUTION RESULTS */}
        <div className="col-12 col-xl-7 d-flex flex-column">
          <React.Suspense
            fallback={
              <div
                className="card shadow-sm border-0 d-flex justify-content-center align-items-center bg-dark text-white p-5"
                style={{ minHeight: '420px', height: '100%' }}
                role="status"
                aria-live="polite"
              >
                <div className="spinner-border text-primary mb-2" role="status">
                  <span className="visually-hidden">Loading Code Editor...</span>
                </div>
                <span className="small text-muted">Loading Code Editor Workspace...</span>
              </div>
            }
          >
            <CodeEditor
              code={code}
              onChange={handleCodeChange}
              language={language}
              onLanguageChange={handleLanguageChange}
              onRun={handleRunCode}
              onSubmit={handleSubmitCode}
              onReset={handleResetCode}
              isRunning={isRunning}
              isSubmitting={isSubmitting}
              sandboxAvailable={sandboxStatus.sandboxAvailable}
              problemId={problem.slug || problem.id || id}
            />
          </React.Suspense>

          {/* EXECUTION RESULTS / TEST CASES / CONSOLE OUTPUT */}
          <ExecutionResults
            results={executionResults}
            setupGuide={sandboxStatus.setupGuide}
            sandboxAvailable={sandboxStatus.sandboxAvailable}
            isRunning={isRunning}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}

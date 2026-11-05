import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
  startDiagnosticSession,
  getLatestDiagnosticReport,
  submitDiagnosticSession,
  abandonDiagnosticSession
} from '../utils/api';
import { GOAL_MAP, LANGUAGE_MAP } from '../utils/learningPlan';
import Icon from '../components/Icons';

/**
 * Diagnostic Page Component (Milestone 15B)
 * Implements an evidence-based diagnostic assessment engine with pre-assessment guidance,
 * question-by-question flow, answer selection, review modal, and abandonment handling.
 */
export default function Diagnostic() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Session & question states
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // { [questionId]: optionIndex }
  const [currentIndex, setCurrentIndex] = useState(0);

  // UI flow states
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [existingReport, setExistingReport] = useState(null);

  // Check for any existing active session or previous report on mount
  useEffect(() => {
    let isMounted = true;
    getLatestDiagnosticReport()
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success && res.data.data) {
          const latest = res.data.data;
          if (latest.status === 'in_progress') {
            setSession(latest);
            setQuestions(latest.questions || []);
            // Restore any previously answered questions
            if (Array.isArray(latest.answers)) {
              const restored = {};
              for (const a of latest.answers) {
                if (typeof a.selectedOptionIndex === 'number' && a.selectedOptionIndex >= 0) {
                  restored[a.questionId] = a.selectedOptionIndex;
                }
              }
              setAnswers(restored);
            }
          } else {
            setExistingReport(latest);
          }
        }
      })
      .catch(() => {
        // Non-blocking
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle starting a fresh assessment session
  const handleStartSession = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await startDiagnosticSession();
      if (res.ok && res.data?.success && res.data.data) {
        const newSession = res.data.data;
        setSession(newSession);
        setQuestions(newSession.questions || []);
        setCurrentIndex(0);
        // If resuming with answers, hydrate them
        const restored = {};
        if (Array.isArray(newSession.answers)) {
          for (const a of newSession.answers) {
            if (typeof a.selectedOptionIndex === 'number' && a.selectedOptionIndex >= 0) {
              restored[a.questionId] = a.selectedOptionIndex;
            }
          }
        }
        setAnswers(restored);
      } else {
        setErrorMessage(res.data?.message || 'Failed to initialize diagnostic session.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error initializing session.');
    } finally {
      setIsLoading(false);
    }
  };

  // Select an option for the current question
  const handleSelectOption = (questionId, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  // Clear selection for current question
  const handleClearSelection = (questionId) => {
    setAnswers((prev) => {
      const updated = { ...prev };
      delete updated[questionId];
      return updated;
    });
  };

  // Handle final submission
  const handleSubmitAssessment = async () => {
    if (!session?._id) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    // Format answers array payload for backend
    const answersPayload = questions.map((q) => ({
      questionId: q.questionId,
      selectedOptionIndex: typeof answers[q.questionId] === 'number' ? answers[q.questionId] : -1
    }));

    try {
      const res = await submitDiagnosticSession(session._id, answersPayload);
      if (res.ok && res.data?.success && res.data.data) {
        setShowReviewModal(false);
        navigate(`/diagnostic/report/${res.data.data._id}`);
      } else {
        setErrorMessage(res.data?.message || 'Submission failed. Please check your connection.');
        setIsSubmitting(false);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error submitting diagnostic.');
      setIsSubmitting(false);
    }
  };

  // Handle session abandonment
  const handleAbandonSession = async () => {
    if (!session?._id) return;
    setIsLoading(true);
    setShowAbandonModal(false);
    try {
      await abandonDiagnosticSession(session._id);
      setSession(null);
      setQuestions([]);
      setAnswers({});
      setCurrentIndex(0);
    } catch {
      // Continue resetting local state
      setSession(null);
      setQuestions([]);
      setAnswers({});
    } finally {
      setIsLoading(false);
    }
  };

  // Derived counts
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const currentQuestion = questions[currentIndex];
  const progressPercentage = totalQuestions > 0 ? Math.round(((currentIndex + 1) / totalQuestions) * 100) : 0;

  // Topic badge color helper
  const getTopicBadgeColor = useCallback((topic) => {
    const t = (topic || '').toLowerCase();
    if (t.includes('script') || t.includes('javascript')) return 'primary';
    if (t.includes('data') || t.includes('algorithm')) return 'info';
    if (t.includes('operating') || t.includes('system')) return 'warning';
    if (t.includes('network')) return 'success';
    if (t.includes('cyber') || t.includes('security')) return 'danger';
    return 'secondary';
  }, []);

  // Difficulty badge color helper
  const getDifficultyBadgeColor = useCallback((diff) => {
    switch (diff) {
      case 'Easy':
        return 'success';
      case 'Medium':
        return 'warning';
      case 'Hard':
        return 'danger';
      default:
        return 'secondary';
    }
  }, []);

  if (isLoading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading diagnostic assessment...</span>
        </div>
        <p className="text-secondary mt-3">Loading diagnostic assessment...</p>
      </div>
    );
  }

  // 1. PRE-ASSESSMENT SCREEN (No in-progress session)
  if (!session || session.status !== 'in_progress') {
    const primaryGoal = user?.learningGoals?.[0];
    const goalConfig = primaryGoal ? GOAL_MAP[primaryGoal] : null;
    const primaryLang = user?.languages?.[0]?.language;
    const langConfig = primaryLang ? LANGUAGE_MAP[primaryLang] : null;

    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8">
            {/* Header */}
            <div className="text-center mb-5">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-2 fs-6 fw-semibold mb-3">
                Review &amp; Reassessment • Diagnostic Assessment
              </span>
              <h1 className="display-6 fw-bold text-dark mb-2">Evidence-Based Diagnostic Assessment</h1>
              <p className="lead text-secondary fs-6 mb-0">
                Benchmark your programming fundamentals, algorithmic thinking, and core systems knowledge without pass/fail pressure.
              </p>
            </div>

            {errorMessage && (
              <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                <Icon name="alert-triangle" size={16} className="me-2 flex-shrink-0" />
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Assessment Overview Card */}
            <div className="card shadow-sm border mb-4">
              <div className="card-body p-4 p-md-5">
                <h2 className="h5 fw-bold text-dark mb-3">What is this diagnostic assessment?</h2>
                <p className="text-secondary mb-4 lh-base">
                  CodeForge uses diagnostic assessments to discover genuine strengths and knowledge gaps.
                  Instead of assuming you are a beginner or forcing you through redundant lessons, this assessment
                  samples questions across computer science topics to adapt your personalized practice path.
                </p>

                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3 border h-100">
                      <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-1.5">
                        <Icon name="clock" size={16} className="text-primary" />
                        <span>Un-timed &amp; Thoughtful</span>
                      </div>
                      <small className="text-secondary">Take your time. We measure conceptual understanding, not typing speed.</small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3 border h-100">
                      <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-1.5">
                        <Icon name="target" size={16} className="text-primary" />
                        <span>Tailored Scope</span>
                      </div>
                      <small className="text-secondary">Selected based on your active goals and focus topics in onboarding.</small>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 bg-light rounded-3 border h-100">
                      <div className="fw-bold text-dark mb-1 d-flex align-items-center gap-1.5">
                        <Icon name="chart" size={16} className="text-primary" />
                        <span>Conservative Evidence</span>
                      </div>
                      <small className="text-secondary">Requires &ge; 2 questions per topic before declaring strength or revision needs.</small>
                    </div>
                  </div>
                </div>

                {/* Profile Summary Context */}
                <div className="p-3 rounded-3 bg-primary bg-opacity-10 border border-primary-subtle mb-4">
                  <h3 className="h6 fw-bold text-dark mb-2">Aligned With Your Profile:</h3>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    {goalConfig && (
                      <span className={`badge bg-${goalConfig.badgeColor}-subtle text-${goalConfig.badgeColor} border px-2.5 py-1.5`}>
                        {goalConfig.icon} Goal: {goalConfig.title}
                      </span>
                    )}
                    {langConfig && (
                      <span className="badge bg-light text-dark border px-2.5 py-1.5">
                        Language: {langConfig.name}
                      </span>
                    )}
                    {user?.selectedTopics && user.selectedTopics.length > 0 && (
                      <span className="badge bg-light text-secondary border px-2.5 py-1.5">
                        Focus: {user.selectedTopics.slice(0, 3).join(', ')}{user.selectedTopics.length > 3 ? '...' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* CTAs */}
                <div className="d-flex flex-column flex-sm-row gap-3 justify-content-between align-items-center pt-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-lg px-4 fw-semibold w-100 w-sm-auto d-inline-flex align-items-center justify-content-center gap-2"
                    onClick={handleStartSession}
                  >
                    <span>Start Diagnostic Assessment</span>
                    <Icon name="arrow-right" size={18} />
                  </button>

                  {existingReport && (
                    <Link
                      to={`/diagnostic/report/${existingReport._id}`}
                      className="btn btn-outline-secondary btn-lg px-4 fw-semibold w-100 w-sm-auto text-nowrap d-inline-flex align-items-center justify-content-center gap-2"
                    >
                      <Icon name="chart" size={18} />
                      <span>View Last Report</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Back link */}
            <div className="text-center">
              <Link to="/dashboard" className="text-decoration-none text-secondary small d-inline-flex align-items-center gap-1">
                <Icon name="arrow-left" size={12} />
                <span>Back to Learner Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. ACTIVE QUESTION RUNNER
  return (
    <div className="container py-4 py-md-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9">
          {/* Top Session Bar */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary px-2.5 py-1.5">Diagnostic Mode</span>
              <span className="text-secondary small fw-medium">
                {answeredCount} of {totalQuestions} Answered
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm fw-semibold"
              onClick={() => setShowAbandonModal(true)}
            >
              Quit / Abandon
            </button>
          </div>

          {/* Progress Bar & Question Jump Pills */}
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span className="small fw-semibold text-secondary">
                  Question {currentIndex + 1} of {totalQuestions}
                </span>
                <span className="small fw-bold text-primary font-monospace">
                  {progressPercentage}%
                </span>
              </div>
              <div className="progress mb-3" style={{ height: '6px' }} role="progressbar" aria-valuenow={progressPercentage} aria-valuemin="0" aria-valuemax="100">
                <div
                  className="progress-bar bg-primary transition-all"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>

              {/* Jump Pills */}
              <div className="d-flex flex-wrap gap-1">
                {questions.map((q, idx) => {
                  const isAnswered = typeof answers[q.questionId] === 'number';
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      className={`btn btn-sm px-2.5 py-1 ${
                        isCurrent
                          ? 'btn-primary fw-bold shadow-sm'
                          : isAnswered
                          ? 'btn-outline-success fw-medium'
                          : 'btn-outline-secondary'
                      }`}
                      style={{ minWidth: '34px', fontSize: '0.8rem' }}
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`Jump to question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Current Question Card */}
          {currentQuestion && (
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-body p-4 p-md-5">
                {/* Topic & Difficulty Badges */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className={`badge bg-${getTopicBadgeColor(currentQuestion.topic)}-subtle text-${getTopicBadgeColor(currentQuestion.topic)} border px-2.5 py-1.5`}>
                    {currentQuestion.topic}
                  </span>
                  <span className={`badge bg-${getDifficultyBadgeColor(currentQuestion.difficulty)}-subtle text-${getDifficultyBadgeColor(currentQuestion.difficulty)} border px-2.5 py-1.5`}>
                    {currentQuestion.difficulty}
                  </span>
                </div>

                {/* Question Prompt */}
                <h2 className="h4 fw-bold text-dark mb-4 lh-base">
                  {currentQuestion.question}
                </h2>

                {/* Option Choices */}
                <div className="d-flex flex-column gap-3 mb-4" role="radiogroup" aria-label={currentQuestion.question}>
                  {currentQuestion.options.map((optionText, optIdx) => {
                    const isSelected = answers[currentQuestion.questionId] === optIdx;
                    const optionInputId = `q-${currentQuestion.questionId}-opt-${optIdx}`;

                    return (
                      <div
                        key={optIdx}
                        className={`form-check d-flex align-items-center p-3 rounded-3 border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary bg-opacity-10 shadow-sm'
                            : 'border-light-subtle bg-body'
                        }`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSelectOption(currentQuestion.questionId, optIdx)}
                      >
                        <input
                          className="form-check-input ms-1 me-3 my-0 flex-shrink-0"
                          type="radio"
                          name={`diag-q-${currentQuestion.questionId}`}
                          id={optionInputId}
                          value={optIdx}
                          checked={isSelected}
                          onChange={() => handleSelectOption(currentQuestion.questionId, optIdx)}
                          aria-checked={isSelected}
                        />
                        <label
                          className="form-check-label w-100 mb-0 fw-medium text-dark"
                          htmlFor={optionInputId}
                          style={{ cursor: 'pointer' }}
                        >
                          <span className="badge bg-light text-secondary border me-2 font-monospace">
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          {optionText}
                        </label>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons for Current Question */}
                <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                  <div>
                    {typeof answers[currentQuestion.questionId] === 'number' && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleClearSelection(currentQuestion.questionId)}
                      >
                        Clear Choice
                      </button>
                    )}
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary px-3 fw-semibold"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    >
                      ← Previous
                    </button>

                    {currentIndex < totalQuestions - 1 ? (
                      <button
                        type="button"
                        className="btn btn-primary px-4 fw-semibold"
                        onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                      >
                        Next →
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-success px-4 fw-semibold"
                        onClick={() => setShowReviewModal(true)}
                      >
                        Review &amp; Submit ✓
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Review / Submit Bar at Bottom */}
          <div className="d-flex justify-content-between align-items-center p-3 bg-light rounded-3 border">
            <span className="small text-secondary">
              Need to finish later? Answers are safely stored in your session.
            </span>
            <button
              type="button"
              className="btn btn-primary btn-sm fw-semibold"
              onClick={() => setShowReviewModal(true)}
            >
              Review &amp; Submit Assessment
            </button>
          </div>
        </div>
      </div>

      {/* REVIEW & SUBMIT MODAL */}
      {showReviewModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Submit Diagnostic Assessment?</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowReviewModal(false)}
                  disabled={isSubmitting}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-secondary mb-3">
                  You are about to submit your diagnostic assessment for authoritative server scoring.
                </p>

                <div className="p-3 bg-light rounded-3 border mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-secondary small">Total Questions:</span>
                    <span className="fw-bold">{totalQuestions}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-success small">Answered Questions:</span>
                    <span className="fw-bold text-success">{answeredCount}</span>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-warning small">Unanswered Questions:</span>
                    <span className="fw-bold text-warning">{unansweredCount}</span>
                  </div>
                </div>

                {unansweredCount > 0 && (
                  <div className="alert alert-warning small mb-0" role="alert">
                    ⚠️ You have <strong>{unansweredCount}</strong> unanswered question(s). Unanswered questions receive 0 points and may lead to a &quot;Not Enough Evidence&quot; rating on affected topics.
                  </div>
                )}

                {errorMessage && (
                  <div className="alert alert-danger small mt-3 mb-0" role="alert">
                    {errorMessage}
                  </div>
                )}
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-outline-secondary fw-semibold"
                  onClick={() => setShowReviewModal(false)}
                  disabled={isSubmitting}
                >
                  Continue Answering
                </button>
                <button
                  type="button"
                  className="btn btn-primary fw-semibold"
                  onClick={handleSubmitAssessment}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Evaluating...
                    </>
                  ) : (
                    'Confirm & Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABANDON CONFIRMATION MODAL */}
      {showAbandonModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-danger">Abandon Diagnostic Session?</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAbandonModal(false)}
                  aria-label="Close"
                ></button>
              </div>
              <div className="modal-body p-4">
                <p className="text-secondary mb-0">
                  Are you sure you want to quit this diagnostic session? Your progress will be discarded, and this session will be marked as abandoned. You can start a new session at any time.
                </p>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-outline-secondary fw-semibold"
                  onClick={() => setShowAbandonModal(false)}
                >
                  Keep Answering
                </button>
                <button
                  type="button"
                  className="btn btn-danger fw-semibold"
                  onClick={handleAbandonSession}
                >
                  Yes, Abandon Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

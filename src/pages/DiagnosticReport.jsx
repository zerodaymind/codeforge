import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDiagnosticSession, getLatestDiagnosticReport } from '../utils/api';
import Icon from '../components/Icons';

/**
 * DiagnosticReport Page Component (Milestone 15B)
 * Presents an authoritative, evidence-based diagnostic report:
 * 1. Conservative topic-level evidence ratings (Promising, Needs Revision, Not Enough Evidence).
 * 2. Unassessed topics transparency.
 * 3. Grounded next action recommendations linking to genuine quizzes and practice problems.
 * 4. Itemized question review with detailed explanations.
 */
export default function DiagnosticReport() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [filterReview, setFilterReview] = useState('all'); // 'all', 'incorrect', 'correct'

  useEffect(() => {
    let isMounted = true;

    const fetchPromise = id ? getDiagnosticSession(id) : getLatestDiagnosticReport();

    fetchPromise
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success && res.data.data) {
          setReport(res.data.data);
        } else {
          setErrorMessage(res.data?.message || 'Could not find diagnostic report.');
        }
      })
      .catch((err) => {
        if (isMounted) setErrorMessage(err.message || 'Network error fetching diagnostic report.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading diagnostic report...</span>
        </div>
        <p className="text-secondary mt-3">Compiling authoritative diagnostic assessment results...</p>
      </div>
    );
  }

  if (errorMessage || !report) {
    return (
      <div className="container py-5">
        <div className="card shadow-sm border text-center p-5">
          <div className="text-muted mb-3">
            <Icon name="clipboard" size={48} />
          </div>
          <h2 className="h4 fw-bold text-dark mb-2">Diagnostic Report Not Available</h2>
          <p className="text-secondary mb-4">
            {errorMessage || 'No diagnostic assessment session was found. Start a new assessment to benchmark your skills.'}
          </p>
          <div className="d-flex justify-content-center gap-2">
            <Link to="/diagnostic" className="btn btn-primary fw-semibold d-inline-flex align-items-center gap-1.5">
              <span>Take Diagnostic Assessment</span>
              <Icon name="arrow-right" size={14} />
            </Link>
            <Link to="/dashboard" className="btn btn-outline-secondary fw-semibold">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const {
    score = 0,
    maxScore = 0,
    percentage = 0,
    topicResults = [],
    unassessedTopics = [],
    recommendations = [],
    questions = [],
    createdAt
  } = report;

  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Recent Session';

  // Evidence badge styling helper
  const getEvidenceBadge = (status) => {
    switch (status) {
      case 'promising':
        return {
          label: 'Promising (Solid Grasp)',
          color: 'success',
          icon: 'check-circle',
          summary: 'Demonstrated reliable conceptual mastery in this diagnostic sample.'
        };
      case 'needs_revision':
        return {
          label: 'Needs Revision',
          color: 'warning',
          icon: 'alert',
          summary: 'Foundational gaps identified. High priority for targeted review.'
        };
      case 'not_enough_evidence':
      default:
        return {
          label: 'Not Enough Evidence',
          color: 'secondary',
          icon: 'circle',
          summary: 'Fewer than 2 questions answered. Cannot draw a confident conclusion.'
        };
    }
  };

  // Filtered review questions
  const filteredQuestions = questions.filter((q) => {
    if (filterReview === 'correct') return q.isCorrect;
    if (filterReview === 'incorrect') return !q.isCorrect;
    return true;
  });

  return (
    <div className="container py-5">
      {/* 1. HEADER SECTION */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 pb-3 border-bottom gap-3">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1">
              Assessment Completed
            </span>
            <span className="text-secondary small">{formattedDate}</span>
          </div>
          <h1 className="display-6 fw-bold text-dark mb-0">Diagnostic Assessment Report</h1>
        </div>
        <div className="d-flex gap-2">
          <Link to="/diagnostic" className="btn btn-outline-primary fw-semibold d-inline-flex align-items-center gap-1.5">
            <Icon name="refresh" size={14} />
            <span>Retake Diagnostic</span>
          </Link>
          <Link to="/dashboard" className="btn btn-primary fw-semibold d-inline-flex align-items-center gap-1">
            <span>Dashboard</span>
            <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      </div>

      {/* 2. OVERALL SCORE CARD */}
      <div className="card shadow-sm border mb-5">
        <div className="card-body p-4 p-md-5">
          <div className="row g-4 align-items-center">
            {/* Score & Percentage */}
            <div className="col-12 col-md-5 text-center text-md-start border-end-md">
              <span className="text-secondary small fw-bold text-uppercase d-block mb-1">
                Authoritative Score
              </span>
              <div className="display-4 fw-bold text-primary font-monospace mb-1">
                {score} <span className="fs-3 text-secondary fw-normal">/ {maxScore}</span>
              </div>
              <div className="d-flex align-items-center gap-2 justify-content-center justify-content-md-start mb-3">
                <span className={`badge ${percentage >= 70 ? 'bg-success' : percentage >= 50 ? 'bg-warning text-dark' : 'bg-danger'} px-3 py-1.5 fs-6`}>
                  {percentage}% Accuracy
                </span>
                <span className="text-secondary small">
                  ({questions.filter((q) => q.isCorrect).length} of {questions.length} correct)
                </span>
              </div>
              <p className="text-secondary small mb-0">
                Authoritative server-side evaluation. Topic evidence ratings below identify where to focus your practice.
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="col-12 col-md-7">
              <div className="row g-3">
                <div className="col-6">
                  <div className="p-3 bg-light rounded-3 border h-100">
                    <span className="text-secondary small fw-semibold text-uppercase d-block mb-1">
                      Topics Assessed
                    </span>
                    <span className="fs-4 fw-bold text-dark font-monospace">
                      {topicResults.length}
                    </span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 bg-light rounded-3 border h-100">
                    <span className="text-secondary small fw-semibold text-uppercase d-block mb-1">
                      Unassessed Gaps
                    </span>
                    <span className="fs-4 fw-bold text-dark font-monospace">
                      {unassessedTopics.length}
                    </span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 bg-success bg-opacity-10 rounded-3 border border-success-subtle h-100">
                    <span className="text-success small fw-semibold text-uppercase d-block mb-1">
                      Promising Topics
                    </span>
                    <span className="fs-4 fw-bold text-success font-monospace">
                      {topicResults.filter((t) => t.evidenceStatus === 'promising').length}
                    </span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 bg-warning bg-opacity-10 rounded-3 border border-warning-subtle h-100">
                    <span className="text-warning-emphasis small fw-semibold text-uppercase d-block mb-1">
                      Needs Revision
                    </span>
                    <span className="fs-4 fw-bold text-warning font-monospace">
                      {topicResults.filter((t) => t.evidenceStatus === 'needs_revision').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONSERVATIVE TOPIC EVIDENCE SECTION */}
      <div className="card shadow-sm border-0 mb-5">
        <div className="card-header bg-white border-bottom py-3">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
            <div>
              <h2 className="h5 fw-bold text-dark mb-0">Topic Knowledge Evidence</h2>
              <small className="text-muted">Conservative evidence evaluation across assessed domains</small>
            </div>
            <span className="badge bg-light text-secondary border px-2.5 py-1 small">
              Minimum 2 questions / topic
            </span>
          </div>
        </div>
        <div className="card-body p-4">
          {/* Conservative threshold disclosure */}
          <div className="alert alert-info border-info-subtle small d-flex align-items-start gap-2 mb-4" role="alert">
            <Icon name="help-circle" size={18} className="text-info flex-shrink-0 mt-0.5" />
            <div>
              <strong>Conservative Evidence Model:</strong> CodeForge requires at least 2 questions answered in a topic before declaring a status. Topics with fewer than 2 answered questions are transparently marked as <em>Not Enough Evidence</em> rather than falsely declaring mastery or deficiency.
            </div>
          </div>

          <div className="row g-4">
            {topicResults.map((t) => {
              const badge = getEvidenceBadge(t.evidenceStatus);
              return (
                <div key={t.topic} className="col-12 col-md-6 col-lg-4">
                  <div className="card h-100 border rounded-3 p-3 shadow-none bg-light">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h3 className="h6 fw-bold text-dark mb-0">{t.topic}</h3>
                      <span className={`badge bg-${badge.color}-subtle text-${badge.color} border border-${badge.color}-subtle small d-inline-flex align-items-center gap-1`}>
                        <Icon name={badge.icon} size={12} />
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="small text-secondary">
                        {t.correct} of {t.totalQuestions} correct ({t.totalQuestions > 0 ? Math.round((t.correct / t.totalQuestions) * 100) : 0}%)
                      </span>
                      <span className="small text-muted font-monospace">{t.score} / {t.maxScore} pts</span>
                    </div>

                    {/* Topic Progress Bar */}
                    <div className="progress mb-2" style={{ height: '6px' }}>
                      <div
                        className={`progress-bar bg-${badge.color}`}
                        style={{ width: `${t.totalQuestions > 0 ? (t.correct / t.totalQuestions) * 100 : 0}%` }}
                      ></div>
                    </div>

                    <p className="text-secondary small mb-0 mt-auto pt-2 border-top">
                      {badge.summary}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. UNASSESSED TOPICS SECTION (If any exist) */}
      {unassessedTopics.length > 0 && (
        <div className="card shadow-sm border-0 mb-5">
          <div className="card-header bg-white border-bottom py-3">
            <h2 className="h6 fw-bold text-dark mb-0">Unassessed Focus Topics</h2>
            <small className="text-muted">Topics from your profile not evaluated in this session</small>
          </div>
          <div className="card-body p-4">
            <p className="text-secondary small mb-3">
              We uphold transparent reporting: the following topics selected in your onboarding preferences were not sampled in this assessment. We report them honestly rather than guessing your proficiency.
            </p>
            <div className="row g-3">
              {unassessedTopics.map((u) => (
                <div key={u.topic} className="col-12 col-md-6">
                  <div className="p-3 bg-light rounded-3 border">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-semibold text-dark">{u.topic}</span>
                      <span className="badge bg-secondary-subtle text-secondary border small">
                        Not Assessed
                      </span>
                    </div>
                    <small className="text-muted">{u.reason}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. GROUNDED NEXT ACTIONS & RECOMMENDATIONS */}
      <div className="card shadow-sm border-0 mb-5">
        <div className="card-header bg-white border-bottom py-3">
          <h2 className="h5 fw-bold text-dark mb-0">Recommended Next Steps</h2>
          <small className="text-muted">Grounded in your diagnostic performance and identified gaps</small>
        </div>
        <div className="card-body p-4">
          <div className="row g-4">
            {recommendations.map((rec, idx) => (
              <div key={idx} className="col-12 col-md-4">
                <div className="p-4 bg-light rounded-3 border h-100 d-flex flex-column justify-content-between">
                  <div>
                    <span className="badge bg-primary px-2.5 py-1 small mb-2">{rec.type}</span>
                    <h3 className="h6 fw-bold text-dark mb-2">{rec.title}</h3>
                    <p className="text-secondary small mb-3">{rec.reason}</p>
                  </div>
                  <div>
                    <Link to={rec.link} className="btn btn-outline-primary btn-sm w-100 fw-semibold">
                      {rec.title.includes('Quiz') ? 'Take Quiz →' : 'Start Practice →'}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6. ITEMIZED QUESTION REVIEW WITH EXPLANATIONS */}
      <div className="card shadow-sm border-0 mb-5">
        <div className="card-header bg-white border-bottom py-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
          <div>
            <h2 className="h5 fw-bold text-dark mb-0">Detailed Question Review &amp; Explanations</h2>
            <small className="text-muted">Examine authoritative explanations for every question</small>
          </div>
          <div className="btn-group btn-group-sm" role="group" aria-label="Review filter">
            <button
              type="button"
              className={`btn ${filterReview === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterReview('all')}
            >
              All ({questions.length})
            </button>
            <button
              type="button"
              className={`btn ${filterReview === 'incorrect' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterReview('incorrect')}
            >
              Needs Work ({questions.filter((q) => !q.isCorrect).length})
            </button>
            <button
              type="button"
              className={`btn ${filterReview === 'correct' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setFilterReview('correct')}
            >
              Correct ({questions.filter((q) => q.isCorrect).length})
            </button>
          </div>
        </div>

        <div className="card-body p-4">
          <div className="d-flex flex-column gap-4">
            {filteredQuestions.map((q, idx) => {
              const selectedIdx = q.selectedOptionIndex;
              const hasAnswered = typeof selectedIdx === 'number' && selectedIdx >= 0;
              const selectedOptionText = hasAnswered && q.options ? q.options[selectedIdx] : 'Unanswered';

              return (
                <div
                  key={q.questionId}
                  className={`card border rounded-3 p-4 ${
                    q.isCorrect ? 'border-success-subtle bg-success bg-opacity-10' : 'border-danger-subtle bg-danger bg-opacity-10'
                  }`}
                >
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="badge bg-dark font-monospace">Q{idx + 1}</span>
                      <span className="badge bg-light text-dark border">{q.topic}</span>
                      <span className="badge bg-light text-secondary border">{q.difficulty}</span>
                    </div>
                    <span className={`badge ${q.isCorrect ? 'bg-success' : 'bg-danger'} px-2.5 py-1.5`}>
                      {q.isCorrect ? 'Correct ✓' : 'Incorrect ✕'}
                    </span>
                  </div>

                  <h3 className="h6 fw-bold text-dark mb-3 lh-base">
                    {q.question}
                  </h3>

                  {/* Options state */}
                  <div className="row g-2 mb-3">
                    <div className="col-12 col-md-6">
                      <div className="p-2.5 rounded border bg-white small">
                        <span className="text-secondary d-block fw-semibold mb-1">Your Answer:</span>
                        <span className={q.isCorrect ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                          {selectedOptionText}
                        </span>
                      </div>
                    </div>
                    <div className="col-12 col-md-6">
                      <div className="p-2.5 rounded border bg-white small">
                        <span className="text-secondary d-block fw-semibold mb-1">Correct Answer:</span>
                        <span className="text-success fw-bold">
                          {q.answer}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Explanation */}
                  {q.explanation && (
                    <div className="p-3 rounded-3 bg-white border border-light-subtle small">
                      <span className="fw-bold text-dark d-block mb-1">💡 Technical Explanation:</span>
                      <p className="text-secondary mb-0">{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 7. FOOTER CTAs */}
      <div className="d-flex justify-content-between align-items-center pt-3 border-top">
        <Link to="/dashboard" className="text-secondary small text-decoration-none">
          ← Back to Learner Dashboard
        </Link>
        <div className="d-flex gap-2">
          <Link to="/practice" className="btn btn-outline-primary fw-semibold">
            Solve Practice Problems
          </Link>
          <Link to="/quiz" className="btn btn-primary fw-semibold">
            Explore Quizzes
          </Link>
        </div>
      </div>
    </div>
  );
}

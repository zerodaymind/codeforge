import React, { useMemo, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getQuizAttempt } from '../utils/api';
import Icon from '../components/Icons';

/**
 * QuizResult Page Component
 * Renders the authoritative score breakdown, passing status, and an itemized answer review
 * with explanations for every question, fetched reliably from MongoDB via attemptId.
 */
export default function QuizResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptIdParam = searchParams.get('attemptId');
  const { isAuthenticated } = useAuth();

  const [dbAttempt, setDbAttempt] = useState(null);
  const [isLoadingAttempt, setIsLoadingAttempt] = useState(Boolean(attemptIdParam));
  const [fetchError, setFetchError] = useState(null);

  // 1. Fetch authoritative attempt from MongoDB if attemptId is present
  useEffect(() => {
    if (attemptIdParam && isAuthenticated) {
      let isMounted = true;
      getQuizAttempt(attemptIdParam)
        .then((res) => {
          if (isMounted) {
            if (res.ok && res.data?.success && res.data.data) {
              setDbAttempt(res.data.data);
            } else {
              setFetchError(res.data?.message || 'Could not load authoritative attempt record.');
            }
          }
        })
        .catch((err) => {
          if (isMounted) setFetchError(err.message || 'Network error fetching attempt.');
        })
        .finally(() => {
          if (isMounted) setIsLoadingAttempt(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [attemptIdParam, isAuthenticated]);

  // 2. Normalized result data (prefer dbAttempt, then location.state, then sessionStorage)
  const resultData = useMemo(() => {
    if (dbAttempt) {
      return {
        quizTitle: dbAttempt.quizTitle,
        quizId: dbAttempt.quizId,
        topic: dbAttempt.topic,
        difficulty: dbAttempt.difficulty,
        totalQuestions: dbAttempt.maxScore || (dbAttempt.reviewData?.length) || 10,
        correctAnswers: dbAttempt.correctAnswers,
        incorrectAnswers: dbAttempt.incorrectAnswers,
        unanswered: dbAttempt.unanswered || 0,
        scorePercentage: dbAttempt.percentage,
        durationSeconds: dbAttempt.durationSeconds,
        status: dbAttempt.percentage >= 70 ? 'Passed' : 'Needs Practice',
        reviewData: dbAttempt.reviewData || []
      };
    }

    if (location.state?.attempt) {
      const att = location.state.attempt;
      return {
        quizTitle: att.quizTitle,
        quizId: att.quizId,
        topic: att.topic,
        difficulty: att.difficulty,
        totalQuestions: att.maxScore || (att.reviewData?.length) || 10,
        correctAnswers: att.correctAnswers,
        incorrectAnswers: att.incorrectAnswers,
        unanswered: att.unanswered || 0,
        scorePercentage: att.percentage,
        durationSeconds: att.durationSeconds,
        status: att.percentage >= 70 ? 'Passed' : 'Needs Practice',
        reviewData: att.reviewData || []
      };
    }

    if (location.state) return location.state;

    try {
      const saved = sessionStorage.getItem('codeforge_quiz_result');
      if (saved) return JSON.parse(saved);
    } catch {
      // Ignore parse errors
    }

    return null;
  }, [dbAttempt, location.state]);

  const handleRetakeQuiz = () => {
    const targetQuizId = resultData?.quizId || 'javascript-fundamentals';
    navigate(`/quiz?quizId=${targetQuizId}`);
  };

  if (isLoadingAttempt) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading verified result...</span>
        </div>
        <p className="text-secondary mt-2">Loading your verified score from MongoDB...</p>
      </div>
    );
  }

  // If no result is available, show a helpful fallback prompt
  if (!resultData) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-6">
            <div className="card shadow-sm border text-center p-4 p-md-5">
              <div className="card-body">
                <div className="text-muted mb-3">
                  <Icon name="clipboard" size={48} />
                </div>
                <h2 className="h4 fw-bold text-dark mb-2">No Quiz Result Found</h2>
                <p className="text-secondary mb-4">
                  {fetchError || "You haven't completed an assessment yet. Browse our quizzes and start an evaluation!"}
                </p>
                <Link to="/quiz" className="btn btn-primary px-4 py-2 fw-semibold d-inline-flex align-items-center gap-1.5">
                  <span>Browse Quizzes</span>
                  <Icon name="arrow-right" size={14} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    quizTitle = 'Assessment Quiz',
    topic,
    difficulty,
    totalQuestions = 10,
    correctAnswers = 0,
    incorrectAnswers = 0,
    unanswered = 0,
    scorePercentage = 0,
    durationSeconds,
    status = scorePercentage >= 70 ? 'Passed' : 'Needs Practice',
    reviewData = []
  } = resultData;

  const isPassed = status === 'Passed' || scorePercentage >= 70;

  // Format duration into mm:ss
  const formatDuration = (secs) => {
    if (secs === undefined || secs === null) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9 col-xl-8">
          {/* Header Card */}
          <div className="card shadow-sm border-0 mb-4 overflow-hidden">
            <div className={`p-4 text-center ${isPassed ? 'bg-success text-white' : 'bg-warning text-dark'} bg-opacity-10 border-bottom`}>
              <div className="d-flex justify-content-center align-items-center gap-2 mb-2">
                {topic && <span className="badge bg-secondary">{topic}</span>}
                {difficulty && <span className="badge bg-dark">{difficulty}</span>}
              </div>
              <h1 className="h3 fw-bold mb-1 text-dark">{quizTitle}</h1>
              <p className="text-secondary small mb-3">Authoritative Server-Verified Score</p>

              <div className="display-4 fw-bold text-dark mb-1">
                {scorePercentage}%
              </div>
              <span className={`badge ${isPassed ? 'bg-success' : 'bg-warning text-dark'} fs-6 px-3 py-2 fw-semibold shadow-sm`}>
                {status}
              </span>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="card-body p-4">
              <div className="row g-3 text-center mb-4">
                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded border">
                    <span className="small text-muted d-block mb-1">Total Score</span>
                    <strong className="fs-5 text-dark">
                      {correctAnswers} / {totalQuestions}
                    </strong>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded border">
                    <span className="small text-success d-block mb-1">Correct</span>
                    <strong className="fs-5 text-success">{correctAnswers}</strong>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded border">
                    <span className="small text-danger d-block mb-1">Incorrect</span>
                    <strong className="fs-5 text-danger">{incorrectAnswers}</strong>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <div className="p-3 bg-light rounded border">
                    <span className="small text-secondary d-block mb-1">
                      {durationSeconds !== undefined ? 'Duration' : 'Unanswered'}
                    </span>
                    <strong className="fs-5 text-dark">
                      {durationSeconds !== undefined ? formatDuration(durationSeconds) : unanswered}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="d-flex flex-wrap justify-content-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-semibold"
                  onClick={handleRetakeQuiz}
                >
                  Retake Quiz
                </button>
                {isAuthenticated && (
                  <Link to="/quiz/history" className="btn btn-outline-primary px-4 fw-medium">
                    View Quiz History
                  </Link>
                )}
                <Link to="/quiz" className="btn btn-outline-secondary px-4 fw-medium">
                  Browse All Quizzes
                </Link>
              </div>
            </div>
          </div>

          {/* Itemized Question Review Section */}
          {reviewData && reviewData.length > 0 && (
            <div className="card shadow-sm border-0 mb-4">
              <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                <h2 className="h5 fw-bold text-dark mb-0">Detailed Question Review</h2>
                <span className="badge bg-primary-subtle text-primary">
                  {reviewData.length} Questions Evaluated
                </span>
              </div>
              <div className="card-body p-4">
                <div className="d-flex flex-column gap-4">
                  {reviewData.map((item, index) => {
                    const isCorrect = item.isCorrect;
                    const userAns = item.selectedOption || item.userAnswer || item.selectedAnswer || 'Not Answered';
                    const correctAns = item.correctAnswer;

                    return (
                      <div
                        key={item.questionId || item.id || index}
                        className={`p-3 p-md-4 rounded border ${
                          isCorrect
                            ? 'border-success-subtle bg-success bg-opacity-10'
                            : 'border-danger-subtle bg-danger bg-opacity-10'
                        }`}
                      >
                        <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
                          <span className="badge bg-secondary small">
                            Question {index + 1}
                          </span>
                          <span
                            className={`badge ${
                              isCorrect ? 'bg-success' : 'bg-danger'
                            } fw-semibold`}
                          >
                            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                        </div>

                        <h3 className="h6 fw-bold text-dark mb-3">
                          {item.question}
                        </h3>

                        <div className="row g-2 mb-3 small">
                          <div className="col-12 col-md-6">
                            <div className="p-2 bg-white rounded border">
                              <span className="text-muted d-block">Your Answer:</span>
                              <strong className={isCorrect ? 'text-success' : 'text-danger'}>
                                {userAns}
                              </strong>
                            </div>
                          </div>
                          <div className="col-12 col-md-6">
                            <div className="p-2 bg-white rounded border">
                              <span className="text-muted d-block">Correct Answer:</span>
                              <strong className="text-success">{correctAns}</strong>
                            </div>
                          </div>
                        </div>

                        {item.explanation && (
                          <div className="p-3 bg-white rounded border border-light-subtle small">
                            <strong className="text-dark d-block mb-1">Explanation:</strong>
                            <p className="text-secondary mb-0">{item.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

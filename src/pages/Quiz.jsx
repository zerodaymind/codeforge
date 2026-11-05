import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import ProgressBar from '../components/ProgressBar';
import QuestionCard from '../components/QuestionCard';
import { useAuth } from '../context/useAuth';
import {
  getQuizzes,
  getQuiz,
  startQuizAttempt,
  submitQuizAttempt,
  getQuestions,
  submitQuiz
} from '../utils/api';
import questionsData from '../data/questions';

export default function Quiz() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuizId = searchParams.get('quizId');
  const { isAuthenticated } = useAuth();

  // Catalog State
  const [catalog, setCatalog] = useState([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(!activeQuizId);
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');

  // Active Quiz State
  const [quizDetails, setQuizDetails] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(Boolean(activeQuizId));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [currentAttemptId, setCurrentAttemptId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // 1. Fetch Catalog when on Catalog view (no activeQuizId)
  useEffect(() => {
    if (activeQuizId) return;

    let isMounted = true;
    getQuizzes({ limit: 50 })
      .then((res) => {
        if (isMounted && res.ok && res.data?.success && Array.isArray(res.data.data)) {
          setCatalog(res.data.data);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingCatalog(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeQuizId]);

  // 2. Fetch Active Quiz and Initiate/Resume Attempt
  useEffect(() => {
    if (!activeQuizId) return;

    let isMounted = true;

    // Fetch quiz from MongoDB
    getQuiz(activeQuizId)
      .then(async (res) => {
        if (!isMounted) return;
        setCurrentIndex(0);
        setSelectedAnswers({});
        setValidationError(null);


        if (res.ok && res.data?.success && res.data.data) {
          const quiz = res.data.data;
          setQuizDetails(quiz);
          const formattedQuestions = (quiz.questions || []).map((q) => ({
            id: q.questionId,
            questionId: q.questionId,
            topic: quiz.topic,
            question: q.question,
            options: q.options,
            points: q.points || 1
          }));
          setQuestions(formattedQuestions);

          // If authenticated, start or resume attempt in MongoDB
          if (isAuthenticated) {
            try {
              const attemptRes = await startQuizAttempt(activeQuizId);
              if (isMounted && attemptRes.ok && attemptRes.data?.attempt) {
                const attempt = attemptRes.data.attempt;
                setCurrentAttemptId(attempt._id);

                // If resuming, restore existing answers
                if (Array.isArray(attempt.selectedAnswers) && attempt.selectedAnswers.length > 0) {
                  const restored = {};
                  for (const ans of attempt.selectedAnswers) {
                    if (ans.selectedOption) {
                      restored[ans.questionId] = ans.selectedOption;
                    }
                  }
                  setSelectedAnswers(restored);
                }
              }
            } catch (err) {
              console.warn('[Quiz] Could not start server attempt:', err);
            }
          }
        } else {
          // Fallback to legacy questions endpoint if quizId is javascript-fundamentals
          if (activeQuizId === 'javascript-fundamentals') {
            const fallbackRes = await getQuestions();
            if (isMounted && fallbackRes.ok && fallbackRes.data?.questions) {
              setQuestions(fallbackRes.data.questions);
              setQuizDetails({
                title: 'JavaScript Fundamentals',
                topic: 'JavaScript',
                difficulty: 'Easy'
              });
            } else if (isMounted) {
              setQuestions(questionsData);
            }
          } else {
            setValidationError('Quiz not found or could not be loaded.');
          }
        }
      })
      .catch(() => {
        if (isMounted) setValidationError('Failed to load quiz details.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingQuiz(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeQuizId, isAuthenticated]);

  // Answer selection handler
  const handleSelectAnswer = (option) => {
    if (!questions[currentIndex]) return;
    const qId = questions[currentIndex].id ?? questions[currentIndex].questionId;
    setSelectedAnswers((prev) => ({
      ...prev,
      [qId]: option
    }));
    if (validationError) {
      setValidationError(null);
    }
  };

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(selectedAnswers).filter((k) => selectedAnswers[k]).length;

  // Move to previous
  const handlePrevious = () => {
    if (currentIndex > 0) {
      setValidationError(null);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Move to next
  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) {
      setValidationError(null);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  // Final submission handler
  const handleConfirmSubmit = async () => {
    if (!isAuthenticated) {
      setValidationError('You must be logged in to submit the quiz and record your verified score.');
      setShowReviewModal(false);
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      // 1. If we have an active server attemptId, submit via persistent quiz engine
      if (currentAttemptId) {
        const payload = Object.entries(selectedAnswers).map(([qId, option]) => ({
          questionId: Number(qId),
          selectedOption: option
        }));

        const res = await submitQuizAttempt(currentAttemptId, payload);

        if (res.ok && res.data?.success) {
          const attempt = res.data.attempt;
          navigate(`/quiz/result?attemptId=${attempt._id}`, { state: { attempt } });
          return;
        } else {
          setValidationError(res.data?.message || 'Error submitting attempt.');
          setIsSubmitting(false);
          setShowReviewModal(false);
          return;
        }
      }

      // 2. Fallback to legacy submission for backward compatibility
      const res = await submitQuiz(selectedAnswers);
      if (res.ok && res.data?.success) {
        const resultPayload = {
          totalQuestions: res.data.result.totalQuestions || res.data.result.total,
          correctAnswers: res.data.result.correctAnswers || res.data.result.correct,
          incorrectAnswers: res.data.result.incorrectAnswers || res.data.result.incorrect,
          scorePercentage: res.data.result.scorePercentage || res.data.result.percentage,
          status: res.data.result.status,
          reviewData: res.data.review || res.data.reviewData,
          alreadyRecorded: true
        };
        try {
          sessionStorage.setItem('codeforge_quiz_result', JSON.stringify(resultPayload));
        } catch {
          // Ignore
        }
        navigate('/quiz/result', { state: resultPayload });
      } else {
        setValidationError(res.data?.message || 'Error submitting assessment.');
        setIsSubmitting(false);
        setShowReviewModal(false);
      }
    } catch {
      setValidationError('Network error occurred while submitting.');
      setIsSubmitting(false);
      setShowReviewModal(false);
    }
  };

  // ==========================================
  // VIEW 1: QUIZ CATALOG BROWSER
  // ==========================================
  if (!activeQuizId) {
    const topics = ['All', 'JavaScript', 'Data Structures & Algorithms', 'Operating Systems', 'Computer Networks', 'Cybersecurity'];
    const filteredCatalog = catalog.filter((q) => {
      const matchTopic = selectedTopic === 'All' || q.topic.toLowerCase() === selectedTopic.toLowerCase();
      const matchDiff = selectedDifficulty === 'All' || q.difficulty.toLowerCase() === selectedDifficulty.toLowerCase();
      return matchTopic && matchDiff;
    });

    return (
      <div className="container py-5">
        {/* Header */}
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 pb-3 border-bottom gap-3">
          <div>
            <h1 className="h2 fw-bold text-dark mb-1">Assessment Quizzes</h1>
            <p className="text-secondary mb-0">
              Test and certify your computer science knowledge with server-evaluated persistent quizzes.
            </p>
          </div>
          {isAuthenticated && (
            <Link to="/quiz/history" className="btn btn-outline-primary fw-medium">
              View My Quiz History &rarr;
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="card shadow-sm border-0 mb-4 bg-light">
          <div className="card-body p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
            {/* Topic Filter */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span className="small text-secondary fw-semibold me-1">Topic:</span>
              {topics.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`btn btn-sm ${
                    selectedTopic === t ? 'btn-primary text-white' : 'btn-outline-secondary'
                  } rounded-pill px-3`}
                  onClick={() => setSelectedTopic(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Difficulty Filter */}
            <div className="d-flex align-items-center gap-2">
              <span className="small text-secondary fw-semibold">Difficulty:</span>
              <select
                className="form-select form-select-sm w-auto"
                value={selectedDifficulty}
                aria-label="Filter by difficulty"
                onChange={(e) => setSelectedDifficulty(e.target.value)}
              >
                <option value="All">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>
        </div>

        {/* Catalog Grid */}
        {isLoadingCatalog ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading quizzes...</span>
            </div>
            <p className="text-secondary mt-2">Loading available quizzes...</p>
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center py-5 card border-0 shadow-sm">
            <div className="card-body py-5">
              <p className="text-secondary fs-5 mb-3">No quizzes match your selected filter.</p>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  setSelectedTopic('All');
                  setSelectedDifficulty('All');
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            {filteredCatalog.map((quiz) => {
              const diffBadgeColor =
                quiz.difficulty === 'Easy'
                  ? 'success'
                  : quiz.difficulty === 'Medium'
                  ? 'warning'
                  : 'danger';

              return (
                <div key={quiz.id} className="col-12 col-md-6 col-lg-4">
                  <div className="card h-100 shadow-sm border-0 d-flex flex-column hover-shadow transition-all">
                    <div className="card-body d-flex flex-column p-4">
                      <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
                        <span className="badge bg-secondary-subtle text-secondary small">
                          {quiz.topic}
                        </span>
                        <span className={`badge bg-${diffBadgeColor}-subtle text-${diffBadgeColor} small`}>
                          {quiz.difficulty}
                        </span>
                      </div>
                      <h2 className="h5 fw-bold text-dark mb-2">{quiz.title}</h2>
                      <p className="text-secondary small flex-grow-1 mb-3">
                        {quiz.description}
                      </p>
                      <div className="d-flex justify-content-between align-items-center pt-3 border-top mt-auto">
                        <span className="small text-muted">
                          <strong>{quiz.questionCount || 10}</strong> Questions
                        </span>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm px-3 fw-semibold"
                          onClick={() => setSearchParams({ quizId: quiz.id })}
                        >
                          Start Quiz &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: ACTIVE QUIZ TAKER
  // ==========================================
  if (isLoadingQuiz && questions.length === 0) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading quiz...</span>
        </div>
        <p className="text-secondary mt-2">Preparing your assessment environment...</p>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-10 col-lg-9 col-xl-8">
          {/* Header & Back Link */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <button
              type="button"
              className="btn btn-link text-decoration-none p-0 text-secondary small"
              onClick={() => setSearchParams({})}
            >
              &larr; Back to Quiz Catalog
            </button>
            <div className="small text-secondary">
              Answered: <strong className="text-primary">{answeredCount}</strong> / {totalQuestions}
            </div>
          </div>

          {/* Progress Header */}
          <ProgressBar
            current={currentIndex + 1}
            total={totalQuestions}
            topic={`${quizDetails?.title || 'Quiz'} (${quizDetails?.topic || 'Fundamentals'})`}
          />

          {/* Question Palette Navigation Bar */}
          <div className="card shadow-sm border-0 mb-4 p-3 bg-light">
            <div className="d-flex flex-wrap gap-2 align-items-center justify-content-center">
              {questions.map((q, idx) => {
                const qId = q.id ?? q.questionId;
                const isAnswered = Boolean(selectedAnswers[qId]);
                const isCurrent = idx === currentIndex;

                let btnClass = 'btn-outline-secondary';
                if (isCurrent) {
                  btnClass = isAnswered ? 'btn-primary' : 'btn-dark';
                } else if (isAnswered) {
                  btnClass = 'btn-success bg-opacity-75 text-white';
                }

                return (
                  <button
                    key={qId}
                    type="button"
                    className={`btn btn-sm ${btnClass} ${
                      isCurrent ? 'ring-2 border-2 border-primary fw-bold' : ''
                    } rounded-circle`}
                    style={{ width: '36px', height: '36px', padding: 0 }}
                    onClick={() => {
                      setValidationError(null);
                      setCurrentIndex(idx);
                    }}
                    title={`Question ${idx + 1} (${isAnswered ? 'Answered' : 'Unanswered'})`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Validation Notice Alert */}
          {validationError && (
            <div
              className="alert alert-warning py-2 px-3 small mb-3 d-flex align-items-center justify-content-between gap-2"
              role="alert"
            >
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold">✕</span>
                <span>{validationError}</span>
              </div>
              {!isAuthenticated && (
                <Link to="/login" className="btn btn-warning btn-sm fw-semibold text-dark">
                  Log In
                </Link>
              )}
            </div>
          )}

          {/* Question Card */}
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              selectedAnswer={selectedAnswers[currentQuestion.id ?? currentQuestion.questionId]}
              onSelectAnswer={handleSelectAnswer}
            />
          )}

          {/* Navigation Controls */}
          <div className="d-flex justify-content-between align-items-center mt-4">
            <button
              type="button"
              className="btn btn-outline-secondary px-4 fw-medium"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              &larr; Previous
            </button>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-primary px-3 fw-medium"
                onClick={() => setShowReviewModal(true)}
              >
                Review ({answeredCount}/{totalQuestions})
              </button>

              {currentIndex === totalQuestions - 1 ? (
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-semibold"
                  onClick={() => setShowReviewModal(true)}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Evaluating...
                    </>
                  ) : (
                    'Submit Quiz'
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-semibold"
                  onClick={handleNext}
                >
                  Next &rarr;
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review & Submit Modal */}
      {showReviewModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Review Quiz Submission</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowReviewModal(false)}
                />
              </div>
              <div className="modal-body p-4">
                <p className="mb-3">
                  You have answered <strong>{answeredCount}</strong> of{' '}
                  <strong>{totalQuestions}</strong> questions.
                </p>

                {answeredCount < totalQuestions && (
                  <div className="alert alert-warning py-2 small mb-3">
                    <strong>Notice:</strong> You have {totalQuestions - answeredCount} unanswered
                    question(s). Unanswered questions will receive 0 points.
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 mb-3">
                  {questions.map((q, idx) => {
                    const qId = q.id ?? q.questionId;
                    const isAnswered = Boolean(selectedAnswers[qId]);
                    return (
                      <span
                        key={qId}
                        className={`badge ${
                          isAnswered ? 'bg-success' : 'bg-secondary'
                        } p-2`}
                      >
                        Q{idx + 1}: {isAnswered ? 'Answered' : 'Skipped'}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowReviewModal(false)}
                  disabled={isSubmitting}
                >
                  Continue Answering
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4 fw-semibold"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      Evaluating on Server...
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
    </div>
  );
}

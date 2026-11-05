import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import {
  getProgress,
  getProblems,
  getMyProblemProgress,
  getAnalyticsOverview,
  getAnalyticsTopics,
  getAnalyticsTrends,
  getQuizAttempts,
  getLatestDiagnosticReport,
  getRoadmap,
  recalculateRoadmap,
  completeRoadmapRecommendation,
  getLatestComparison,
  getLearningState,
  getLearningRecommendations
} from '../utils/api';
import { problems } from '../data/problems.js';
import {
  GOAL_MAP,
  LANGUAGE_MAP,
  LANGUAGE_STATUS_MAP,
  getLearnerRecommendation
} from '../utils/learningPlan';
import RevisionRoadmap from '../components/RevisionRoadmap';
import LearningIntelligenceCard from '../components/LearningIntelligenceCard';
import AdaptivePracticePathways from '../components/AdaptivePracticePathways';
import Icon from '../components/Icons';

/**
 * Dashboard Page Component
 * Displays authenticated user progress metrics backed by MongoDB via GET /api/problems,
 * GET /api/problems/progress/me, GET /api/progress, and Milestone 12 Performance Analytics
 * (GET /api/analytics/overview, /api/analytics/topics, /api/analytics/trends, /api/quizzes/attempts).
 */
export default function Dashboard() {
  const { user } = useAuth();

  const [progress, setProgress] = useState({
    completedProblems: [],
    quizAttempts: []
  });
  const [problemProgress, setProblemProgress] = useState({
    totalAttempted: 0,
    solved: 0,
    incorrect: 0,
    byProblem: []
  });
  const [dbProblems, setDbProblems] = useState(problems);
  const [analyticsOverview, setAnalyticsOverview] = useState({
    totalCompletedAttempts: 0,
    averageScorePercentage: 0,
    bestScorePercentage: 0,
    recentPerformance: 0,
    distinctQuizzesAttempted: 0,
    totalCorrectAnswers: 0,
    totalIncorrectAnswers: 0,
    totalQuestionsAnswered: 0
  });
  const [analyticsTopics, setAnalyticsTopics] = useState({
    topics: [],
    strongestTopic: null,
    weakestTopic: null
  });
  const [analyticsTrends, setAnalyticsTrends] = useState([]);
  const [recentQuizAttempts, setRecentQuizAttempts] = useState([]);
  const [latestDiagnostic, setLatestDiagnostic] = useState(null);
  const [latestComparison, setLatestComparison] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [isRecalculatingRoadmap, setIsRecalculatingRoadmap] = useState(false);
  const [learningIntelligence, setLearningIntelligence] = useState(null);
  const [recommendationsPlan, setRecommendationsPlan] = useState(null);
  const [isRefreshingIntelligence, setIsRefreshingIntelligence] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Retrieve fallback session quiz attempt if no server attempt exists yet
  const [sessionQuiz] = useState(() => {
    try {
      const stored = sessionStorage.getItem('codeforge_quiz_result');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [dismissBanner, setDismissBanner] = useState(() => {
    try {
      return sessionStorage.getItem('codeforge_dismiss_onboarding_banner') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getProgress(),
      getProblems({ limit: 50 }),
      getMyProblemProgress(),
      getAnalyticsOverview(),
      getAnalyticsTopics(),
      getAnalyticsTrends(),
      getQuizAttempts({ limit: 5, status: 'submitted' }),
      getLatestDiagnosticReport(),
      getRoadmap(),
      getLatestComparison(),
      getLearningState(),
      getLearningRecommendations({ limit: 5 })
    ])
      .then(([
        progressRes,
        problemsRes,
        problemProgressRes,
        overviewRes,
        topicsRes,
        trendsRes,
        recentAttemptsRes,
        diagnosticRes,
        roadmapRes,
        comparisonRes,
        intelligenceRes,
        recommendationsRes
      ]) => {
        if (!isMounted) return;

        if (intelligenceRes && intelligenceRes.ok && intelligenceRes.data?.data) {
          setLearningIntelligence(intelligenceRes.data.data);
        }

        if (recommendationsRes && recommendationsRes.ok && recommendationsRes.data?.data) {
          setRecommendationsPlan(recommendationsRes.data.data);
        }

        if (comparisonRes && comparisonRes.ok && comparisonRes.data?.data) {
          setLatestComparison(comparisonRes.data.data);
        }

        if (progressRes.ok) {
          const rawProg = progressRes.data?.progress;
          const quizList =
            progressRes.data?.quizAttempts ||
            (rawProg && !Array.isArray(rawProg) ? rawProg.quizAttempts : []) ||
            [];
          let completedList = [];

          if (Array.isArray(rawProg)) {
            completedList = rawProg
              .filter((p) => p.completed)
              .map((p) => ({
                problemId:
                  p.problem?.slug ||
                  p.problem?.id ||
                  (p.problem?._id ? p.problem._id.toString() : '') ||
                  (typeof p.problem === 'string' ? p.problem : ''),
                completedAt: p.completedAt
              }));
          } else if (rawProg?.completedProblems) {
            completedList = rawProg.completedProblems;
          }

          setProgress({
            completedProblems: completedList,
            quizAttempts: quizList
          });
        }

        if (problemsRes.ok && Array.isArray(problemsRes.data?.problems) && problemsRes.data.problems.length > 0) {
          setDbProblems(problemsRes.data.problems);
        }

        if (problemProgressRes.ok && problemProgressRes.data?.progress) {
          setProblemProgress(problemProgressRes.data.progress);
        }

        if (overviewRes.ok && overviewRes.data?.success && overviewRes.data.data) {
          setAnalyticsOverview(overviewRes.data.data);
        }

        if (topicsRes.ok && topicsRes.data?.success && topicsRes.data.data) {
          setAnalyticsTopics(topicsRes.data.data);
        }

        if (trendsRes.ok && trendsRes.data?.success && Array.isArray(trendsRes.data.data?.trends)) {
          setAnalyticsTrends(trendsRes.data.data.trends);
        }

        if (recentAttemptsRes.ok && recentAttemptsRes.data?.success && Array.isArray(recentAttemptsRes.data.data)) {
          setRecentQuizAttempts(recentAttemptsRes.data.data);
        }

        if (diagnosticRes.ok && diagnosticRes.data?.success && diagnosticRes.data.data) {
          setLatestDiagnostic(diagnosticRes.data.data);
        }

        if (roadmapRes.ok && roadmapRes.data?.success && roadmapRes.data.data) {
          setRoadmap(roadmapRes.data.data);
        }
      })
      .catch(() => {
        // Maintain defaults on network issues
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute metrics from real MongoDB progress
  const completedProblems = progress.completedProblems || [];
  const completedIds = new Set([
    ...completedProblems.map((p) => p.problemId),
    ...problemProgress.byProblem.filter((p) => p.status === 'Accepted').map((p) => p.problemId)
  ]);

  const problemsAvailable = dbProblems.length;
  const problemsAttempted = Math.max(problemProgress.totalAttempted || 0, completedIds.size);
  const problemsSolved = completedIds.size;
  const problemsRemaining = Math.max(0, problemsAvailable - problemsSolved);
  const completionPercentage =
    problemsAvailable > 0 ? Math.round((problemsSolved / problemsAvailable) * 100) : 0;
  const practiceAccuracy =
    problemsAttempted > 0 ? Math.round((problemsSolved / problemsAttempted) * 100) : 0;

  const quizAttempts = progress.quizAttempts || [];
  const latestQuiz = recentQuizAttempts.length > 0
    ? recentQuizAttempts[0]
    : quizAttempts.length > 0
    ? quizAttempts[quizAttempts.length - 1]
    : sessionQuiz;

  // Compute real topical practice progress percentages
  const coreTopics = [
    { topic: 'Arrays', color: 'primary' },
    { topic: 'Strings', color: 'info' },
    { topic: 'Searching', color: 'success' },
    { topic: 'Dynamic Programming', color: 'warning' },
    { topic: 'Linked List', color: 'secondary' },
    { topic: 'Stack', color: 'dark' }
  ];

  const topicalProgress = coreTopics.map(({ topic, color }) => {
    const topicProblems = dbProblems.filter((p) => {
      const matchTopic = p.topic && p.topic.toLowerCase() === topic.toLowerCase();
      const matchTopics = p.topics && p.topics.some((t) => t.toLowerCase() === topic.toLowerCase());
      const matchTags = p.tags && p.tags.some((t) => t.toLowerCase() === topic.toLowerCase());
      return matchTopic || matchTopics || matchTags;
    });

    const solvedInTopic = topicProblems.filter(
      (p) =>
        completedIds.has(p.slug) ||
        completedIds.has(p.id) ||
        (p._id && completedIds.has(p._id.toString()))
    ).length;

    const percentage = topicProblems.length > 0
      ? Math.round((solvedInTopic / topicProblems.length) * 100)
      : 0;

    return {
      topic,
      solved: solvedInTopic,
      total: topicProblems.length,
      percentage,
      color
    };
  }).filter((item) => item.total > 0);

  // Recent activity list combining problems and quizzes
  const recentActivities = [
    ...problemProgress.byProblem.map((p) => ({
      type: 'problem',
      title: p.title || p.problemId,
      subtitle: `${p.status} (${p.attemptCount} attempt${p.attemptCount > 1 ? 's' : ''})`,
      date: p.lastAttemptAt ? new Date(p.lastAttemptAt) : new Date(),
      badge: p.status === 'Accepted' ? 'Solved' : 'Attempted'
    })),
    ...completedProblems
      .filter((cp) => !problemProgress.byProblem.some((p) => p.problemId === cp.problemId))
      .map((cp) => {
        const prob = dbProblems.find((p) => p.slug === cp.problemId || p.id === cp.problemId);
        return {
          type: 'problem',
          title: prob ? prob.title : cp.problemId,
          subtitle: prob ? prob.topics.join(', ') : 'Practice Challenge',
          date: cp.completedAt ? new Date(cp.completedAt) : new Date(),
          badge: 'Solved'
        };
      }),
    ...recentQuizAttempts.map((qa) => ({
      type: 'quiz',
      title: qa.quizTitle || (qa.quizId ? qa.quizId.replace(/-/g, ' ') : 'Assessment Quiz'),
      subtitle: `Score: ${qa.score}/${qa.maxScore} (${qa.percentage}%)`,
      date: qa.submittedAt ? new Date(qa.submittedAt) : new Date(qa.createdAt),
      badge: 'Quiz'
    }))
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  const learnerRec = getLearnerRecommendation(user);

  const handleRecalculateRoadmap = async () => {
    setIsRecalculatingRoadmap(true);
    try {
      const res = await recalculateRoadmap();
      if (res.ok && res.data?.data) {
        setRoadmap(res.data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsRecalculatingRoadmap(false);
    }
  };

  const handleToggleRoadmapItem = async (recId, isCompleted) => {
    try {
      const res = await completeRoadmapRecommendation(recId, isCompleted);
      if (res.ok && res.data?.data) {
        setRoadmap(res.data.data);
      }
    } catch {
      // ignore
    }
  };

  const handleRefreshIntelligence = async () => {
    setIsRefreshingIntelligence(true);
    try {
      const [intelRes, recRes] = await Promise.all([
        getLearningState(),
        getLearningRecommendations({ limit: 5 })
      ]);
      if (intelRes.ok && intelRes.data?.data) {
        setLearningIntelligence(intelRes.data.data);
      }
      if (recRes.ok && recRes.data?.data) {
        setRecommendationsPlan(recRes.data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsRefreshingIntelligence(false);
    }
  };

  return (
    <div className="container py-5">
      {/* 1. DASHBOARD HEADER */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-5 pb-3 border-bottom gap-3">
        <div>
          <h1 className="display-6 fw-bold text-dark mb-1">
            Welcome back, <span className="text-primary">{user?.fullName || 'Programmer'}!</span>
          </h1>
          <p className="lead text-secondary mb-0 fs-6">
            Track your authenticated problem solving, quiz results, and performance analytics.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/practice" className="btn btn-outline-primary fw-semibold">
            Solve Problems
          </Link>
          <Link to="/quiz" className="btn btn-primary fw-semibold">
            Take a Quiz
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading dashboard metrics...</span>
          </div>
          <p className="text-secondary mt-3">Loading authenticated progress from MongoDB...</p>
        </div>
      ) : (
        <>
          {/* ADAPTIVE ONBOARDING BANNER (For users who have not configured preferences yet) */}
          {!user?.onboardingCompleted && !dismissBanner && (
            <div className="card border-primary border-opacity-25 shadow-sm mb-5 bg-primary bg-opacity-10">
              <div className="card-body p-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <span className="badge bg-primary px-2 py-1">New • Adaptive Roadmap</span>
                      <span className="small text-secondary fw-semibold">Personalize your CodeForge journey</span>
                    </div>
                    <h2 className="h5 fw-bold text-dark mb-1">Tailor your practice, quizzes, and language refresh goals</h2>
                    <p className="text-secondary small mb-0">
                      Tell us whether you are learning from scratch, reviving faded syntax, or preparing for interviews. We will adapt your recommendations.
                    </p>
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-shrink-0">
                    <Link to="/onboarding" className="btn btn-primary fw-semibold text-nowrap">
                      Set Up Learning Plan →
                    </Link>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => {
                        setDismissBanner(true);
                        try {
                          sessionStorage.setItem('codeforge_dismiss_onboarding_banner', 'true');
                        } catch {}
                      }}
                      aria-label="Dismiss banner"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PERSONALIZED LEARNING ROADMAP (For onboarded users) */}
          {user?.onboardingCompleted && (
            <div className="card border shadow-sm mb-5">
              <div className="card-header bg-white border-bottom py-3 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
                <div className="d-flex align-items-center gap-2">
                  <Icon name="target" size={20} className="text-primary" />
                  <div>
                    <h2 className="h6 fw-bold text-dark mb-0">Personalized Learning Roadmap</h2>
                    <small className="text-muted">Tailored to your active goals and focus languages</small>
                  </div>
                </div>
                <Link to="/onboarding?edit=true" className="btn btn-outline-primary btn-sm fw-semibold d-inline-flex align-items-center gap-1.5">
                  <Icon name="gear" size={14} />
                  <span>Update Preferences</span>
                </Link>
              </div>
              <div className="card-body p-4">
                <div className="row g-4 align-items-stretch">
                  {/* Left Column: Goals, Languages, Topics */}
                  <div className="col-12 col-lg-7">
                    <div className="mb-3">
                      <span className="text-secondary small fw-semibold text-uppercase d-block mb-2">Active Goals</span>
                      <div className="d-flex flex-wrap gap-2">
                        {user.learningGoals && user.learningGoals.length > 0 ? (
                          user.learningGoals.map((g) => {
                            const cfg = GOAL_MAP[g] || { badge: g, badgeColor: 'secondary', icon: '•' };
                            return (
                              <span
                                key={g}
                                className={`badge bg-${cfg.badgeColor}-subtle text-${cfg.badgeColor} border border-${cfg.badgeColor}-subtle px-3 py-2 fw-medium`}
                              >
                                {cfg.icon} {cfg.badge}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-muted small">Continuous Practice</span>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <span className="text-secondary small fw-semibold text-uppercase d-block mb-2">Languages &amp; Familiarity</span>
                      <div className="d-flex flex-wrap gap-2">
                        {user.languages && user.languages.length > 0 ? (
                          user.languages.map((l) => {
                            const lCfg = LANGUAGE_MAP[l.language] || { name: l.language, icon: l.language };
                            const sCfg = LANGUAGE_STATUS_MAP[l.status] || { label: l.status, badgeColor: 'secondary' };
                            return (
                              <div
                                key={l.language}
                                className="badge bg-light text-dark border px-3 py-2 d-inline-flex align-items-center gap-2"
                              >
                                <span className="fw-bold font-monospace text-primary">{lCfg.icon}</span>
                                <span>{lCfg.name}</span>
                                <span className={`badge bg-${sCfg.badgeColor} text-white ms-1`}>{sCfg.label}</span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-muted small">JavaScript (Active Practice)</span>
                        )}
                      </div>
                    </div>

                    {user.selectedTopics && user.selectedTopics.length > 0 && (
                      <div>
                        <span className="text-secondary small fw-semibold text-uppercase d-block mb-2">Focus Topics</span>
                        <div className="d-flex flex-wrap gap-1">
                          {user.selectedTopics.map((top) => (
                            <span key={top} className="badge bg-light text-secondary border px-2.5 py-1 small fw-normal">
                              {top}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Honest Recommended Next Step */}
                  <div className="col-12 col-lg-5">
                    <div className="p-3 rounded-3 bg-light border h-100 d-flex flex-column justify-content-between">
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge bg-primary px-2.5 py-1 small">Recommended Next Action</span>
                          <span className="small text-muted font-monospace">{learnerRec.badge}</span>
                        </div>
                        <h3 className="h6 fw-bold text-dark mb-1">{learnerRec.title}</h3>
                        <p className="text-secondary small mb-3">{learnerRec.reason}</p>
                      </div>
                      <div>
                        <Link to={learnerRec.actionPath} className="btn btn-primary btn-sm w-100 fw-semibold d-inline-flex align-items-center justify-content-center gap-1">
                          <span>{learnerRec.suggestedAction}</span>
                          <Icon name="arrow-right" size={14} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADAPTIVE DIAGNOSTIC ASSESSMENT CARD */}
          <div className="card border shadow-sm mb-5">
            <div className="card-body p-4">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                <div className="d-flex align-items-start gap-3">
                  <div className="p-3 bg-primary bg-opacity-10 rounded-3 text-primary d-flex align-items-center justify-content-center">
                    <Icon name="brain" size={28} />
                  </div>
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-primary px-2.5 py-1 small">Review &amp; Reassessment • Diagnostic Assessment</span>
                      {latestDiagnostic?.status === 'submitted' && (
                        <span className="badge bg-success-subtle text-success border border-success-subtle small">
                          Last Assessed: {new Date(latestDiagnostic.createdAt).toLocaleDateString()}
                        </span>
                      )}
                      {latestDiagnostic?.status === 'in_progress' && (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle small">
                          In Progress
                        </span>
                      )}
                    </div>
                    <h2 className="h5 fw-bold text-dark mb-1">
                      {latestDiagnostic?.status === 'submitted'
                        ? 'Diagnostic Assessment Results'
                        : latestDiagnostic?.status === 'in_progress'
                        ? 'Resume Your Diagnostic Assessment'
                        : 'Evidence-Based Diagnostic Assessment'}
                    </h2>
                    <p className="text-secondary small mb-0">
                      {latestDiagnostic?.status === 'submitted' ? (
                        <>
                          Overall diagnostic score: <strong>{latestDiagnostic.score}/{latestDiagnostic.maxScore} ({latestDiagnostic.percentage}%)</strong> across {latestDiagnostic.topicResults?.length || 0} topics.
                          {latestDiagnostic.topicResults?.some((t) => t.evidenceStatus === 'needs_revision')
                            ? ' Foundational gaps were identified in one or more topics.'
                            : ' Solid conceptual performance across assessed topics.'}
                        </>
                      ) : latestDiagnostic?.status === 'in_progress' ? (
                        'You have an incomplete diagnostic session. Resume now to complete your knowledge evaluation.'
                      ) : (
                        'Evaluate your understanding across JavaScript, Data Structures & Algorithms, and Core Systems. Receive honest topic evidence ratings and personalized next actions.'
                      )}
                    </p>
                  </div>
                </div>

                <div className="d-flex flex-wrap align-items-center gap-2 flex-shrink-0 w-100 w-md-auto">
                  {latestDiagnostic?.status === 'submitted' ? (
                    <>
                      <Link to={`/diagnostic/report/${latestDiagnostic._id}`} className="btn btn-outline-primary fw-semibold text-nowrap d-inline-flex align-items-center gap-1.5">
                        <Icon name="chart" size={14} />
                        <span>View Report</span>
                      </Link>
                      <Link to="/diagnostic" className="btn btn-primary fw-semibold text-nowrap d-inline-flex align-items-center gap-1.5">
                        <Icon name="refresh" size={14} />
                        <span>Retake Diagnostic</span>
                      </Link>
                    </>
                  ) : latestDiagnostic?.status === 'in_progress' ? (
                    <Link to="/diagnostic" className="btn btn-warning fw-semibold text-nowrap d-inline-flex align-items-center gap-1">
                      <span>Resume Assessment</span>
                      <Icon name="arrow-right" size={14} />
                    </Link>
                  ) : (
                    <Link to="/diagnostic" className="btn btn-primary fw-semibold text-nowrap d-inline-flex align-items-center gap-1">
                      <span>Start Diagnostic Assessment</span>
                      <Icon name="arrow-right" size={14} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* REASSESSMENT COMPARISON SUMMARY (Milestone 15D) */}
          {latestComparison?.hasComparison && (
            <div className="card border shadow-sm mb-4 bg-white" data-testid="dashboard-reassessment-summary">
              <div className="card-body p-3 p-md-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2.5 bg-primary bg-opacity-10 rounded-3 text-primary d-flex align-items-center justify-content-center">
                    <Icon name="refresh" size={22} />
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle small fw-semibold">
                        Review &amp; Reassessment
                      </span>
                      <span className={`badge ${
                        latestComparison.overallDeltaPercentage > 0
                          ? 'bg-success text-white'
                          : latestComparison.overallDeltaPercentage < 0
                          ? 'bg-danger text-white'
                          : 'bg-info text-dark'
                      } small`}>
                        {latestComparison.overallDeltaPercentage > 0 ? `+${latestComparison.overallDeltaPercentage}` : latestComparison.overallDeltaPercentage}% Shift
                      </span>
                    </div>
                    <h3 className="h6 fw-bold mb-0 text-dark">
                      Diagnostic Progress Evaluated
                    </h3>
                    <p className="text-secondary small mb-0">
                      {latestComparison.overallInterpretation || 'Side-by-side diagnostic reassessment evidence indicates measurable skill progression.'}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Link to="/roadmap?tab=comparison" className="btn btn-outline-primary btn-sm fw-semibold text-nowrap d-inline-flex align-items-center gap-1">
                    <span>View Full Evidence Comparison</span>
                    <Icon name="arrow-right" size={14} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* LEARNING INTELLIGENCE ENGINE (Milestone 16A) */}
          {learningIntelligence && (
            <LearningIntelligenceCard
              intelligence={learningIntelligence}
              recommendationsPlan={recommendationsPlan}
              onRefresh={handleRefreshIntelligence}
              isRefreshing={isRefreshingIntelligence}
            />
          )}

          {/* ADAPTIVE PRACTICE & LEARNING PATHWAYS (Milestone 16B) */}
          <div className="mb-5">
            <AdaptivePracticePathways />
          </div>

          {/* ADAPTIVE REVISION ROADMAP (Milestone 15C) */}
          {roadmap && (
            <RevisionRoadmap
              roadmap={roadmap}
              onRecalculate={handleRecalculateRoadmap}
              onToggleComplete={handleToggleRoadmapItem}
              isRecalculating={isRecalculatingRoadmap}
            />
          )}

          {/* 2. OVERVIEW METRICS CARDS */}
          <div className="row g-4 mb-5">
            {/* CARD 1: PROBLEMS SOLVED */}
            <div className="col-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm p-2">
                <div className="card-body">
                  <div className="text-secondary small fw-semibold text-uppercase mb-1">
                    Problems Solved
                  </div>
                  <div className="display-6 fw-bold text-primary font-monospace mb-1">
                    {problemsSolved}
                  </div>
                  <div className="text-muted small">
                    {problemsSolved} of {problemsAvailable} challenges ({completionPercentage}%)
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: QUIZZES COMPLETED */}
            <div className="col-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm p-2">
                <div className="card-body">
                  <div className="text-secondary small fw-semibold text-uppercase mb-1">
                    Quizzes Completed
                  </div>
                  <div className="display-6 fw-bold text-success font-monospace mb-1">
                    {analyticsOverview.totalCompletedAttempts}
                  </div>
                  <div className="text-muted small">
                    Across {analyticsOverview.distinctQuizzesAttempted} distinct topics
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 3: QUIZ AVERAGE SCORE */}
            <div className="col-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm p-2">
                <div className="card-body">
                  <div className="text-secondary small fw-semibold text-uppercase mb-1">
                    Quiz Avg. Score
                  </div>
                  <div className="display-6 fw-bold text-warning font-monospace mb-1">
                    {analyticsOverview.averageScorePercentage}%
                  </div>
                  <div className="text-muted small">
                    Best: {analyticsOverview.bestScorePercentage}% | Recent: {analyticsOverview.recentPerformance}%
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 4: PRACTICE ACCURACY */}
            <div className="col-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm p-2">
                <div className="card-body">
                  <div className="text-secondary small fw-semibold text-uppercase mb-1">
                    Practice Accuracy
                  </div>
                  <div className="display-6 fw-bold text-info font-monospace mb-1">
                    {practiceAccuracy}%
                  </div>
                  <div className="text-muted small">
                    {problemsAttempted === 0 ? '0% accuracy' : `${practiceAccuracy}% success rate`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. PERFORMANCE ANALYTICS SECTION */}
          <div className="row g-4 mb-5">
            {/* TOPIC-WISE PERFORMANCE */}
            <div className="col-12 col-lg-6">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h2 className="h5 fw-bold text-dark mb-0">Topic Performance Breakdown</h2>
                  <span className="badge bg-primary-subtle text-primary small">Quiz Analytics</span>
                </div>
                <div className="card-body p-4">
                  {analyticsTopics.topics.length === 0 ? (
                    <div className="text-center py-4 my-auto">
                      <div className="text-muted mb-2">
                        <Icon name="bar-chart" size={36} />
                      </div>
                      <h3 className="h6 fw-bold text-dark mb-1">No topic analytics yet</h3>
                      <p className="text-secondary small mb-3">
                        Complete assessments across JavaScript, DSA, OS, and Networks to reveal your strengths.
                      </p>
                      <Link to="/quiz" className="btn btn-outline-primary btn-sm px-4 d-inline-flex align-items-center gap-1">
                        <span>Browse Quizzes</span>
                        <Icon name="arrow-right" size={12} />
                      </Link>
                    </div>
                  ) : (
                    <div>
                      {/* Strongest & Weakest Badges */}
                      <div className="d-flex flex-wrap gap-2 mb-4 pb-3 border-bottom">
                        {analyticsTopics.strongestTopic && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle p-2 small d-inline-flex align-items-center gap-1">
                            <Icon name="star" size={12} />
                            <span>Strongest: {analyticsTopics.strongestTopic}</span>
                          </span>
                        )}
                        {analyticsTopics.weakestTopic && analyticsTopics.weakestTopic !== analyticsTopics.strongestTopic && (
                          <span className="badge bg-warning-subtle text-dark border border-warning-subtle p-2 small d-inline-flex align-items-center gap-1">
                            <Icon name="target" size={12} />
                            <span>Needs Focus: {analyticsTopics.weakestTopic}</span>
                          </span>
                        )}
                      </div>

                      {/* Topic Progress Bars */}
                      <div className="d-flex flex-column gap-3">
                        {analyticsTopics.topics.map((t) => (
                          <div key={t.topic}>
                            <div className="d-flex justify-content-between align-items-center small mb-1">
                              <span className="fw-semibold text-dark">{t.topic}</span>
                              <span className="text-secondary font-monospace">
                                {t.averageScorePercentage}% avg ({t.completedAttempts} attempt{t.completedAttempts > 1 ? 's' : ''})
                              </span>
                            </div>
                            <div className="progress" style={{ height: '8px' }}>
                              <div
                                className={`progress-bar ${
                                  t.averageScorePercentage >= 70 ? 'bg-success' : 'bg-warning'
                                }`}
                                role="progressbar"
                                style={{ width: `${t.averageScorePercentage}%` }}
                                aria-valuenow={t.averageScorePercentage}
                                aria-valuemin="0"
                                aria-valuemax="100"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PERFORMANCE SCORE TREND CHART */}
            <div className="col-12 col-lg-6">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h2 className="h5 fw-bold text-dark mb-0">Score Performance Trend</h2>
                  <span className="badge bg-light text-secondary border small">Chronological History</span>
                </div>
                <div className="card-body p-4 d-flex flex-column justify-content-between">
                  {analyticsTrends.length === 0 ? (
                    <div className="text-center py-4 my-auto">
                      <div className="text-muted mb-2">
                        <Icon name="chart" size={36} />
                      </div>
                      <h3 className="h6 fw-bold text-dark mb-1">No trend history available</h3>
                      <p className="text-secondary small mb-3">
                        As you submit quiz attempts, your chronological score trajectory will be rendered here.
                      </p>
                      <Link to="/quiz" className="btn btn-primary btn-sm px-4">
                        Start First Quiz &rarr;
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <p className="text-muted small mb-3">
                        Chronological score progression over your last {analyticsTrends.length} attempt{analyticsTrends.length > 1 ? 's' : ''}:
                      </p>

                      {/* Responsive Accessible SVG Trend Chart */}
                      <div className="p-3 bg-light rounded border mb-3">
                        <svg
                          viewBox="0 0 500 150"
                          className="w-100"
                          style={{ maxHeight: '180px', overflow: 'visible' }}
                          role="img"
                          aria-label="Score performance trajectory line chart"
                        >
                          {/* Grid Lines */}
                          <line x1="40" y1="20" x2="480" y2="20" stroke="#e0e0e0" strokeDasharray="3 3" />
                          <text x="35" y="24" fontSize="10" textAnchor="end" fill="#999">100%</text>

                          <line x1="40" y1="70" x2="480" y2="70" stroke="#e0e0e0" strokeDasharray="3 3" />
                          <text x="35" y="74" fontSize="10" textAnchor="end" fill="#999">50%</text>

                          <line x1="40" y1="120" x2="480" y2="120" stroke="#e0e0e0" />
                          <text x="35" y="124" fontSize="10" textAnchor="end" fill="#999">0%</text>

                          {/* Compute line points */}
                          {(() => {
                            const count = analyticsTrends.length;
                            const stepX = count > 1 ? (480 - 60) / (count - 1) : 0;
                            const points = analyticsTrends.map((item, idx) => {
                              const x = count === 1 ? 270 : 60 + idx * stepX;
                              const y = 120 - ((item.percentage || 0) / 100) * 100;
                              return { x, y, percentage: item.percentage, title: item.quizTitle };
                            });

                            const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

                            return (
                              <>
                                {count > 1 && (
                                  <polyline
                                    fill="none"
                                    stroke="#0d6efd"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={polylinePoints}
                                  />
                                )}
                                {points.map((p, idx) => (
                                  <g key={idx}>
                                    <circle
                                      cx={p.x}
                                      cy={p.y}
                                      r="5"
                                      fill={p.percentage >= 70 ? '#198754' : '#ffc107'}
                                      stroke="#ffffff"
                                      strokeWidth="2"
                                    />
                                    <text
                                      x={p.x}
                                      y={p.y - 10}
                                      fontSize="11"
                                      fontWeight="bold"
                                      textAnchor="middle"
                                      fill="#333"
                                    >
                                      {p.percentage}%
                                    </text>
                                  </g>
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                      </div>

                      <div className="d-flex justify-content-between align-items-center">
                        <Link to="/quiz/history" className="small text-decoration-none">
                          View Complete Attempt History &rarr;
                        </Link>
                        <span className="badge bg-secondary-subtle text-secondary small">
                          Passing Standard: 70%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4. PRACTICE PROGRESS & LATEST QUIZ */}
          <div className="row g-4 mb-5">
            {/* LATEST QUIZ RESULT */}
            <div className="col-12 col-lg-6">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h2 className="h5 fw-bold text-dark mb-0">Latest Quiz Assessment</h2>
                  <span className="badge bg-light text-secondary border small">
                    {recentQuizAttempts.length > 0 ? 'MongoDB Record' : 'Session Memory'}
                  </span>
                </div>
                <div className="card-body p-4 d-flex flex-column justify-content-between">
                  {latestQuiz ? (
                    <div>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h3 className="h6 fw-bold text-dark mb-1">
                            {latestQuiz.quizTitle || (latestQuiz.quizId ? latestQuiz.quizId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'JavaScript Fundamentals')}
                          </h3>
                          <p className="text-secondary small mb-0">
                            {latestQuiz.score ?? latestQuiz.correctAnswers} of {latestQuiz.maxScore ?? latestQuiz.totalQuestions} Correct Answers
                          </p>
                        </div>
                        <span
                          className={`badge ${
                            (latestQuiz.percentage ?? latestQuiz.scorePercentage) >= 70
                              ? 'bg-success'
                              : 'bg-warning text-dark'
                          } px-2 py-1 fs-6`}
                        >
                          {(latestQuiz.percentage ?? latestQuiz.scorePercentage) >= 70 ? 'Passed' : 'Needs Practice'}
                        </span>
                      </div>

                      <div className="progress mb-3" style={{ height: '10px' }}>
                        <div
                          className={`progress-bar ${
                            (latestQuiz.percentage ?? latestQuiz.scorePercentage) >= 70 ? 'bg-success' : 'bg-warning'
                          }`}
                          role="progressbar"
                          style={{ width: `${latestQuiz.percentage ?? latestQuiz.scorePercentage}%` }}
                          aria-valuenow={latestQuiz.percentage ?? latestQuiz.scorePercentage}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        />
                      </div>

                      <div className="d-flex justify-content-between align-items-center small text-secondary mb-4">
                        <span>Performance Score:</span>
                        <strong className="fs-5 text-dark font-monospace">
                          {latestQuiz.percentage ?? latestQuiz.scorePercentage}%
                        </strong>
                      </div>

                      <div className="d-flex gap-2">
                        {latestQuiz._id ? (
                          <Link to={`/quiz/result?attemptId=${latestQuiz._id}`} className="btn btn-outline-primary btn-sm flex-grow-1">
                            View Detailed Review
                          </Link>
                        ) : (
                          <Link to="/quiz/result" className="btn btn-outline-primary btn-sm flex-grow-1">
                            View Detailed Review
                          </Link>
                        )}
                        <Link to={`/quiz?quizId=${latestQuiz.quizId || 'javascript-fundamentals'}`} className="btn btn-primary btn-sm flex-grow-1">
                          Retake Quiz
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 my-auto">
                      <div className="text-muted mb-2">
                        <Icon name="clipboard" size={36} />
                      </div>
                      <h3 className="h6 fw-bold text-dark mb-1">No quiz attempts yet</h3>
                      <p className="text-secondary small mb-3">
                        Assess your core programming knowledge and record results in MongoDB.
                      </p>
                      <Link to="/quiz" className="btn btn-primary btn-sm px-4 d-inline-flex align-items-center gap-1">
                        <span>Take a Quiz</span>
                        <Icon name="arrow-right" size={12} />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* TOPIC MASTERY PROGRESS */}
            <div className="col-12 col-lg-6">
              <div className="card h-100 border-0 shadow-sm">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h2 className="h5 fw-bold text-dark mb-0">Practice Progress & Topic Mastery</h2>
                  <span className="badge bg-success-subtle text-success small">MongoDB Synchronized</span>
                </div>
                <div className="card-body p-4">
                  {/* Practice Progress Bar */}
                  <div className="mb-4 pb-3 border-bottom">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="fw-bold text-dark">Practice Progress</span>
                      <span className="fw-bold text-success font-monospace">
                        {problemsSolved} / {problemsAvailable} Problems Completed ({completionPercentage}%)
                      </span>
                    </div>
                    <div className="progress" style={{ height: '10px' }}>
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        style={{ width: `${completionPercentage}%` }}
                        aria-valuenow={completionPercentage}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>
                    <div className="text-secondary small mt-1">
                      {problemsRemaining > 0 ? `${problemsRemaining} problems remaining in catalog` : 'All catalog challenges completed!'}
                    </div>
                  </div>

                  {problemsSolved === 0 ? (
                    <div className="text-center py-3 my-auto">
                      <div className="text-muted mb-2">
                        <Icon name="lightbulb" size={36} />
                      </div>
                      <h3 className="h6 fw-bold text-dark mb-1">No practice problems completed yet</h3>
                      <p className="text-secondary small mb-3">
                        Solve challenges from the catalog to build topic mastery.
                      </p>
                      <Link to="/practice" className="btn btn-outline-primary btn-sm px-4 d-inline-flex align-items-center gap-1">
                        <span>Browse Practice Problems</span>
                        <Icon name="arrow-right" size={12} />
                      </Link>
                    </div>
                  ) : (
                    <>
                      <p className="text-muted small mb-3">
                        Topic breakdown calculated from your verified problem completions in MongoDB:
                      </p>
                      <div className="d-flex flex-column gap-3">
                        {topicalProgress.map((item) => (
                          <div key={item.topic}>
                            <div className="d-flex justify-content-between align-items-center small mb-1">
                              <span className="fw-semibold text-dark">{item.topic}</span>
                              <span className="text-secondary font-monospace">
                                {item.solved} / {item.total} ({item.percentage}%)
                              </span>
                            </div>
                            <div className="progress" style={{ height: '8px' }}>
                              <div
                                className={`progress-bar bg-${item.color}`}
                                role="progressbar"
                                style={{ width: `${item.percentage}%` }}
                                aria-valuenow={item.percentage}
                                aria-valuemin="0"
                                aria-valuemax="100"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 5. RECENT ACTIVITY & QUICK ACTIONS */}
          <div className="row g-4">
            {/* RECENT ACTIVITY */}
            <div className="col-12 col-lg-8">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h2 className="h5 fw-bold text-dark mb-0">Recent Activity</h2>
                  <span className="badge bg-light text-secondary border small">Activity Log</span>
                </div>
                <div className="card-body p-4">
                  {recentActivities.length === 0 ? (
                    <div className="text-center py-4 text-muted">
                      <p className="small mb-2">No activity recorded yet.</p>
                      <p className="small text-secondary mb-0">
                        Solve a problem or complete a quiz to begin tracking your achievements.
                      </p>
                    </div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {recentActivities.map((act, idx) => (
                        <li key={idx} className="list-group-item px-0 py-2 d-flex align-items-center justify-content-between">
                          <div className="d-flex align-items-center gap-2">
                            <span className="text-success fw-bold">✓</span>
                            <span className="text-dark small">
                              {act.type === 'quiz' ? 'Completed quiz' : 'Problem activity'}{' '}
                              <strong>{act.title}</strong>{' '}
                              <span className="text-muted">({act.subtitle})</span>
                            </span>
                          </div>
                          <span
                            className={`badge ${
                              act.type === 'quiz'
                                ? 'bg-primary-subtle text-primary'
                                : act.badge === 'Solved'
                                ? 'bg-success-subtle text-success'
                                : 'bg-warning-subtle text-dark'
                            } small`}
                          >
                            {act.badge}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="col-12 col-lg-4">
              <div className="card border shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3">
                  <h2 className="h5 fw-bold text-dark mb-0">Quick Actions</h2>
                </div>
                <div className="card-body p-4 d-flex flex-column gap-3 justify-content-center">
                  <Link
                    to="/practice"
                    className="btn btn-primary d-flex align-items-center justify-content-between py-2 px-3 fw-semibold shadow-sm"
                  >
                    <span className="d-flex align-items-center gap-2">
                      <Icon name="code" size={16} />
                      <span>Practice Problems</span>
                    </span>
                    <Icon name="arrow-right" size={14} />
                  </Link>
                  <Link
                    to="/quiz"
                    className="btn btn-outline-primary d-flex align-items-center justify-content-between py-2 px-3 fw-semibold"
                  >
                    <span className="d-flex align-items-center gap-2">
                      <Icon name="clipboard" size={16} />
                      <span>Take a Quiz</span>
                    </span>
                    <Icon name="arrow-right" size={14} />
                  </Link>
                  <Link
                    to="/roadmap?tab=comparison"
                    className="btn btn-outline-primary d-flex align-items-center justify-content-between py-2 px-3 fw-semibold"
                  >
                    <span className="d-flex align-items-center gap-2">
                      <Icon name="refresh" size={16} />
                      <span>Reassessment &amp; Activity</span>
                    </span>
                    <Icon name="arrow-right" size={14} />
                  </Link>
                  <Link
                    to="/quiz/history"
                    className="btn btn-outline-secondary d-flex align-items-center justify-content-between py-2 px-3 fw-semibold"
                  >
                    <span className="d-flex align-items-center gap-2">
                      <Icon name="clock" size={16} />
                      <span>View Quiz History</span>
                    </span>
                    <Icon name="arrow-right" size={14} />
                  </Link>
                  <Link
                    to="/profile"
                    className="btn btn-outline-secondary d-flex align-items-center justify-content-between py-2 px-3 fw-semibold"
                  >
                    <span className="d-flex align-items-center gap-2">
                      <Icon name="user" size={16} />
                      <span>View Profile</span>
                    </span>
                    <Icon name="arrow-right" size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

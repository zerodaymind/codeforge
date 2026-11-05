import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getActivePracticeBundle,
  createPracticeBundle,
  getPrerequisitePathway,
  getCompetencyTrends,
  recordCompetencySnapshot,
  getEligibleRetentionTopics,
  startRetentionSession,
  submitRetentionSession,
  abandonRetentionSession,
  getRetentionHistory,
  dismissRetentionTopic
} from '../utils/api.js';
import Icon from './Icons';

const RETENTION_URGENCY_CONFIG = {
  none: {
    label: 'Fresh Evidence (<14d)',
    badgeClass: 'bg-success-subtle text-success border border-success-subtle',
    icon: '🌱'
  },
  gentle: {
    label: 'Gentle Review (14–30d)',
    badgeClass: 'bg-info-subtle text-info border border-info-subtle',
    icon: '🔔'
  },
  recommended: {
    label: 'Due for Review (31–60d)',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    icon: '⏳'
  },
  priority: {
    label: 'Stale Evidence Priority (>60d)',
    badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle',
    icon: '🚨'
  }
};

const RETENTION_OUTCOME_CONFIG = {
  retained_on_reassessment: {
    label: 'Concept Retained',
    badgeClass: 'bg-success text-white',
    icon: '✅'
  },
  improved_on_reassessment: {
    label: 'Demonstrated Improvement',
    badgeClass: 'bg-primary text-white',
    icon: '📈'
  },
  possible_decline_on_reassessment: {
    label: 'Needs Revision',
    badgeClass: 'bg-warning text-dark',
    icon: '⚠️'
  },
  first_retention_assessment: {
    label: 'Baseline Established',
    badgeClass: 'bg-info text-dark',
    icon: '✨'
  },
  insufficient_evidence: {
    label: 'Insufficient Evidence',
    badgeClass: 'bg-secondary text-white',
    icon: '🔍'
  },
  not_comparable: {
    label: 'Not Comparable',
    badgeClass: 'bg-secondary text-white',
    icon: '⚖️'
  }
};

const ROLE_CONFIG = {
  prerequisite_review: {
    label: 'Prerequisite Review',
    badgeClass: 'bg-warning-subtle text-warning-emphasis border border-warning-subtle',
    icon: '🧱'
  },
  concept_review: {
    label: 'Concept Review',
    badgeClass: 'bg-info-subtle text-info-emphasis border border-info-subtle',
    icon: '📖'
  },
  core_practice: {
    label: 'Core Practice',
    badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle',
    icon: '💻'
  },
  stretch_challenge: {
    label: 'Stretch Challenge',
    badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle',
    icon: '🔥'
  }
};

const DIFFICULTY_BADGES = {
  Easy: 'bg-success-subtle text-success',
  Medium: 'bg-warning-subtle text-warning-emphasis',
  Hard: 'bg-danger-subtle text-danger'
};

const TREND_CONFIG = {
  improved: {
    label: 'Improved',
    badgeClass: 'bg-success text-white',
    icon: '📈'
  },
  stable: {
    label: 'Stable',
    badgeClass: 'bg-info-subtle text-info-emphasis border border-info-subtle',
    icon: '➡️'
  },
  regressed: {
    label: 'Needs Reinforcement',
    badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle',
    icon: '⚠️'
  },
  insufficient_data: {
    label: 'Insufficient Data',
    badgeClass: 'bg-secondary-subtle text-secondary border border-secondary-subtle',
    icon: '🔍'
  },
  new_topic: {
    label: 'New Topic',
    badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle',
    icon: '✨'
  },
  unassessed: {
    label: 'Unassessed',
    badgeClass: 'bg-light text-secondary border',
    icon: '⚪'
  }
};

/**
 * AdaptivePracticePathways Component (Milestone 16B)
 *
 * Visualizes:
 * 1. Targeted Practice Bundles with role-based curation and live completion flags.
 * 2. Prerequisite Knowledge Graph & dependency-aware readiness evaluations.
 * 3. Longitudinal Competency Snapshots & 30/60/90-day trend analytics.
 */
export default function AdaptivePracticePathways() {
  const [activeTab, setActiveTab] = useState('bundle');

  // Bundle state
  const [bundleData, setBundleData] = useState(null);
  const [isLoadingBundle, setIsLoadingBundle] = useState(true);
  const [isGeneratingBundle, setIsGeneratingBundle] = useState(false);

  // Pathway & Prerequisite state
  const [pathwayData, setPathwayData] = useState(null);
  const [isLoadingPathway, setIsLoadingPathway] = useState(false);

  // Competency Trends state
  const [windowDays, setWindowDays] = useState(30);
  const [trendData, setTrendData] = useState(null);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  const [isRecordingSnapshot, setIsRecordingSnapshot] = useState(false);
  const [snapshotMessage, setSnapshotMessage] = useState(null);

  // Load active practice bundle on mount
  useEffect(() => {
    let isMounted = true;

    getActivePracticeBundle()
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.hasBundle) {
          setBundleData(res.data.data);
        } else {
          setBundleData(null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingBundle(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Lazy-load Pathway data on tab switch
  useEffect(() => {
    if (activeTab === 'pathway' && !pathwayData) {
      let isMounted = true;
      getPrerequisitePathway()
        .then((res) => {
          if (!isMounted) return;
          if (res.ok && res.data?.data) {
            setPathwayData(res.data.data);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingPathway(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [activeTab, pathwayData]);

  // Lazy-load Trends on tab switch or windowDays change
  useEffect(() => {
    if (activeTab === 'trends') {
      let isMounted = true;
      getCompetencyTrends(windowDays)
        .then((res) => {
          if (!isMounted) return;
          if (res.ok && res.data?.data) {
            setTrendData(res.data.data);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingTrends(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [activeTab, windowDays]);

  // Retention & Durable Learning state (Milestone 16C)
  const [retentionSchedule, setRetentionSchedule] = useState([]);
  const [retentionDismissed, setRetentionDismissed] = useState([]);
  const [isLoadingRetention, setIsLoadingRetention] = useState(false);
  const [retentionHistory, setRetentionHistory] = useState([]);
  const [activeRetentionSession, setActiveRetentionSession] = useState(null);
  const [retentionAnswers, setRetentionAnswers] = useState({});
  const [isSubmittingRetention, setIsSubmittingRetention] = useState(false);
  const [retentionMessage, setRetentionMessage] = useState(null);

  const fetchRetentionData = async () => {
    setIsLoadingRetention(true);
    try {
      const [eligibleRes, historyRes] = await Promise.all([
        getEligibleRetentionTopics(),
        getRetentionHistory({ limit: 5 })
      ]);
      if (eligibleRes.ok && eligibleRes.data?.data) {
        setRetentionSchedule(eligibleRes.data.data);
        setRetentionDismissed(eligibleRes.data.dismissedTopics || []);
      }
      if (historyRes.ok && historyRes.data?.data) {
        setRetentionHistory(historyRes.data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingRetention(false);
    }
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'pathway' && !pathwayData) {
      setIsLoadingPathway(true);
    } else if (newTab === 'trends') {
      setIsLoadingTrends(true);
    } else if (newTab === 'retention' && retentionSchedule.length === 0) {
      fetchRetentionData();
    }
  };

  const handleWindowDaysChange = (days) => {
    setWindowDays(days);
    setIsLoadingTrends(true);
  };

  const handleGenerateNewBundle = async (topic) => {
    setIsGeneratingBundle(true);
    try {
      const res = await createPracticeBundle(topic);
      if (res.ok && res.data?.hasBundle) {
        setBundleData(res.data.data);
      }
    } catch {
      // ignore
    } finally {
      setIsGeneratingBundle(false);
    }
  };

  const handleRecordSnapshot = async () => {
    setIsRecordingSnapshot(true);
    setSnapshotMessage(null);
    try {
      const res = await recordCompetencySnapshot(true);
      if (res.ok) {
        setSnapshotMessage('Snapshot recorded! Refreshing trend window...');
        const trendRes = await getCompetencyTrends(windowDays);
        if (trendRes.ok && trendRes.data?.data) {
          setTrendData(trendRes.data.data);
        }
      }
    } catch {
      setSnapshotMessage('Failed to record snapshot.');
    } finally {
      setIsRecordingSnapshot(false);
      setTimeout(() => setSnapshotMessage(null), 4000);
    }
  };

  const handleStartRetention = async (topic, forceNew = false) => {
    setIsLoadingRetention(true);
    setRetentionMessage(null);
    try {
      const res = await startRetentionSession(topic, forceNew);
      if (res.ok && res.data?.data) {
        setActiveRetentionSession(res.data.data);
        setRetentionAnswers({});
      } else {
        setRetentionMessage(res.data?.message || 'Could not start retention session.');
      }
    } catch {
      setRetentionMessage('Failed to start retention session.');
    } finally {
      setIsLoadingRetention(false);
    }
  };

  const handleSelectRetentionOption = (questionId, optionIndex) => {
    setRetentionAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmitRetention = async () => {
    if (!activeRetentionSession) return;
    const questions = activeRetentionSession.questions || [];
    const answers = questions.map((q) => ({
      questionId: q.questionId,
      selectedOption: retentionAnswers[q.questionId] !== undefined ? retentionAnswers[q.questionId] : -1
    }));

    setIsSubmittingRetention(true);
    setRetentionMessage(null);
    try {
      const res = await submitRetentionSession(activeRetentionSession.sessionId, answers);
      if (res.ok && res.data?.data) {
        setActiveRetentionSession(res.data.data);
        fetchRetentionData();
      } else {
        setRetentionMessage(res.data?.message || 'Submission failed.');
      }
    } catch {
      setRetentionMessage('Failed to submit retention assessment.');
    } finally {
      setIsSubmittingRetention(false);
    }
  };

  const handleAbandonRetention = async () => {
    if (!activeRetentionSession) return;
    try {
      await abandonRetentionSession(activeRetentionSession.sessionId);
      setActiveRetentionSession(null);
      setRetentionAnswers({});
      fetchRetentionData();
    } catch {
      // ignore
    }
  };

  const handleDismissRetention = async (topic) => {
    try {
      const res = await dismissRetentionTopic(topic, 48);
      if (res.ok) {
        setRetentionMessage(`Topic '${topic}' review snoozed for 48 hours.`);
        fetchRetentionData();
        setTimeout(() => setRetentionMessage(null), 4000);
      }
    } catch {
      setRetentionMessage('Failed to dismiss retention topic.');
    }
  };

  return (
    <div className="card border-0 shadow-sm mb-4">
      {/* Header & Tabs */}
      <div className="card-header bg-transparent border-bottom py-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <Icon name="compass" size={20} className="text-primary" />
            <h5 className="mb-0 fw-semibold">Adaptive Pathways &amp; Practice Sessions</h5>
            <span className="badge bg-success-subtle text-success border border-success-subtle small">
              Revision Roadmap
            </span>
          </div>
          <small className="text-secondary">
            Practice bundles, prerequisite validation, competency trends &amp; durable learning
          </small>
        </div>

        <ul className="nav nav-tabs card-header-tabs" role="tablist">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link fw-medium d-inline-flex align-items-center gap-1.5 ${activeTab === 'bundle' ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => handleTabChange('bundle')}
            >
              <Icon name="target" size={14} />
              <span>Practice Bundle</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link fw-medium d-inline-flex align-items-center gap-1.5 ${activeTab === 'pathway' ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => handleTabChange('pathway')}
            >
              <Icon name="map" size={14} />
              <span>Prerequisite Graph</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link fw-medium d-inline-flex align-items-center gap-1.5 ${activeTab === 'trends' ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => handleTabChange('trends')}
            >
              <Icon name="bar-chart" size={14} />
              <span>Competency Trends</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link fw-medium d-inline-flex align-items-center gap-1.5 ${activeTab === 'retention' ? 'active text-primary' : 'text-secondary'}`}
              onClick={() => handleTabChange('retention')}
            >
              <Icon name="refresh" size={14} />
              <span>Retention &amp; Review</span>
            </button>
          </li>
        </ul>
      </div>

      <div className="card-body p-4">
        {/* ============================================================== */}
        {/* TAB 1: TARGETED PRACTICE BUNDLE                                */}
        {/* ============================================================== */}
        {activeTab === 'bundle' && (
          <div>
            {isLoadingBundle ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span className="ms-2 text-secondary small">Loading active practice bundle...</span>
              </div>
            ) : bundleData ? (
              <div>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-primary text-white">{bundleData.targetTopic}</span>
                      <span className="badge bg-light text-dark border">
                        {bundleData.targetState?.replace('_', ' ')}
                      </span>
                      {bundleData.status === 'completed' ? (
                        <span className="badge bg-success text-white">✓ Bundle Completed</span>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                          Active Session
                        </span>
                      )}
                    </div>
                    <h5 className="fw-bold mb-1">{bundleData.headline}</h5>
                    <small className="text-secondary">
                      Estimated duration: ~{bundleData.estimatedMinutes || 30} mins • Verified completion strictly requires Accepted submissions or passed quizzes.
                    </small>
                  </div>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                    onClick={() => handleGenerateNewBundle(bundleData.targetTopic)}
                    disabled={isGeneratingBundle}
                  >
                    {isGeneratingBundle ? (
                      'Assembling...'
                    ) : (
                      <>
                        <span>Assemble Fresh Bundle</span>
                        <Icon name="refresh" size={13} />
                      </>
                    )}
                  </button>
                </div>

                {bundleData.prerequisiteNotes && (
                  <div className="alert alert-warning py-2 px-3 small mb-3">
                    <span className="fw-semibold">Prerequisite Note: </span>
                    {bundleData.prerequisiteNotes}
                  </div>
                )}

                {/* Progress bar */}
                <div className="mb-4">
                  <div className="d-flex justify-content-between small text-secondary mb-1">
                    <span>Verified Items Completed</span>
                    <span className="fw-semibold text-dark">
                      {bundleData.items?.filter((i) => i.isCompleted).length} / {bundleData.items?.length || 0}
                    </span>
                  </div>
                  <div className="progress" style={{ height: '6px' }}>
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{
                        width: `${Math.round(
                          ((bundleData.items?.filter((i) => i.isCompleted).length || 0) /
                            (bundleData.items?.length || 1)) *
                            100
                        )}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Bundle Items List */}
                <div className="list-group list-group-flush border rounded-3 overflow-hidden">
                  {bundleData.items?.map((item) => {
                    const roleCfg = ROLE_CONFIG[item.role] || ROLE_CONFIG.core_practice;
                    return (
                      <div
                        key={item.id}
                        className={`list-group-item p-3 d-flex flex-wrap justify-content-between align-items-center gap-3 ${
                          item.isCompleted ? 'bg-success bg-opacity-10' : ''
                        }`}
                      >
                        <div className="d-flex align-items-start gap-2 flex-grow-1">
                          <span className="mt-1 d-inline-flex align-items-center">
                            {item.isCompleted ? (
                              <Icon name="check-circle" size={18} className="text-success" />
                            ) : (
                              <Icon name="target" size={18} className="text-secondary" />
                            )}
                          </span>
                          <div>
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                              <span className={`badge ${roleCfg.badgeClass} small`}>
                                {roleCfg.label}
                              </span>
                              <span className={`badge ${DIFFICULTY_BADGES[item.difficulty] || 'bg-secondary'} small`}>
                                {item.difficulty}
                              </span>
                              <span className="fw-bold">{item.title}</span>
                            </div>
                            <p className="text-secondary small mb-0">
                              {item.selectionReason}
                            </p>
                          </div>
                        </div>

                        <div className="d-flex align-items-center gap-2 flex-shrink-0">
                          {item.isCompleted ? (
                            <span className="badge bg-success text-white px-3 py-2 small d-inline-flex align-items-center gap-1">
                              <Icon name="check" size={13} /> Verified
                            </span>
                          ) : (
                            <Link to={item.url} className="btn btn-sm btn-primary fw-medium px-3">
                              {item.type === 'quiz' ? 'Take Quiz →' : 'Solve Code →'}
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="mb-2 text-secondary">
                  <Icon name="target" size={48} />
                </div>
                <h6 className="fw-bold">No active practice bundle assembled yet</h6>
                <p className="text-secondary small mb-3">
                  Assemble a structured 3–5 problem practice session targeting your highest-priority concept gaps.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm fw-medium px-3"
                  onClick={() => handleGenerateNewBundle()}
                  disabled={isGeneratingBundle}
                >
                  {isGeneratingBundle ? 'Assembling...' : 'Assemble Targeted Practice Bundle →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: PREREQUISITE KNOWLEDGE GRAPH                            */}
        {/* ============================================================== */}
        {activeTab === 'pathway' && (
          <div>
            {isLoadingPathway ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span className="ms-2 text-secondary small">Validating curriculum graph...</span>
              </div>
            ) : pathwayData ? (
              <div>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div>
                    <h6 className="fw-bold mb-1">Curriculum Prerequisite Dependency Pathway</h6>
                    <small className="text-secondary">
                      Topological dependency order: verified foundational concepts appear first. Unmet prerequisites are flagged to guide remediation.
                    </small>
                  </div>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                    Verified DAG (Cycle-Free)
                  </span>
                </div>

                <div className="list-group list-group-flush border rounded-3 overflow-hidden">
                  {pathwayData.topologicalOrder?.map((topic, index) => {
                    const readiness = pathwayData.readinessMap?.[topic] || {};
                    const directPrereqs = pathwayData.graph?.[topic] || [];

                    return (
                      <div key={topic} className="list-group-item p-3">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                          <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-light text-secondary border small">
                              #{index + 1}
                            </span>
                            <span className="fw-bold">{topic}</span>
                            {directPrereqs.length === 0 ? (
                              <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle small">
                                Foundational
                              </span>
                            ) : readiness.isReady ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle small">
                                Prereqs Ready ✓
                              </span>
                            ) : (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle small">
                                Prereqs Needed ⚠️
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleGenerateNewBundle(topic)}
                            disabled={isGeneratingBundle}
                          >
                            Practice {topic} →
                          </button>
                        </div>

                        {directPrereqs.length > 0 && (
                          <div className="small text-secondary mt-1">
                            <span className="fw-semibold">Prerequisites:</span> {directPrereqs.join(', ')}
                          </div>
                        )}

                        {!readiness.isReady && (
                          <p className="text-warning-emphasis small mt-2 mb-0">
                            {readiness.guidance}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-secondary text-center small mb-0">Unable to load prerequisite graph.</p>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: LONGITUDINAL COMPETENCY TRENDS                         */}
        {/* ============================================================== */}
        {activeTab === 'trends' && (
          <div>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
              <div>
                <h6 className="fw-bold mb-1">Longitudinal Competency Review</h6>
                <small className="text-secondary">
                  Compare observed performance against historical baselines. Measured scores are never penalized merely because time passed.
                </small>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div className="btn-group btn-group-sm" role="group">
                  {[30, 60, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className={`btn ${windowDays === days ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => handleWindowDaysChange(days)}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                  onClick={handleRecordSnapshot}
                  disabled={isRecordingSnapshot}
                >
                  {isRecordingSnapshot ? (
                    'Saving...'
                  ) : (
                    <>
                      <span>Record Checkpoint</span>
                      <Icon name="clipboard" size={13} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {snapshotMessage && (
              <div className="alert alert-info py-2 px-3 small mb-3">
                {snapshotMessage}
              </div>
            )}

            {isLoadingTrends ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <span className="ms-2 text-secondary small">Evaluating longitudinal trends...</span>
              </div>
            ) : trendData?.hasTrend ? (
              <div>
                <div className="p-3 bg-body-tertiary rounded-3 border mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2 small">
                  <div>
                    <span className="text-secondary">Baseline Date:</span>{' '}
                    <span className="fw-semibold">
                      {new Date(trendData.baselineSnapshotDate).toLocaleDateString()}
                    </span>
                    <span className="mx-2">•</span>
                    <span className="text-secondary">Current Date:</span>{' '}
                    <span className="fw-semibold">
                      {new Date(trendData.currentSnapshotDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-secondary">Overall Mastery Shift:</span>{' '}
                    <span
                      className={`badge ${
                        trendData.averageScoreDelta > 0
                          ? 'bg-success text-white'
                          : trendData.averageScoreDelta < 0
                          ? 'bg-danger text-white'
                          : 'bg-info text-dark'
                      } ms-1`}
                    >
                      {trendData.averageScoreDelta > 0 ? `+${trendData.averageScoreDelta}` : trendData.averageScoreDelta}%
                    </span>
                  </div>
                </div>

                <div className="list-group list-group-flush border rounded-3 overflow-hidden">
                  {trendData.topicDeltas
                    ?.filter((td) => td.trend !== 'unassessed')
                    .map((item) => {
                      const trendCfg = TREND_CONFIG[item.trend] || TREND_CONFIG.stable;
                      return (
                        <div key={item.topic} className="list-group-item p-3">
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <div className="d-flex align-items-center gap-2">
                              <span>{trendCfg.icon}</span>
                              <span className="fw-bold">{item.topic}</span>
                              <span className={`badge ${trendCfg.badgeClass} small`}>
                                {trendCfg.label}
                              </span>
                            </div>

                            <div className="text-end small">
                              {item.baselineScore !== null ? (
                                <span>
                                  {item.baselineScore}% →{' '}
                                  <strong className="text-primary">{item.currentScore}%</strong>{' '}
                                  {item.scoreDelta !== null && (
                                    <span
                                      className={
                                        item.scoreDelta > 0
                                          ? 'text-success fw-bold'
                                          : item.scoreDelta < 0
                                          ? 'text-danger fw-bold'
                                          : 'text-secondary'
                                      }
                                    >
                                      ({item.scoreDelta > 0 ? `+${item.scoreDelta}` : item.scoreDelta}pp)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-secondary">
                                  Current: {item.currentScore !== null ? `${item.currentScore}%` : 'Unassessed'}
                                </span>
                              )}
                            </div>
                          </div>

                          <p className="text-secondary small mt-1 mb-0">{item.interpretation}</p>

                          {item.limitations && item.limitations.length > 0 && (
                            <div className="text-warning-emphasis small mt-1">
                              <span className="fw-semibold">Comparability notice:</span> {item.limitations.join(' ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="text-center py-4 bg-body-tertiary rounded-3 border">
                <div className="mb-2 text-secondary">
                  <Icon name="clipboard" size={36} />
                </div>
                <h6 className="fw-bold">Baseline established for {windowDays}-day review window</h6>
                <p className="text-secondary small mb-2">
                  {trendData?.message || 'Initial baseline recorded. Complete additional practice problems or assessments to observe longitudinal trends.'}
                </p>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 mx-auto"
                  onClick={handleRecordSnapshot}
                  disabled={isRecordingSnapshot}
                >
                  <span>Record Fresh Snapshot</span>
                  <Icon name="clipboard" size={13} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: RETENTION & DURABLE LEARNING (MILESTONE 16C)            */}
        {/* ============================================================== */}
        {activeTab === 'retention' && (
          <div>
            {/* Scientific Principle Callout */}
            <div className="alert alert-light border d-flex align-items-start gap-2 mb-4">
              <Icon name="lightbulb" size={18} className="text-warning flex-shrink-0 mt-0.5" />
              <div className="small">
                <strong className="d-block text-dark">CodeForge Durable Learning Science</strong>
                <span className="text-secondary">
                  Inactivity is never treated as evidence of forgetting. We do not degrade your proficiency scores simply because time has passed. Retention check-ins verify recall, shore up rusty mental models, and distinguish stable comprehension from prompt-exposure effects.
                </span>
              </div>
            </div>

            {retentionMessage && (
              <div className="alert alert-info py-2 px-3 small mb-3">
                {retentionMessage}
              </div>
            )}

            {/* Sub-view A: Active Retention Session in Progress */}
            {activeRetentionSession && activeRetentionSession.status === 'in_progress' ? (
              <div className="card border shadow-sm mb-4">
                <div className="card-header bg-body-tertiary d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
                  <div>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle me-2">
                      Active Checkpoint
                    </span>
                    <h5 className="mb-0 fw-bold d-inline align-middle">
                      {activeRetentionSession.targetTopic}
                    </h5>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <span className="small text-secondary">
                      {activeRetentionSession.questions?.length || 0} Questions
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={handleAbandonRetention}
                      disabled={isSubmittingRetention}
                    >
                      Abandon Check
                    </button>
                  </div>
                </div>

                <div className="card-body p-4">
                  <p className="text-secondary small mb-4">
                    Answer each question to the best of your ability. Questions prioritize novel catalog items to avoid measuring rote recall.
                  </p>

                  <div className="d-flex flex-column gap-4">
                    {activeRetentionSession.questions?.map((q, idx) => (
                      <div key={q.questionId} className="border rounded-3 p-3 bg-body-subtle">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="badge bg-secondary small">
                            Question {idx + 1} of {activeRetentionSession.questions.length}
                          </span>
                          {q.isRepeated && (
                            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle small d-inline-flex align-items-center gap-1">
                              <Icon name="refresh" size={12} /> Repeat Exposure ({q.timesSeen}x seen)
                            </span>
                          )}
                        </div>

                        <h6 className="fw-semibold mb-2">{q.question}</h6>

                        {q.codeSnippet && (
                          <pre className="bg-dark text-light p-3 rounded-2 small font-monospace mb-3">
                            <code>{q.codeSnippet}</code>
                          </pre>
                        )}

                        <div className="d-flex flex-column gap-2 mt-3">
                          {q.options?.map((opt, optIdx) => {
                            const isChecked = retentionAnswers[q.questionId] === optIdx;
                            return (
                              <label
                                key={optIdx}
                                className={`p-2 px-3 border rounded-2 d-flex align-items-center gap-2 cursor-pointer ${
                                  isChecked ? 'bg-primary-subtle border-primary' : 'bg-body'
                                }`}
                                style={{ cursor: 'pointer' }}
                              >
                                <input
                                  type="radio"
                                  name={`question-${q.questionId}`}
                                  checked={isChecked}
                                  onChange={() => handleSelectRetentionOption(q.questionId, optIdx)}
                                  className="form-check-input mt-0"
                                />
                                <span className="small">{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSubmitRetention}
                      disabled={isSubmittingRetention}
                    >
                      {isSubmittingRetention ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Evaluating Retention...
                        </>
                      ) : (
                        <span className="d-inline-flex align-items-center gap-1.5">
                          <span>Submit Retention Assessment</span>
                          <Icon name="target" size={14} />
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Sub-view B: Completed Retention Session Result */}
            {activeRetentionSession && activeRetentionSession.status === 'submitted' && activeRetentionSession.outcome ? (
              <div className="card border shadow-sm mb-4">
                <div className="card-header bg-body-tertiary d-flex flex-wrap justify-content-between align-items-center gap-2 py-3">
                  <div className="d-flex align-items-center gap-2">
                    <Icon name="target" size={20} className="text-primary" />
                    <h5 className="mb-0 fw-bold">{activeRetentionSession.targetTopic} — Assessment Result</h5>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setActiveRetentionSession(null)}
                  >
                    Close Review ✕
                  </button>
                </div>

                <div className="card-body p-4">
                  {/* Outcome Classification Alert */}
                  {(() => {
                    const outcome = activeRetentionSession.outcome;
                    const outcomeCfg = RETENTION_OUTCOME_CONFIG[outcome.classification] || RETENTION_OUTCOME_CONFIG.retained_on_reassessment;
                    return (
                      <div className="p-3 bg-body-tertiary rounded-3 border mb-4">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                          <div className="d-flex align-items-center gap-2">
                            <span>{outcomeCfg.icon}</span>
                            <span className={`badge ${outcomeCfg.badgeClass}`}>
                              {outcomeCfg.label}
                            </span>
                          </div>
                          <div className="fw-bold fs-5">
                            {outcome.percentage}%{' '}
                            <span className="text-secondary fw-normal fs-6">
                              ({outcome.score} / {outcome.maxScore} pts)
                            </span>
                          </div>
                        </div>

                        <p className="mb-2 text-dark small">{outcome.reason}</p>

                        {/* Baseline Comparison Delta */}
                        <div className="d-flex flex-wrap align-items-center gap-3 pt-2 border-top small text-secondary">
                          <div>
                            <span>Prior Baseline:</span>{' '}
                            <strong className="text-dark">
                              {activeRetentionSession.historicalBaseline?.baselineScore !== null
                                ? `${activeRetentionSession.historicalBaseline.baselineScore}%`
                                : 'No prior baseline'}
                            </strong>
                          </div>
                          {outcome.scoreDelta !== null && (
                            <div>
                              <span>Delta:</span>{' '}
                              <strong className={outcome.scoreDelta >= 0 ? 'text-success' : 'text-danger'}>
                                {outcome.scoreDelta > 0 ? `+${outcome.scoreDelta}` : outcome.scoreDelta}pp
                              </strong>
                            </div>
                          )}
                          <div>
                            <span>Repeated Questions:</span>{' '}
                            <strong className="text-dark">
                              {outcome.repeatedQuestionsCount || 0} of {activeRetentionSession.questions?.length || 0}
                            </strong>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Comparability Disclosures */}
                  {activeRetentionSession.outcome.comparabilityDisclosures?.length > 0 && (
                    <div className="alert alert-light border small text-secondary mb-4">
                      <strong className="d-block text-dark mb-1">Assessment Disclosures:</strong>
                      <ul className="mb-0 ps-3">
                        {activeRetentionSession.outcome.comparabilityDisclosures.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Grounded Recommended Action */}
                  {activeRetentionSession.outcome.recommendedAction && (
                    <div className="p-3 border rounded-3 bg-primary-subtle border-primary-subtle d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
                      <div>
                        <span className="badge bg-primary text-white small mb-1">
                          Recommended Next Step
                        </span>
                        <h6 className="fw-bold mb-1 text-primary-emphasis">
                          {activeRetentionSession.outcome.recommendedAction.title}
                        </h6>
                        <p className="mb-0 small text-secondary">
                          {activeRetentionSession.outcome.recommendedAction.description}
                        </p>
                      </div>
                      <Link
                        to={activeRetentionSession.outcome.recommendedAction.url}
                        className="btn btn-sm btn-primary"
                      >
                        Start Next Action →
                      </Link>
                    </div>
                  )}

                  {/* Question-by-Question Solution Review */}
                  <h6 className="fw-bold mb-3">Item Breakdown &amp; Explanations</h6>
                  <div className="d-flex flex-column gap-3 mb-4">
                    {activeRetentionSession.questions?.map((q, idx) => {
                      const userAns = activeRetentionSession.selectedAnswers?.find(
                        (a) => a.questionId === q.questionId
                      );
                      const isCorrect = userAns?.isCorrect;
                      return (
                        <div
                          key={q.questionId}
                          className={`p-3 border rounded-3 ${
                            isCorrect ? 'border-success-subtle bg-success-subtle bg-opacity-10' : 'border-danger-subtle bg-danger-subtle bg-opacity-10'
                          }`}
                        >
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-bold small">
                              Q{idx + 1}. {q.question}
                            </span>
                            <span className={`badge ${isCorrect ? 'bg-success' : 'bg-danger'} small`}>
                              {isCorrect ? 'Correct (+1)' : 'Incorrect (0)'}
                            </span>
                          </div>

                          {q.codeSnippet && (
                            <pre className="bg-dark text-light p-2 rounded small font-monospace my-2">
                              <code>{q.codeSnippet}</code>
                            </pre>
                          )}

                          <div className="small mt-2">
                            <div className="text-secondary">
                              Your answer:{' '}
                              <strong className={isCorrect ? 'text-success' : 'text-danger'}>
                                {userAns?.selectedOption >= 0 && q.options?.[userAns.selectedOption]
                                  ? q.options[userAns.selectedOption]
                                  : 'Not answered'}
                              </strong>
                            </div>
                            {!isCorrect && q.answer !== undefined && (
                              <div className="text-success mt-1">
                                Correct answer: <strong>{q.options?.[q.answer] || q.answer}</strong>
                              </div>
                            )}
                            {q.explanation && (
                              <div className="text-secondary mt-2 p-2 bg-body rounded border">
                                <span className="fw-semibold">Explanation:</span> {q.explanation}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-end">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setActiveRetentionSession(null)}
                    >
                      Back to Retention Schedule
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Sub-view C: Schedule & History (visible when not actively in a session) */}
            {!activeRetentionSession && (
              <div>
                {/* Eligible Topics Review Queue */}
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <div>
                    <h6 className="fw-bold mb-0">Retention Review Queue</h6>
                    <small className="text-secondary">
                      Topics scheduled for review based on evidence freshness intervals
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                    onClick={fetchRetentionData}
                    disabled={isLoadingRetention}
                  >
                    {isLoadingRetention ? (
                      'Refreshing...'
                    ) : (
                      <>
                        <span>Refresh Queue</span>
                        <Icon name="refresh" size={13} />
                      </>
                    )}
                  </button>
                </div>

                {isLoadingRetention ? (
                  <div className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                    <span className="ms-2 text-secondary small">Evaluating retention eligibility...</span>
                  </div>
                ) : retentionSchedule.length > 0 ? (
                  <div className="list-group list-group-flush border rounded-3 overflow-hidden mb-4">
                    {retentionSchedule.map((item) => {
                      const urgencyCfg = RETENTION_URGENCY_CONFIG[item.urgency] || RETENTION_URGENCY_CONFIG.gentle;
                      const isDismissed = retentionDismissed.includes(item.topic);
                      return (
                        <div key={item.topic} className="list-group-item p-3">
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                            <div className="d-flex align-items-center gap-2">
                              <span>{urgencyCfg.icon}</span>
                              <span className="fw-bold">{item.topic}</span>
                              <span className={`badge ${urgencyCfg.badgeClass} small`}>
                                {urgencyCfg.label}
                              </span>
                              {isDismissed && (
                                <span className="badge bg-secondary-subtle text-secondary small">
                                  Snoozed 48h
                                </span>
                              )}
                            </div>

                            <div className="d-flex align-items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                                onClick={() => handleDismissRetention(item.topic)}
                                title="Snooze review prompt for 48 hours"
                              >
                                <span>Snooze 48h</span>
                                <Icon name="clock" size={12} />
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                                onClick={() => handleStartRetention(item.topic)}
                                disabled={item.availableQuestionsCount === 0}
                              >
                                <span>Check Retention</span>
                                <Icon name="target" size={12} />
                              </button>
                            </div>
                          </div>

                          <div className="d-flex flex-wrap align-items-center gap-3 mt-2 small text-secondary">
                            <div>
                              <span>Last evidence:</span>{' '}
                              <strong className="text-dark">
                                {item.daysSinceLastEvidence !== null
                                  ? `${item.daysSinceLastEvidence} days ago`
                                  : 'Initial baseline'}
                              </strong>
                            </div>
                            <div>
                              <span>Current score:</span>{' '}
                              <strong className="text-dark">
                                {item.currentMasteryScore !== null ? `${item.currentMasteryScore}%` : 'Unassessed'}
                              </strong>
                            </div>
                            <div>
                              <span>Catalog items:</span>{' '}
                              <strong className="text-dark">
                                {item.availableQuestionsCount} available
                              </strong>
                            </div>
                          </div>

                          {item.notes && item.notes.length > 0 && (
                            <p className="text-secondary small mt-1 mb-0">
                              {item.notes.join(' ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 bg-body-tertiary rounded-3 border mb-4">
                    <div className="mb-2 text-success">
                      <Icon name="check-circle" size={36} />
                    </div>
                    <h6 className="fw-bold">No topics currently due for retention review</h6>
                    <p className="text-secondary small mb-0">
                      All your assessed topics have recent evidence (&lt;14 days) or are currently in cool-off.
                    </p>
                  </div>
                )}

                {/* Past Retention History */}
                <h6 className="fw-bold mb-2">Past Retention Checkpoints</h6>
                {retentionHistory.length > 0 ? (
                  <div className="list-group list-group-flush border rounded-3 overflow-hidden">
                    {retentionHistory.map((h) => {
                      const outcomeCfg = RETENTION_OUTCOME_CONFIG[h.outcome?.classification] || RETENTION_OUTCOME_CONFIG.retained_on_reassessment;
                      return (
                        <div key={h.sessionId || h.id} className="list-group-item p-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <span>{outcomeCfg.icon}</span>
                              <span className="fw-bold">{h.targetTopic}</span>
                              <span className={`badge ${outcomeCfg.badgeClass} small`}>
                                {outcomeCfg.label}
                              </span>
                            </div>
                            <small className="text-secondary">
                              Completed {new Date(h.submittedAt || h.startedAt).toLocaleDateString()} • {h.totalQuestions} questions
                            </small>
                          </div>

                          <div className="text-end small">
                            <span className="fw-bold fs-6">{h.outcome?.percentage}%</span>
                            {h.outcome?.scoreDelta !== null && h.outcome?.scoreDelta !== undefined && (
                              <span
                                className={`ms-1 fw-semibold ${
                                  h.outcome.scoreDelta > 0
                                    ? 'text-success'
                                    : h.outcome.scoreDelta < 0
                                    ? 'text-danger'
                                    : 'text-secondary'
                                }`}
                              >
                                ({h.outcome.scoreDelta > 0 ? `+${h.outcome.scoreDelta}` : h.outcome.scoreDelta}pp)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-body-tertiary rounded-3 border text-center text-secondary small">
                    No retention checkpoints recorded yet. Complete a review above to track durable retention.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

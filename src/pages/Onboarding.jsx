import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { saveOnboarding, skipOnboarding, getOnboarding } from '../utils/api';

const DRAFT_STORAGE_KEY = 'codeforge_onboarding_draft';

// Goal options definition
const GOAL_OPTIONS = [
  {
    id: 'beginner',
    title: 'Learn programming from scratch',
    icon: '🌱',
    badge: 'Beginner',
    badgeColor: 'success',
    description: 'Never programmed before or starting fresh. We focus on core syntax, mental models, and step-by-step problem-solving.'
  },
  {
    id: 'revival',
    title: 'Revive a programming language I learned before',
    icon: '🔄',
    badge: 'Revival',
    badgeColor: 'warning',
    description: 'You understand the logic, but syntax and patterns have faded. We diagnose gaps and fast-track concept refresh.'
  },
  {
    id: 'interview',
    title: 'Improve my DSA and interview problem-solving',
    icon: '🎯',
    badge: 'Interview Prep',
    badgeColor: 'primary',
    description: 'Target coding assessments, placements, and technical interviews by mastering foundational algorithmic patterns.'
  },
  {
    id: 'practice',
    title: 'General problem-solving practice',
    icon: '⚡',
    badge: 'Continuous Practice',
    badgeColor: 'info',
    description: 'Sharpen implementation speed, write clean modular code, and build a consistent daily programming habit.'
  }
];

// Languages supported in CodeForge with honest capability notes
const LANGUAGE_OPTIONS = [
  {
    id: 'javascript',
    name: 'JavaScript',
    icon: 'JS',
    category: 'Web & Systems',
    statusNote: '✓ Sandboxed Code Execution & Practice Available',
    executionAvailable: true
  },
  {
    id: 'python',
    name: 'Python',
    icon: 'PY',
    category: 'Algorithms & Scripting',
    statusNote: '✓ Practice Problems & Conceptual Quizzes • Sandbox Execution Coming Soon',
    executionAvailable: false
  },
  {
    id: 'cpp',
    name: 'C++',
    icon: 'C++',
    category: 'Competitive & Performance',
    statusNote: '✓ Practice Problems & Concepts • Sandbox Execution Coming Soon',
    executionAvailable: false
  },
  {
    id: 'java',
    name: 'Java',
    icon: 'JV',
    category: 'Enterprise & Algorithms',
    statusNote: '✓ Practice Problems & Concepts • Sandbox Execution Coming Soon',
    executionAvailable: false
  },
  {
    id: 'c',
    name: 'C',
    icon: 'C',
    category: 'Foundational Systems',
    statusNote: '✓ Foundational Language Concepts & Memory Architecture',
    executionAvailable: false
  }
];

// Available topics from CodeForge's actual content catalogue
const TOPIC_OPTIONS = [
  { name: 'Arrays', group: 'DSA' },
  { name: 'Strings', group: 'DSA' },
  { name: 'Recursion', group: 'DSA' },
  { name: 'Stack', group: 'DSA' },
  { name: 'Queue', group: 'DSA' },
  { name: 'Linked List', group: 'DSA' },
  { name: 'Hashing', group: 'DSA' },
  { name: 'Searching', group: 'DSA' },
  { name: 'Sorting', group: 'DSA' },
  { name: 'JavaScript Fundamentals', group: 'Concepts' },
  { name: 'Data Structures & Algorithms', group: 'Concepts' },
  { name: 'Operating Systems', group: 'Concepts' },
  { name: 'Computer Networks', group: 'Concepts' },
  { name: 'Cybersecurity', group: 'Concepts' }
];

function getInitialDraft() {
  try {
    const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const { updateUser } = useAuth();

  const [initialDraft] = useState(getInitialDraft);

  const [currentStep, setCurrentStep] = useState(() => initialDraft?.currentStep || 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Form State
  const [selectedGoals, setSelectedGoals] = useState(() => initialDraft?.selectedGoals || ['revival']);
  const [selectedLanguages, setSelectedLanguages] = useState(
    () => initialDraft?.selectedLanguages || [{ language: 'javascript', status: 'revision' }]
  );
  const [selectedTopics, setSelectedTopics] = useState(
    () => initialDraft?.selectedTopics || ['Arrays', 'Strings', 'JavaScript Fundamentals']
  );
  const [preferredStartingMode, setPreferredStartingMode] = useState(
    () => initialDraft?.preferredStartingMode || 'diagnostic'
  );

  // Load existing profile from server if no draft exists
  useEffect(() => {
    let isMounted = true;

    if (!initialDraft) {
      getOnboarding().then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.onboarding) {
          const ob = res.data.onboarding;
          if (ob.learningGoals && ob.learningGoals.length > 0) {
            setSelectedGoals(ob.learningGoals);
          }
          if (ob.languages && ob.languages.length > 0) {
            setSelectedLanguages(ob.languages);
          }
          if (ob.selectedTopics && ob.selectedTopics.length > 0) {
            setSelectedTopics(ob.selectedTopics);
          }
          if (ob.preferredStartingMode) {
            setPreferredStartingMode(ob.preferredStartingMode);
          }
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [initialDraft]);

  // Save draft whenever state changes
  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          currentStep,
          selectedGoals,
          selectedLanguages,
          selectedTopics,
          preferredStartingMode
        })
      );
    } catch {
      // Storage unavailable fallback
    }
  }, [currentStep, selectedGoals, selectedLanguages, selectedTopics, preferredStartingMode]);

  // Goal toggle
  const toggleGoal = (goalId) => {
    setSelectedGoals((prev) => {
      if (prev.includes(goalId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((g) => g !== goalId);
      }
      return [...prev, goalId];
    });
    setErrorMessage(null);
  };

  // Language toggle
  const toggleLanguage = (langId) => {
    setSelectedLanguages((prev) => {
      const exists = prev.some((l) => l.language === langId);
      if (exists) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((l) => l.language !== langId);
      }
      // Default to revision if revival selected, else new
      const defaultStatus = selectedGoals.includes('revival') ? 'revision' : 'new';
      return [...prev, { language: langId, status: defaultStatus }];
    });
    setErrorMessage(null);
  };

  // Language status changer
  const setLanguageStatus = (langId, newStatus) => {
    setSelectedLanguages((prev) =>
      prev.map((l) => (l.language === langId ? { ...l, status: newStatus } : l))
    );
  };

  // Topic toggle
  const toggleTopic = (topicName) => {
    setSelectedTopics((prev) => {
      if (prev.includes(topicName)) {
        return prev.filter((t) => t !== topicName);
      }
      return [...prev, topicName];
    });
  };

  const selectAllTopics = () => {
    setSelectedTopics(TOPIC_OPTIONS.map((t) => t.name));
  };

  const clearTopics = () => {
    setSelectedTopics([]);
  };

  // Step Validation & Navigation
  const handleContinue = () => {
    setErrorMessage(null);

    if (currentStep === 1) {
      if (selectedGoals.length === 0) {
        setErrorMessage('Please select at least one learning goal to continue.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedLanguages.length === 0) {
        setErrorMessage('Please select at least one programming language to continue.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Step 3 (topics) is optional but recommended
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    setErrorMessage(null);
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Final Submission
  const handleComplete = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        learningGoals: selectedGoals,
        languages: selectedLanguages,
        preferredStartingMode,
        selectedTopics: selectedTopics.length > 0 ? selectedTopics : ['Arrays', 'Strings']
      };

      const res = await saveOnboarding(payload);

      if (res.ok && res.data?.success) {
        try {
          sessionStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch {}

        if (res.data.user) {
          updateUser(res.data.user);
        }
        navigate('/dashboard', { replace: true });
      } else {
        setErrorMessage(res.data?.message || 'Unable to save your preferences. Please try again.');
        setIsSubmitting(false);
      }
    } catch {
      setErrorMessage('Network error while saving onboarding preferences. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Skip onboarding
  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      const res = await skipOnboarding();
      try {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}

      if (res.ok && res.data?.user) {
        updateUser(res.data.user);
      }
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/dashboard', { replace: true });
    }
  };

  // Compute honest next action recommendation
  const getRecommendation = () => {
    const hasRevival = selectedGoals.includes('revival');
    const hasBeginner = selectedGoals.includes('beginner');
    const hasInterview = selectedGoals.includes('interview');
    const primaryLangObj = selectedLanguages[0];
    const primaryLangName =
      LANGUAGE_OPTIONS.find((l) => l.id === primaryLangObj?.language)?.name || 'JavaScript';

    if (hasRevival) {
      return {
        mode: 'diagnostic',
        title: `Refresh & Revive ${primaryLangName}`,
        reason: `Since you're reviving ${primaryLangName}, jumping directly into hard problem sets often leads to frustration with forgotten syntax. We suggest starting with a quick concept diagnostic to highlight knowledge gaps, followed by targeted refresh.`,
        suggestedAction: 'Take JavaScript Fundamentals Diagnostic Quiz',
        actionPath: '/quiz'
      };
    }

    if (hasInterview) {
      return {
        mode: 'diagnostic',
        title: 'Interview & DSA Readiness Assessment',
        reason: 'Preparing for coding interviews requires mastering core patterns under time constraints. We recommend diagnosing your DSA fundamentals first, then practising standard array and hashing challenges.',
        suggestedAction: 'Take Data Structures & Algorithms Assessment',
        actionPath: '/quiz'
      };
    }

    if (hasBeginner) {
      return {
        mode: 'fundamentals',
        title: `Foundations of ${primaryLangName}`,
        reason: `Starting with core fundamentals builds lasting intuition. We recommend working through foundational concept quizzes and beginner-friendly problem challenges.`,
        suggestedAction: 'Start Easy Practice Problems',
        actionPath: '/practice'
      };
    }

    return {
      mode: 'practice',
      title: 'Targeted Problem Practice',
      reason: 'Your goals emphasize consistent problem-solving. We have configured your practice catalog with filtered challenges matched to your chosen topics.',
      suggestedAction: 'Explore Practice Problems Catalog',
      actionPath: '/practice'
    };
  };

  const recommendation = getRecommendation();

  return (
    <div className="container py-4 py-md-5">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9 col-xl-8">
          {/* Header & Skip Action */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 small fw-semibold">
                {isEditMode ? 'Edit Learning Preferences' : 'Adaptive Onboarding • Step ' + currentStep + ' of 4'}
              </span>
              <h1 className="h3 fw-bold text-dark mt-2 mb-1">
                {isEditMode ? 'Update Your Learning Path' : 'Personalize Your CodeForge Path'}
              </h1>
              <p className="text-secondary small mb-0">
                Tailor your diagnostic assessments, problem recommendations, and practice pace.
              </p>
            </div>
            {!isEditMode && (
              <button
                type="button"
                className="btn btn-link text-secondary text-decoration-none small"
                onClick={handleSkip}
                disabled={isSubmitting}
              >
                Skip for now &rarr;
              </button>
            )}
          </div>

          {/* Step Progress Bar */}
          <div className="progress mb-4" style={{ height: '6px' }} role="progressbar" aria-valuenow={(currentStep / 4) * 100} aria-valuemin="0" aria-valuemax="100">
            <div
              className="progress-bar bg-primary transition-all"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="alert alert-danger py-2 px-3 small mb-4 d-flex align-items-center gap-2" role="alert">
              <span className="fw-bold" aria-hidden="true">✕</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 1: WELCOME & LEARNING GOALS                             */}
          {/* ============================================================ */}
          {currentStep === 1 && (
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <div className="mb-4">
                  <h2 className="h5 fw-bold text-dark mb-1">
                    How would you like to begin your learning journey?
                  </h2>
                  <p className="text-secondary small mb-0">
                    Select all that apply. CodeForge supports mixed and hybrid goals rather than forcing you into a single rigid path.
                  </p>
                </div>

                <div className="d-flex flex-column gap-3 mb-4" role="group" aria-label="Learning Goals">
                  {GOAL_OPTIONS.map((goal) => {
                    const isSelected = selectedGoals.includes(goal.id);
                    return (
                      <div
                        key={goal.id}
                        role="checkbox"
                        aria-checked={isSelected}
                        tabIndex={0}
                        onClick={() => toggleGoal(goal.id)}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            toggleGoal(goal.id);
                          }
                        }}
                        className={`p-3 p-md-4 rounded border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-primary bg-primary bg-opacity-10 shadow-sm'
                            : 'border-light-subtle bg-white'
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-start gap-3">
                          <span className="fs-3" aria-hidden="true">{goal.icon}</span>
                          <div className="flex-grow-1">
                            <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                              <h3 className="h6 fw-bold text-dark mb-0">{goal.title}</h3>
                              <span className={`badge bg-${goal.badgeColor}-subtle text-${goal.badgeColor} border small`}>
                                {goal.badge}
                              </span>
                            </div>
                            <p className="text-secondary small mb-0 lh-base">
                              {goal.description}
                            </p>
                          </div>
                          <div className="form-check m-0">
                            <input
                              type="checkbox"
                              className="form-check-input fs-5"
                              checked={isSelected}
                              onChange={() => toggleGoal(goal.id)}
                              aria-label={goal.title}
                              tabIndex={-1}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer Navigation */}
                <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                  <span className="small text-secondary">
                    {selectedGoals.length} goal{selectedGoals.length > 1 ? 's' : ''} selected
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary px-4 fw-semibold"
                    onClick={handleContinue}
                  >
                    Continue to Languages &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2: PROGRAMMING LANGUAGES & FAMILIARITY                 */}
          {/* ============================================================ */}
          {currentStep === 2 && (
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <div className="mb-4">
                  <h2 className="h5 fw-bold text-dark mb-1">
                    Select your focus language(s) and familiarity
                  </h2>
                  <p className="text-secondary small mb-0">
                    We clearly indicate the execution and practice status of each language in CodeForge.
                  </p>
                </div>

                <div className="d-flex flex-column gap-3 mb-4" role="group" aria-label="Programming Languages">
                  {LANGUAGE_OPTIONS.map((lang) => {
                    const langEntry = selectedLanguages.find((l) => l.language === lang.id);
                    const isSelected = Boolean(langEntry);

                    return (
                      <div
                        key={lang.id}
                        className={`p-3 rounded border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary bg-opacity-10'
                            : 'border-light-subtle bg-white'
                        }`}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                          <div
                            className="d-flex align-items-center gap-2 cursor-pointer flex-grow-1"
                            onClick={() => toggleLanguage(lang.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="badge bg-secondary font-monospace px-2 py-1">
                              {lang.icon}
                            </span>
                            <span className="fw-bold text-dark fs-6">{lang.name}</span>
                            <span className="badge bg-body-secondary text-secondary small">
                              {lang.category}
                            </span>
                          </div>
                          <div className="form-check m-0">
                            <input
                              type="checkbox"
                              className="form-check-input fs-5"
                              checked={isSelected}
                              onChange={() => toggleLanguage(lang.id)}
                              aria-label={`Select ${lang.name}`}
                            />
                          </div>
                        </div>

                        <p className="small text-secondary mb-2">
                          {lang.statusNote}
                        </p>

                        {/* Familiarity Segmented Radios when Selected */}
                        {isSelected && (
                          <div className="mt-3 pt-2 border-top">
                            <label className="form-label small fw-semibold text-secondary d-block mb-2">
                              Your familiarity with {lang.name}:
                            </label>
                            <div className="d-flex flex-wrap gap-2" role="radiogroup" aria-label={`${lang.name} familiarity`}>
                              {[
                                { status: 'new', label: '🌱 New to me' },
                                { status: 'revision', label: '🔄 Learned before, needs revision' },
                                { status: 'practicing', label: '⚡ Comfortable, ready to practise' }
                              ].map((opt) => (
                                <button
                                  key={opt.status}
                                  type="button"
                                  role="radio"
                                  aria-checked={langEntry.status === opt.status}
                                  className={`btn btn-sm ${
                                    langEntry.status === opt.status
                                      ? 'btn-primary fw-semibold'
                                      : 'btn-outline-secondary'
                                  }`}
                                  onClick={() => setLanguageStatus(lang.id, opt.status)}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Footer Navigation */}
                <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-3"
                    onClick={handleBack}
                  >
                    &larr; Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary px-4 fw-semibold"
                    onClick={handleContinue}
                  >
                    Continue to Topics &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3: FOCUS AREAS & TOPICS SELECTION                      */}
          {/* ============================================================ */}
          {currentStep === 3 && (
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <h2 className="h5 fw-bold text-dark mb-1">
                      Pick your priority topics
                    </h2>
                    <p className="text-secondary small mb-0">
                      These topics directly correspond to genuine problems and quizzes currently available in CodeForge.
                    </p>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={selectAllTopics}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={clearTopics}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="h6 fw-bold text-secondary text-uppercase small mb-2">
                    Data Structures & Algorithms Topics
                  </h3>
                  <div className="d-flex flex-wrap gap-2 mb-4">
                    {TOPIC_OPTIONS.filter((t) => t.group === 'DSA').map((t) => {
                      const isSelected = selectedTopics.includes(t.name);
                      return (
                        <button
                          key={t.name}
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${
                            isSelected ? 'btn-primary fw-semibold' : 'btn-outline-secondary'
                          }`}
                          onClick={() => toggleTopic(t.name)}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {t.name}
                        </button>
                      );
                    })}
                  </div>

                  <h3 className="h6 fw-bold text-secondary text-uppercase small mb-2">
                    Core Concepts & Assessment Topics
                  </h3>
                  <div className="d-flex flex-wrap gap-2">
                    {TOPIC_OPTIONS.filter((t) => t.group === 'Concepts').map((t) => {
                      const isSelected = selectedTopics.includes(t.name);
                      return (
                        <button
                          key={t.name}
                          type="button"
                          className={`btn btn-sm rounded-pill px-3 py-1 ${
                            isSelected ? 'btn-primary fw-semibold' : 'btn-outline-secondary'
                          }`}
                          onClick={() => toggleTopic(t.name)}
                          aria-pressed={isSelected}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Navigation */}
                <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-3"
                    onClick={handleBack}
                  >
                    &larr; Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary px-4 fw-semibold"
                    onClick={handleContinue}
                  >
                    Review Plan &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 4: PERSONALISATION SUMMARY & RECOMMENDATION            */}
          {/* ============================================================ */}
          {currentStep === 4 && (
            <div className="card shadow-sm border-0">
              <div className="card-body p-4 p-md-5">
                <div className="mb-4">
                  <h2 className="h5 fw-bold text-dark mb-1">
                    Your Personalized Learning Plan
                  </h2>
                  <p className="text-secondary small mb-0">
                    Review your choices. We've synthesized a tailored starting path using CodeForge's actual content.
                  </p>
                </div>

                {/* Tailored Recommendation Card */}
                <div className="card border-primary bg-primary bg-opacity-10 mb-4 p-3 p-md-4">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-primary px-3 py-1 fw-semibold">
                      Tailored Starting Recommendation
                    </span>
                  </div>
                  <h3 className="h5 fw-bold text-dark mb-2">
                    {recommendation.title}
                  </h3>
                  <p className="small text-secondary mb-3 lh-base">
                    {recommendation.reason}
                  </p>
                  <div className="p-3 bg-white rounded border small d-flex align-items-center justify-content-between gap-2">
                    <div>
                      <span className="fw-semibold text-dark d-block">Suggested Immediate Action:</span>
                      <span className="text-primary">{recommendation.suggestedAction}</span>
                    </div>
                    <span className="badge bg-success-subtle text-success border border-success-subtle">
                      Ready on Dashboard
                    </span>
                  </div>
                </div>

                {/* Profile Summary */}
                <div className="bg-light p-3 rounded border mb-4">
                  <h4 className="h6 fw-bold text-dark mb-3">Plan Summary</h4>
                  <div className="row g-3 small">
                    <div className="col-12 col-md-6">
                      <span className="text-secondary d-block fw-semibold mb-1">Goals:</span>
                      <div className="d-flex flex-wrap gap-1">
                        {selectedGoals.map((g) => {
                          const goal = GOAL_OPTIONS.find((item) => item.id === g);
                          return (
                            <span key={g} className="badge bg-body-secondary text-body border">
                              {goal ? goal.badge : g}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <span className="text-secondary d-block fw-semibold mb-1">Languages & Status:</span>
                      <div className="d-flex flex-wrap gap-1">
                        {selectedLanguages.map((l) => (
                          <span key={l.language} className="badge bg-body-secondary text-body border font-monospace">
                            {l.language} ({l.status})
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="col-12">
                      <span className="text-secondary d-block fw-semibold mb-1">Selected Topics:</span>
                      <div className="d-flex flex-wrap gap-1">
                        {selectedTopics.length > 0 ? (
                          selectedTopics.map((t) => (
                            <span key={t} className="badge bg-body-secondary text-body border small">
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-secondary fst-italic">All general topics</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Choose Starting Mode */}
                <div className="mb-4">
                  <label className="form-label fw-bold text-dark small mb-2">
                    Preferred Starting Experience:
                  </label>
                  <div className="row g-2">
                    {[
                      { id: 'diagnostic', title: 'Diagnostic Assessment', desc: 'Identify gaps with a quick quiz' },
                      { id: 'practice', title: 'Coding Practice', desc: 'Jump straight into practice problems' },
                      { id: 'fundamentals', title: 'Core Concepts', desc: 'Start with fundamental theory & code' },
                      { id: 'custom', title: 'Self-Guided', desc: 'Explore the platform freely' }
                    ].map((mode) => (
                      <div key={mode.id} className="col-12 col-sm-6">
                        <div
                          className={`p-3 rounded border cursor-pointer h-100 ${
                            preferredStartingMode === mode.id
                              ? 'border-primary bg-primary bg-opacity-10'
                              : 'bg-white'
                          }`}
                          onClick={() => setPreferredStartingMode(mode.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="form-check">
                            <input
                              type="radio"
                              name="startingMode"
                              id={`mode-${mode.id}`}
                              className="form-check-input"
                              checked={preferredStartingMode === mode.id}
                              onChange={() => setPreferredStartingMode(mode.id)}
                            />
                            <label htmlFor={`mode-${mode.id}`} className="form-check-label fw-bold small text-dark d-block">
                              {mode.title}
                            </label>
                            <span className="text-secondary small d-block">
                              {mode.desc}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Navigation */}
                <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-3"
                    onClick={handleBack}
                    disabled={isSubmitting}
                  >
                    &larr; Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-success px-4 py-2 fw-bold shadow-sm d-flex align-items-center gap-2"
                    onClick={handleComplete}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>✓ Save & Go to Dashboard</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

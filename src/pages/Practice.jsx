import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
// SYLLABUS REQUIREMENT: Isolated jQuery usage for subtle micro-interactions.
// React retains 100% control over the rendered DOM and application state.
import $ from 'jquery';

import problemsData from '../data/problems';
import ProblemCard from '../components/ProblemCard';
import FilterPanel from '../components/FilterPanel';
import Icon from '../components/Icons';
import { validateSearchQuery } from '../utils/validation';
import { useAuth } from '../context/useAuth';
import { getProblems, getMyProgress, getMyProblemProgress } from '../utils/api';

/**
 * Practice Problems Page
 * Features responsive layout with search, multi-criteria filtering (language dropdown,
 * difficulty radio buttons, topics checkboxes), active filter tags, real-time user practice progress,
 * and problem results grid backed directly by the MongoDB API.
 */
export default function Practice() {
  const { isAuthenticated } = useAuth();
  const [completedIds, setCompletedIds] = useState(new Set());
  const [userProgress, setUserProgress] = useState({
    totalAttempted: 0,
    solved: 0,
    incorrect: 0,
    byProblem: []
  });

  // Backend problems state
  const [apiProblems, setApiProblems] = useState(null);
  const [isLoadingProblems, setIsLoadingProblems] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [totalInDb, setTotalInDb] = useState(problemsData.length);

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // Fetch authenticated user's completion progress from MongoDB
  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated) {
      Promise.all([getMyProgress(), getMyProblemProgress()]).then(([progRes, probProgRes]) => {
        if (!isMounted) return;

        const ids = new Set();
        let solved = 0;
        let attempted = 0;

        if (progRes.ok && Array.isArray(progRes.data?.progress)) {
          progRes.data.progress.forEach((item) => {
            if (item.completed) {
              solved++;
              if (item.problem?._id) ids.add(item.problem._id.toString());
              if (item.problem?.slug) ids.add(item.problem.slug);
              if (item.problem?.id) ids.add(item.problem.id);
              if (typeof item.problem === 'string') ids.add(item.problem);
            }
            attempted++;
          });
        }

        if (probProgRes.ok && probProgRes.data?.progress) {
          if (Array.isArray(probProgRes.data.progress.byProblem)) {
            probProgRes.data.progress.byProblem.forEach((p) => {
              if (p.status === 'Accepted') {
                ids.add(p.problemId);
              }
            });
          }
          if (probProgRes.data.progress.solved > solved) {
            solved = probProgRes.data.progress.solved;
          }
          if (probProgRes.data.progress.totalAttempted > attempted) {
            attempted = probProgRes.data.progress.totalAttempted;
          }
        }

        setUserProgress({
          totalAttempted: attempted,
          solved,
          incorrect: Math.max(0, attempted - solved),
          byProblem: probProgRes.data?.progress?.byProblem || []
        });
        setCompletedIds(ids);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  // Pending filter panel state (inside form)
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedTopics, setSelectedTopics] = useState([]);

  // Applied filter state (drives results grid)
  const [appliedFilters, setAppliedFilters] = useState({
    language: 'All',
    difficulty: 'All',
    topics: []
  });

  // Form validation feedback
  const [validationError, setValidationError] = useState(null);
  const [validationMessage, setValidationMessage] = useState(null);

  // Trigger isolated jQuery animation for visual feedback on results count
  const triggerResultsFeedback = () => {
    $('#results-summary-badge')
      .stop(true, true)
      .css({ opacity: 0.3 })
      .animate({ opacity: 1 }, 250);
  };

  // Toggle individual topic in checkbox list
  const handleTopicToggle = (topic) => {
    setSelectedTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
    );
  };

  // Form submission handler to apply search & filters
  const handleApplyFilters = () => {
    // Validate search input
    const validation = validateSearchQuery(searchInput);
    if (!validation.isValid) {
      setValidationError(validation.message);
      setValidationMessage(null);
      return;
    }

    setValidationError(null);
    setAppliedSearch(searchInput.trim());
    setAppliedFilters({
      language: selectedLanguage,
      difficulty: selectedDifficulty,
      topics: [...selectedTopics]
    });

    setValidationMessage('Filters applied successfully.');
    setTimeout(() => setValidationMessage(null), 3000);
    triggerResultsFeedback();
  };

  // Reset all filters and search back to default state
  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setSelectedLanguage('All');
    setSelectedDifficulty('All');
    setSelectedTopics([]);
    setAppliedFilters({
      language: 'All',
      difficulty: 'All',
      topics: []
    });
    setValidationError(null);
    setValidationMessage(null);
    triggerResultsFeedback();
  };

  // Handlers for individual active filter badge removals
  const removeSearchFilter = () => {
    setSearchInput('');
    setAppliedSearch('');
    triggerResultsFeedback();
  };

  const removeLanguageFilter = () => {
    setSelectedLanguage('All');
    setAppliedFilters((prev) => ({ ...prev, language: 'All' }));
    triggerResultsFeedback();
  };

  const removeDifficultyFilter = () => {
    setSelectedDifficulty('All');
    setAppliedFilters((prev) => ({ ...prev, difficulty: 'All' }));
    triggerResultsFeedback();
  };

  const removeTopicFilter = (topicToRemove) => {
    const updated = selectedTopics.filter((t) => t !== topicToRemove);
    setSelectedTopics(updated);
    setAppliedFilters((prev) => ({ ...prev, topics: updated }));
    triggerResultsFeedback();
  };

  // Filter problems based on applied criteria and search query (fallback)
  const filteredProblems = useMemo(() => {
    return problemsData.filter((problem) => {
      // 1. Language Filter
      if (
        appliedFilters.language !== 'All' &&
        problem.language.toLowerCase() !== appliedFilters.language.toLowerCase()
      ) {
        return false;
      }

      // 2. Difficulty Filter
      if (
        appliedFilters.difficulty !== 'All' &&
        problem.difficulty.toLowerCase() !== appliedFilters.difficulty.toLowerCase()
      ) {
        return false;
      }

      // 3. Topics Filter (problem must include all or any selected topics)
      if (appliedFilters.topics.length > 0) {
        const matchesAnyTopic = appliedFilters.topics.some((selectedTopic) =>
          problem.topics.some((pt) => pt.toLowerCase() === selectedTopic.toLowerCase())
        );
        if (!matchesAnyTopic) return false;
      }

      // 4. Search Filter (matches title, description, or topics)
      if (appliedSearch) {
        const query = appliedSearch.toLowerCase();
        const matchesTitle = problem.title.toLowerCase().includes(query);
        const matchesDesc = problem.description.toLowerCase().includes(query);
        const matchesTopic = problem.topics.some((t) => t.toLowerCase().includes(query));
        const matchesLanguage = problem.language.toLowerCase().includes(query);

        if (!matchesTitle && !matchesDesc && !matchesTopic && !matchesLanguage) {
          return false;
        }
      }

      return true;
    });
  }, [appliedFilters, appliedSearch]);

  // Fetch problems from MongoDB with server-side filters & search
  useEffect(() => {
    let isMounted = true;

    getProblems({
      search: appliedSearch,
      language: appliedFilters.language,
      difficulty: appliedFilters.difficulty,
      topic: appliedFilters.topics.join(','),
      limit: 50
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success && Array.isArray(res.data.problems)) {
          setApiProblems(res.data.problems);
          if (res.data.pagination?.total !== undefined) {
            setTotalInDb(res.data.pagination.total);
          }
        } else {
          setLoadError(res.data?.message || 'Failed to load problems from CodeForge API.');
        }
      })
      .catch((err) => {
        if (isMounted) setLoadError(err.message || 'Network error connecting to CodeForge API.');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingProblems(false);
          triggerResultsFeedback();
        }
      });

    return () => {
      isMounted = false;
    };
  }, [appliedFilters, appliedSearch]);

  // Prefer backend data if fetched, fallback to local memoized filter
  const displayProblems = apiProblems !== null ? apiProblems : filteredProblems;

  // Check if any non-default filter is currently active
  const hasActiveFilters =
    appliedSearch.length > 0 ||
    appliedFilters.language !== 'All' ||
    appliedFilters.difficulty !== 'All' ||
    appliedFilters.topics.length > 0;

  // On initial mount, attach subtle focus styling via jQuery for demonstration
  useEffect(() => {
    const $search = $('#problem-search-input');
    $search.on('focus', function () {
      $(this).addClass('border-primary shadow-sm');
    }).on('blur', function () {
      $(this).removeClass('border-primary shadow-sm');
    });

    return () => {
      $search.off('focus blur');
    };
  }, []);

  return (
    <div className="practice-page container py-5">
      {/* SECTION 1: PAGE HEADER */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 pb-3 border-bottom gap-3">
        <div>
          <h1 className="display-6 fw-bold text-dark mb-1">Practice Problems</h1>
          <p className="lead text-secondary mb-0 fs-6">
            Solve coding challenges. Build problem-solving skills. Improve one problem at a time.
          </p>
        </div>
        <span className="badge bg-success-subtle text-success border border-success-subtle small px-3 py-2 d-inline-flex align-items-center gap-1">
          <Icon name="check-circle" size={13} /> Problems loaded from CodeForge API
        </span>
      </div>

      {/* SECTION 2: PRACTICE PROGRESS CARD */}
      <div className="card border-0 shadow-sm mb-5 bg-white">
        <div className="card-body p-4">
          {isAuthenticated ? (
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
                <div>
                  <h2 className="h6 fw-bold text-dark mb-1">Your Practice Progress</h2>
                  <p className="text-secondary small mb-0">Authenticated activity synchronized in MongoDB</p>
                </div>
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle small px-2 py-1">
                  MongoDB Verified
                </span>
              </div>
              <div className="row g-3 text-center my-1">
                <div className="col-4 border-end">
                  <div className="text-secondary small fw-semibold text-uppercase">Problems Solved</div>
                  <strong className="fs-4 text-success font-monospace">
                    {userProgress.solved} <span className="fs-6 text-muted">/ {totalInDb}</span>
                  </strong>
                </div>
                <div className="col-4 border-end">
                  <div className="text-secondary small fw-semibold text-uppercase">Attempted</div>
                  <strong className="fs-4 text-primary font-monospace">{userProgress.totalAttempted}</strong>
                </div>
                <div className="col-4">
                  <div className="text-secondary small fw-semibold text-uppercase">Accuracy</div>
                  <strong className="fs-4 text-info font-monospace">
                    {userProgress.totalAttempted > 0
                      ? Math.round((userProgress.solved / userProgress.totalAttempted) * 100)
                      : 0}%
                  </strong>
                </div>
              </div>
              <div className="mt-3">
                <div className="d-flex justify-content-between small text-secondary mb-1">
                  <span>Catalog Completion</span>
                  <span className="fw-bold font-monospace">
                    {totalInDb > 0 ? Math.round((userProgress.solved / totalInDb) * 100) : 0}%
                  </span>
                </div>
                <div className="progress" style={{ height: '8px' }}>
                  <div
                    className="progress-bar bg-success"
                    role="progressbar"
                    style={{
                      width: `${totalInDb > 0 ? Math.round((userProgress.solved / totalInDb) * 100) : 0}%`
                    }}
                    aria-valuenow={totalInDb > 0 ? Math.round((userProgress.solved / totalInDb) * 100) : 0}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3">
              <div>
                <h2 className="h6 fw-bold text-dark mb-1">Track Your Practice Progress</h2>
                <p className="text-secondary small mb-0">
                  Log in to track your practice progress, submit challenge attempts, and build mastery in MongoDB.
                </p>
              </div>
              <Link to="/login" className="btn btn-outline-primary btn-sm px-4 fw-semibold flex-shrink-0">
                Log In to Track Progress &rarr;
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ERROR ALERT IF API FAILED */}
      {loadError && (
        <div className="alert alert-warning py-3 px-4 mb-4" role="alert">
          <div className="d-flex justify-content-between align-items-center">
            <span className="d-inline-flex align-items-center gap-2">
              <Icon name="alert-triangle" size={16} />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-warning"
              onClick={() => handleApplyFilters()}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <div className="row g-4">
        {/* SECTION 3: FILTER PANEL (Sidebar on Desktop, Stacked on Mobile) */}
        <div className="col-lg-4 col-xl-3">
          <FilterPanel
            selectedLanguage={selectedLanguage}
            onLanguageChange={setSelectedLanguage}
            selectedDifficulty={selectedDifficulty}
            onDifficultyChange={setSelectedDifficulty}
            selectedTopics={selectedTopics}
            onTopicToggle={handleTopicToggle}
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            validationError={validationError}
            validationMessage={validationMessage}
          />
        </div>

        {/* SECTION 4: SEARCH, ACTIVE FILTERS, RESULTS SUMMARY, AND PROBLEM GRID */}
        <div className="col-lg-8 col-xl-9">
          {/* Search Input Bar */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body p-3">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <Icon name="search" size={16} />
                </span>
                <input
                  id="problem-search-input"
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Search problems by title, description, or topic..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyFilters();
                    }
                  }}
                />
                {searchInput && (
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setAppliedSearch('');
                      triggerResultsFeedback();
                    }}
                    title="Clear search"
                  >
                    &times;
                  </button>
                )}
                <button
                  className="btn btn-primary px-4 fw-semibold"
                  type="button"
                  onClick={handleApplyFilters}
                >
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="d-flex flex-wrap align-items-center gap-2 mb-4 p-3 bg-white rounded-3 border border-light-subtle shadow-sm">
              <span className="small fw-bold text-secondary me-1">Active Filters:</span>

              {appliedSearch && (
                <span className="badge bg-primary text-white d-inline-flex align-items-center gap-1 py-2 px-2">
                  Search: "{appliedSearch}"
                  <button
                    type="button"
                    className="btn-close btn-close-white ms-1"
                    style={{ fontSize: '0.65rem' }}
                    aria-label="Remove search filter"
                    onClick={removeSearchFilter}
                  ></button>
                </span>
              )}

              {appliedFilters.language !== 'All' && (
                <span className="badge bg-secondary text-white d-inline-flex align-items-center gap-1 py-2 px-2">
                  {appliedFilters.language}
                  <button
                    type="button"
                    className="btn-close btn-close-white ms-1"
                    style={{ fontSize: '0.65rem' }}
                    aria-label={`Remove ${appliedFilters.language} filter`}
                    onClick={removeLanguageFilter}
                  ></button>
                </span>
              )}

              {appliedFilters.difficulty !== 'All' && (
                <span className="badge bg-info text-dark d-inline-flex align-items-center gap-1 py-2 px-2">
                  {appliedFilters.difficulty}
                  <button
                    type="button"
                    className="btn-close ms-1"
                    style={{ fontSize: '0.65rem' }}
                    aria-label={`Remove ${appliedFilters.difficulty} filter`}
                    onClick={removeDifficultyFilter}
                  ></button>
                </span>
              )}

              {appliedFilters.topics.map((topic) => (
                <span
                  key={topic}
                  className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 py-2 px-2"
                >
                  #{topic}
                  <button
                    type="button"
                    className="btn-close ms-1"
                    style={{ fontSize: '0.65rem' }}
                    aria-label={`Remove ${topic} filter`}
                    onClick={() => removeTopicFilter(topic)}
                  ></button>
                </span>
              ))}

              <button
                type="button"
                className="btn btn-link btn-sm text-decoration-none text-muted p-0 ms-auto small"
                onClick={handleResetFilters}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Results Summary Counter */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div id="results-count-container" className="d-flex align-items-center gap-2">
              <span id="results-summary-badge" className="fw-bold text-dark fs-5">
                {displayProblems.length}{' '}
                {displayProblems.length === 1 ? 'problem found' : 'problems found'}
              </span>
              <span className="text-secondary small">
                (showing {displayProblems.length} of {totalInDb})
              </span>
            </div>
            {isLoadingProblems && (
              <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true"></span>
            )}
          </div>

          {/* Results Grid or Empty State */}
          {displayProblems.length > 0 ? (
            <div className="row g-4">
              {displayProblems.map((problem) => (
                <div key={problem.slug || problem.id} className="col-12 col-md-6 col-xl-6">
                  <ProblemCard
                    problem={problem}
                    isCompleted={
                      isAuthenticated &&
                      (completedIds.has(problem._id?.toString()) ||
                        completedIds.has(problem.slug) ||
                        completedIds.has(problem.id))
                    }
                    isAuthenticated={isAuthenticated}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="card border-0 shadow-sm text-center py-5 px-3">
              <div className="card-body">
                <div className="mb-3 text-secondary">
                  <Icon name="search" size={48} />
                </div>
                <h3 className="h4 fw-bold text-dark mb-2">No problems found</h3>
                <p className="text-secondary mb-4 col-md-6 mx-auto">
                  No practice challenges match your current search and filter combination.
                  Try broadening your criteria or reset all filters.
                </p>
                <button
                  type="button"
                  className="btn btn-primary px-4 fw-semibold"
                  onClick={handleResetFilters}
                >
                  Reset Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Pure Deterministic Roadmap Planning Engine (Milestone 15C)
 * 
 * Converts learner preferences (onboarding profile) and observed diagnostic evidence
 * into a prioritized, actionable, and persistent revision roadmap.
 *
 * Guarantees:
 * 1. Deterministic output: Same inputs produce identical recommendations and priorities.
 * 2. Five explicit topic states:
 *    - 'needs_revision' (< 70% accuracy, >= 2 questions answered)
 *    - 'promising' (>= 70% accuracy, >= 2 questions answered)
 *    - 'not_enough_evidence' (< 2 questions answered)
 *    - 'unassessed' (no assessment questions available or topic unassessed)
 *    - 'not_started' (no assessment activity recorded yet)
 * 3. Never confuses learner preference with demonstrated ability.
 * 4. Grounded in CodeForge's genuine catalogues (quizzes, problems, diagnostics).
 * 5. Respects prior completions to avoid recommending already-solved challenges.
 */

export const TOPIC_STATE = {
  NEEDS_REVISION: 'needs_revision',
  PROMISING: 'promising',
  NOT_ENOUGH_EVIDENCE: 'not_enough_evidence',
  UNASSESSED: 'unassessed',
  NOT_STARTED: 'not_started'
};

export const ACTION_TYPE = {
  REVIEW: 'review',
  DIAGNOSE: 'diagnose',
  PRACTICE: 'practice',
  QUIZ: 'quiz',
  ADVANCE: 'advance'
};

// Priority tier weights (lower number = higher urgency)
const STATE_PRIORITY_BASE = {
  [TOPIC_STATE.NEEDS_REVISION]: 100,
  [TOPIC_STATE.NOT_ENOUGH_EVIDENCE]: 200,
  [TOPIC_STATE.UNASSESSED]: 300,
  [TOPIC_STATE.PROMISING]: 400,
  [TOPIC_STATE.NOT_STARTED]: 500
};

/**
 * Standard Topic Canonical Map
 */
export const CANONICAL_TOPICS = {
  'javascript fundamentals': 'JavaScript',
  'javascript': 'JavaScript',
  'data structures & algorithms': 'Data Structures & Algorithms',
  'dsa': 'Data Structures & Algorithms',
  'arrays': 'Arrays',
  'strings': 'Strings',
  'searching': 'Searching',
  'linked list': 'Linked List',
  'stack': 'Stack',
  'queue': 'Queue',
  'recursion': 'Recursion',
  'hashing': 'Hashing',
  'sorting': 'Sorting',
  'dynamic programming': 'Dynamic Programming',
  'dp': 'Dynamic Programming',
  'operating systems': 'Operating Systems',
  'computer networks': 'Computer Networks',
  'cybersecurity': 'Cybersecurity'
};

/**
 * Genuine Quiz Catalog Mapping
 */
export const QUIZ_CATALOG_MAP = {
  'JavaScript': {
    quizId: 'javascript-fundamentals',
    title: 'JavaScript Fundamentals',
    difficulty: 'Easy',
    url: '/quiz?quizId=javascript-fundamentals'
  },
  'Data Structures & Algorithms': {
    quizId: 'dsa-foundations',
    title: 'Data Structures & Algorithms Foundations',
    difficulty: 'Medium',
    url: '/quiz?quizId=dsa-foundations'
  },
  'Operating Systems': {
    quizId: 'operating-systems',
    title: 'Operating Systems Concepts',
    difficulty: 'Medium',
    url: '/quiz?quizId=operating-systems'
  },
  'Computer Networks': {
    quizId: 'computer-networks',
    title: 'Computer Networks & Protocols',
    difficulty: 'Medium',
    url: '/quiz?quizId=computer-networks'
  },
  'Cybersecurity': {
    quizId: 'cybersecurity-essentials',
    title: 'Cybersecurity Essentials',
    difficulty: 'Easy',
    url: '/quiz?quizId=cybersecurity-essentials'
  }
};

/**
 * Genuine Problem Sequences per Topic (Easy -> Medium -> Hard)
 */
export const TOPIC_PROBLEM_SEQUENCES = {
  'Arrays': [
    { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' },
    { slug: 'container-with-most-water', title: 'Container With Most Water', difficulty: 'Medium' },
    { slug: 'trapping-rain-water', title: 'Trapping Rain Water', difficulty: 'Hard' }
  ],
  'Strings': [
    { slug: 'reverse-string', title: 'Reverse String', difficulty: 'Easy' },
    { slug: 'longest-substring-without-repeating-characters', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium' }
  ],
  'Searching': [
    { slug: 'binary-search', title: 'Binary Search', difficulty: 'Easy' },
    { slug: 'search-in-rotated-sorted-array', title: 'Search in Rotated Sorted Array', difficulty: 'Medium' },
    { slug: 'median-of-two-sorted-arrays', title: 'Median of Two Sorted Arrays', difficulty: 'Hard' }
  ],
  'Linked List': [
    { slug: 'merge-two-sorted-lists', title: 'Merge Two Sorted Lists', difficulty: 'Easy' },
    { slug: 'reverse-linked-list', title: 'Reverse Linked List', difficulty: 'Medium' },
    { slug: 'lru-cache', title: 'LRU Cache', difficulty: 'Medium' }
  ],
  'Stack': [
    { slug: 'valid-parentheses', title: 'Valid Parentheses', difficulty: 'Easy' },
    { slug: 'daily-temperatures', title: 'Daily Temperatures', difficulty: 'Medium' },
    { slug: 'largest-rectangle-in-histogram', title: 'Largest Rectangle in Histogram', difficulty: 'Hard' }
  ],
  'Recursion': [
    { slug: 'reverse-string', title: 'Reverse String', difficulty: 'Easy' },
    { slug: 'merge-two-sorted-lists', title: 'Merge Two Sorted Lists', difficulty: 'Easy' }
  ],
  'Hashing': [
    { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' },
    { slug: 'longest-substring-without-repeating-characters', title: 'Longest Substring Without Repeating Characters', difficulty: 'Medium' }
  ],
  'JavaScript': [
    { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' },
    { slug: 'container-with-most-water', title: 'Container With Most Water', difficulty: 'Medium' },
    { slug: 'trapping-rain-water', title: 'Trapping Rain Water', difficulty: 'Hard' }
  ],
  'Data Structures & Algorithms': [
    { slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy' },
    { slug: 'binary-search', title: 'Binary Search', difficulty: 'Easy' },
    { slug: 'container-with-most-water', title: 'Container With Most Water', difficulty: 'Medium' }
  ]
};

/**
 * Normalizes topic names to canonical names.
 */
export function normalizeTopicName(topic) {
  if (!topic || typeof topic !== 'string') return 'General';
  const clean = topic.trim().toLowerCase();
  return CANONICAL_TOPICS[clean] || topic.trim();
}

/**
 * Converts a string into a clean kebab-case ID token.
 */
export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/**
 * Selects an unsolved problem for a topic, or returns the most advanced if all are solved.
 */
function pickProblemForTopic(topic, completedSlugs = new Set(), preferredDifficulty = 'Easy') {
  const sequence = TOPIC_PROBLEM_SEQUENCES[topic];
  if (!sequence || sequence.length === 0) {
    return null;
  }

  // 1. If preferred difficulty is Hard or Medium, try to find unsolved of that difficulty
  if (preferredDifficulty === 'Hard') {
    const hard = sequence.find((p) => p.difficulty === 'Hard' && !completedSlugs.has(p.slug));
    if (hard) return hard;
    const med = sequence.find((p) => p.difficulty === 'Medium' && !completedSlugs.has(p.slug));
    if (med) return med;
  } else if (preferredDifficulty === 'Medium') {
    const med = sequence.find((p) => p.difficulty === 'Medium' && !completedSlugs.has(p.slug));
    if (med) return med;
  }

  // 2. Find first unsolved problem in sequence
  const unsolved = sequence.find((p) => !completedSlugs.has(p.slug));
  if (unsolved) return unsolved;

  // 3. If all solved, return the last one (most challenging)
  return sequence[sequence.length - 1];
}

/**
 * Determines whether all problems for a topic have been completed.
 */
function areAllProblemsCompleted(topic, completedSlugs = new Set()) {
  const sequence = TOPIC_PROBLEM_SEQUENCES[topic];
  if (!sequence || sequence.length === 0) return false;
  return sequence.every((p) => completedSlugs.has(p.slug));
}

/**
 * Pure generator function to calculate a user's revision roadmap.
 *
 * @param {Object} params
 * @param {Object} params.user - Authenticated user doc or lean object
 * @param {Object} [params.latestDiagnostic] - Latest submitted DiagnosticSession (or null)
 * @param {Set<string>|Array<string>} [params.completedProblemSlugs] - Slugs of problems solved by user
 * @param {Set<string>|Array<string>} [params.passedQuizIds] - IDs of quizzes passed by user
 * @param {Array<Object>} [params.previousRecommendations] - Prior recommendations to preserve completion
 * @returns {Object} Complete roadmap object ready for persistence
 */
export function generateRoadmap({
  user = {},
  latestDiagnostic = null,
  completedProblemSlugs = new Set(),
  passedQuizIds = new Set(),
  previousRecommendations = [],
  reassessmentComparison = null
}) {
  const completedProblems = completedProblemSlugs instanceof Set 
    ? completedProblemSlugs 
    : new Set(completedProblemSlugs || []);
  const passedQuizzes = passedQuizIds instanceof Set 
    ? passedQuizIds 
    : new Set(passedQuizIds || []);

  // Map previous completion states by recommendation ID
  const prevCompletionMap = new Map();
  if (Array.isArray(previousRecommendations)) {
    for (const item of previousRecommendations) {
      if (item && item.id) {
        prevCompletionMap.set(item.id, {
          isCompleted: Boolean(item.isCompleted),
          completedAt: item.completedAt || null
        });
      }
    }
  }

  const selectedTopics = Array.isArray(user.selectedTopics) && user.selectedTopics.length > 0
    ? user.selectedTopics.map(normalizeTopicName)
    : [];

  // 1. Gather all topics that need evaluation
  // Topics can come from onboarding selections, diagnostic results, or fallback
  const topicSet = new Set();

  // If user selected focus topics in onboarding, prioritize those
  selectedTopics.forEach((t) => topicSet.add(t));

  // If latest submitted diagnostic exists, incorporate assessed and unassessed topics
  const diagnosticTopicMap = new Map();
  const unassessedTopicSet = new Set();

  if (latestDiagnostic && latestDiagnostic.status === 'submitted') {
    if (Array.isArray(latestDiagnostic.topicResults)) {
      for (const res of latestDiagnostic.topicResults) {
        const canonical = normalizeTopicName(res.topic);
        diagnosticTopicMap.set(canonical, res);
        topicSet.add(canonical);
      }
    }
    if (Array.isArray(latestDiagnostic.unassessedTopics)) {
      for (const un of latestDiagnostic.unassessedTopics) {
        const canonical = normalizeTopicName(un.topic);
        unassessedTopicSet.add(canonical);
        topicSet.add(canonical);
      }
    }
  }

  // If still empty, supply sensible defaults based on user's primary language
  if (topicSet.size === 0) {
    const primaryLang = user.languages?.[0]?.language?.toLowerCase() || 'javascript';
    if (primaryLang === 'javascript') {
      topicSet.add('JavaScript');
      topicSet.add('Arrays');
    } else {
      topicSet.add('Data Structures & Algorithms');
      topicSet.add('Arrays');
    }
  }

  const topicList = Array.from(topicSet);
  const recommendations = [];

  // 2. Evaluate state and recommendation for each topic
  for (const topic of topicList) {
    const diagResult = diagnosticTopicMap.get(topic);
    const isExplicitlyUnassessed = unassessedTopicSet.has(topic);

    let state = TOPIC_STATE.NOT_STARTED;
    let sampleSize = 0;
    let correctCount = 0;
    let accuracyPercentage = 0;
    let evidenceNote = '';

    if (diagResult) {
      sampleSize = diagResult.answeredQuestions || diagResult.totalQuestions || 0;
      correctCount = diagResult.correctAnswers || 0;
      accuracyPercentage = diagResult.accuracyPercentage ?? (sampleSize > 0 ? Math.round((correctCount / sampleSize) * 100) : 0);

      if (sampleSize < 2) {
        // Conservative threshold: not enough sample to declare mastery or failure
        state = TOPIC_STATE.NOT_ENOUGH_EVIDENCE;
        evidenceNote = `Evaluated on only ${sampleSize} question(s) in diagnostic. Sample size too small for confident classification.`;
      } else if (accuracyPercentage < 70) {
        // Sufficient evidence of foundational gap
        state = TOPIC_STATE.NEEDS_REVISION;
        evidenceNote = `Scored ${accuracyPercentage}% (${correctCount}/${sampleSize}) in diagnostic assessment. Core concepts require revision.`;
      } else {
        // Reasonable grasp demonstrated
        state = TOPIC_STATE.PROMISING;
        evidenceNote = `Demonstrated solid grasp with ${accuracyPercentage}% (${correctCount}/${sampleSize}) in diagnostic assessment.`;
      }
    } else if (isExplicitlyUnassessed) {
      state = TOPIC_STATE.UNASSESSED;
      evidenceNote = `No diagnostic assessment items were available for ${topic}. Ready for hands-on practice.`;
    } else if (latestDiagnostic && latestDiagnostic.status === 'submitted') {
      // Diagnostic was completed, but this topic was not in the assessment
      state = TOPIC_STATE.UNASSESSED;
      evidenceNote = `Not included in your last diagnostic assessment session.`;
    } else {
      // No diagnostic session submitted yet
      state = TOPIC_STATE.NOT_STARTED;
      evidenceNote = `No diagnostic evidence recorded yet. Recommended based on your onboarding preferences.`;
    }

    // 3. Generate actionable recommendation details grounded in real catalogue
    const stableId = `rec-${slugify(topic)}`;
    let actionType = ACTION_TYPE.PRACTICE;
    let title = '';
    let reason = '';
    let difficulty = 'Medium';
    let destinationUrl = '/practice';
    let resourceTitle = 'Practice Problems';
    let resourceType = 'problem';

    const quizInfo = QUIZ_CATALOG_MAP[topic];
    const problemCandidate = pickProblemForTopic(topic, completedProblems, state === TOPIC_STATE.PROMISING ? 'Medium' : 'Easy');

    switch (state) {
      case TOPIC_STATE.NEEDS_REVISION:
        // Evidenced gap: prioritize foundational revision and easy problem practice
        actionType = ACTION_TYPE.REVIEW;
        difficulty = 'Easy';
        if (quizInfo) {
          title = `Revise ${topic} Foundations`;
          reason = `Diagnostic results indicated foundational gaps (${accuracyPercentage}% accuracy). Take the focused ${quizInfo.title} quiz to review key syntax and principles.`;
          destinationUrl = quizInfo.url;
          resourceTitle = quizInfo.title;
          resourceType = 'quiz';
        } else if (problemCandidate) {
          title = `Revisit ${topic} Fundamentals: ${problemCandidate.title}`;
          reason = `Diagnostic results indicated a gap (${accuracyPercentage}% accuracy). Work through ${problemCandidate.title} (${problemCandidate.difficulty}) to rebuild foundational understanding.`;
          destinationUrl = `/practice/${problemCandidate.slug}`;
          resourceTitle = problemCandidate.title;
          resourceType = 'problem';
        } else {
          title = `Review ${topic} Concepts`;
          reason = `Diagnostic accuracy was ${accuracyPercentage}%. Brush up on core concepts before advancing.`;
          destinationUrl = `/practice?topic=${encodeURIComponent(topic)}`;
          resourceTitle = `${topic} Practice`;
          resourceType = 'problem';
        }
        break;

      case TOPIC_STATE.NOT_ENOUGH_EVIDENCE:
        // Insufficient sample: offer targeted quiz or diagnostic to build evidence
        actionType = quizInfo ? ACTION_TYPE.QUIZ : ACTION_TYPE.DIAGNOSE;
        difficulty = quizInfo?.difficulty || 'Medium';
        if (quizInfo) {
          title = `Assess ${topic} Knowledge: ${quizInfo.title}`;
          reason = `Only ${sampleSize} question was assessed during your diagnostic. Complete the dedicated quiz to establish a reliable baseline.`;
          destinationUrl = quizInfo.url;
          resourceTitle = quizInfo.title;
          resourceType = 'quiz';
        } else {
          title = `Complete ${topic} Assessment`;
          reason = `Insufficient evidence exists to determine your strength in ${topic}. Complete additional assessment questions.`;
          destinationUrl = `/diagnostic`;
          resourceTitle = 'Diagnostic Assessment';
          resourceType = 'diagnostic';
        }
        break;

      case TOPIC_STATE.UNASSESSED:
        // Honest disclosure of unassessed status with genuine fallback practice
        actionType = ACTION_TYPE.PRACTICE;
        difficulty = 'Easy';
        if (problemCandidate) {
          title = `Explore ${topic}: ${problemCandidate.title}`;
          reason = `This topic was not assessed in your diagnostic. Begin with ${problemCandidate.title} (${problemCandidate.difficulty}) to establish initial practice evidence.`;
          destinationUrl = `/practice/${problemCandidate.slug}`;
          resourceTitle = problemCandidate.title;
          resourceType = 'problem';
        } else if (quizInfo) {
          title = `Benchmark ${topic}: ${quizInfo.title}`;
          reason = `This topic has not been assessed yet. Take the ${quizInfo.title} quiz to baseline your knowledge.`;
          destinationUrl = quizInfo.url;
          resourceTitle = quizInfo.title;
          resourceType = 'quiz';
          actionType = ACTION_TYPE.QUIZ;
        } else {
          title = `Practice ${topic} Problems`;
          reason = `No diagnostic data is available for ${topic}. Solve problems in this focus area to build your skill record.`;
          destinationUrl = `/practice?topic=${encodeURIComponent(topic)}`;
          resourceTitle = `${topic} Catalog`;
          resourceType = 'problem';
        }
        break;

      case TOPIC_STATE.PROMISING:
        // Strong grasp: recommend progression, harder challenges, or interview prep
        actionType = ACTION_TYPE.ADVANCE;
        difficulty = 'Medium';
        if (problemCandidate && problemCandidate.difficulty !== 'Easy') {
          title = `Challenge Yourself in ${topic}: ${problemCandidate.title}`;
          reason = `Strong performance in your diagnostic (${accuracyPercentage}% accuracy). Push your problem-solving with ${problemCandidate.title} (${problemCandidate.difficulty}).`;
          destinationUrl = `/practice/${problemCandidate.slug}`;
          resourceTitle = problemCandidate.title;
          resourceType = 'problem';
        } else if (problemCandidate) {
          title = `Reinforce ${topic}: ${problemCandidate.title}`;
          reason = `Solid diagnostic score (${accuracyPercentage}% accuracy). Apply your understanding to ${problemCandidate.title}.`;
          destinationUrl = `/practice/${problemCandidate.slug}`;
          resourceTitle = problemCandidate.title;
          resourceType = 'problem';
        } else {
          title = `Advance in ${topic}`;
          reason = `Solid grasp demonstrated in diagnostic (${accuracyPercentage}% accuracy). Explore medium-to-hard algorithmic challenges.`;
          destinationUrl = `/practice?topic=${encodeURIComponent(topic)}`;
          resourceTitle = `${topic} Advanced Practice`;
          resourceType = 'problem';
        }
        break;

      case TOPIC_STATE.NOT_STARTED:
      default:
        // No diagnostic taken yet: guide toward baseline assessment or easy problem
        actionType = ACTION_TYPE.DIAGNOSE;
        difficulty = 'Easy';
        if (quizInfo) {
          title = `Start with ${topic} Diagnostic Quiz`;
          reason = `No learning activity recorded yet for ${topic}. Take the diagnostic quiz to pinpoint strengths and syntax gaps.`;
          destinationUrl = quizInfo.url;
          resourceTitle = quizInfo.title;
          resourceType = 'quiz';
        } else if (problemCandidate) {
          title = `Begin ${topic} Practice: ${problemCandidate.title}`;
          reason = `No prior activity recorded for ${topic}. Start with ${problemCandidate.title} (${problemCandidate.difficulty}) to establish your baseline.`;
          destinationUrl = `/practice/${problemCandidate.slug}`;
          resourceTitle = problemCandidate.title;
          resourceType = 'problem';
          actionType = ACTION_TYPE.PRACTICE;
        } else {
          title = `Explore ${topic} Practice`;
          reason = `Select practice problems to start building evidence in ${topic}.`;
          destinationUrl = `/practice?topic=${encodeURIComponent(topic)}`;
          resourceTitle = `${topic} Catalog`;
          resourceType = 'problem';
          actionType = ACTION_TYPE.PRACTICE;
        }
        break;
    }

    // 4. Check if this recommendation was already completed
    // Either by user solving all problems in topic, passing quiz, or manual completion in prior state
    const prevSaved = prevCompletionMap.get(stableId);
    let isCompleted = prevSaved ? prevSaved.isCompleted : false;
    let completedAt = prevSaved ? prevSaved.completedAt : null;

    // Auto-detect completion from genuine platform records
    if (!isCompleted) {
      if (resourceType === 'problem' && problemCandidate && completedProblems.has(problemCandidate.slug)) {
        if (areAllProblemsCompleted(topic, completedProblems)) {
          isCompleted = true;
          completedAt = completedAt || new Date();
        }
      } else if (resourceType === 'quiz' && quizInfo && passedQuizzes.has(quizInfo.quizId)) {
        isCompleted = true;
        completedAt = completedAt || new Date();
      }
    }

    // Check if there is reassessment evidence for this topic
    let reassessmentSummary = null;
    if (reassessmentComparison && Array.isArray(reassessmentComparison.topicComparisons)) {
      const matchedComp = reassessmentComparison.topicComparisons.find(
        (tc) => normalizeTopicName(tc.topic) === topic || tc.topic === topic
      );
      if (matchedComp) {
        reassessmentSummary = {
          status: matchedComp.status,
          label: matchedComp.label,
          deltaPercentage: matchedComp.deltaPercentage,
          interpretation: matchedComp.interpretation,
          sharedQuestionsCount: matchedComp.sharedQuestionsCount ?? 0,
          newQuestionsCount: matchedComp.newQuestionsCount ?? 0
        };

        // Update reasoning when reassessment evidence exists
        if (matchedComp.status === 'encouraging_progress') {
          reason = `Reassessment showed encouraging progress (+${matchedComp.deltaPercentage}%). ${reason}`;
        } else if (matchedComp.status === 'further_revision_recommended') {
          const deltaStr = matchedComp.deltaPercentage !== null
            ? ` (${matchedComp.deltaPercentage > 0 ? '+' : ''}${matchedComp.deltaPercentage}% change)`
            : '';
          reason = `Reassessment indicates persistent concept gaps${deltaStr}. Prioritize reinforcement in core patterns before advancing.`;
        }
      }
    }

    // 5. Deterministic tie-breaking calculation:
    // Base weight from state (needs_revision=100, not_enough_evidence=200, unassessed=300, promising=400, not_started=500)
    // Preference offset: -10 if topic was chosen by user in onboarding
    // Secondary tie-breaker: order in user's selectedTopics list
    const stateBase = STATE_PRIORITY_BASE[state] || 500;
    const prefIndex = selectedTopics.indexOf(topic);
    const prefOffset = prefIndex !== -1 ? prefIndex * 2 : 50;

    recommendations.push({
      id: stableId,
      topic,
      subtopic: '',
      state,
      actionType,
      priorityRaw: stateBase + prefOffset,
      title,
      reason,
      sampleSize,
      difficulty,
      destinationUrl,
      resourceTitle,
      resourceType,
      isCompleted,
      completedAt,
      evidenceSummary: {
        status: state,
        sampleSize,
        correct: correctCount,
        accuracy: accuracyPercentage,
        note: evidenceNote
      },
      reassessmentSummary
    });
  }

  // 6. Sort recommendations deterministically:
  // Primary: priorityRaw ascending (needs_revision first, then not_enough_evidence, etc.)
  // Secondary: topic name alphabetical
  recommendations.sort((a, b) => {
    if (a.priorityRaw !== b.priorityRaw) {
      return a.priorityRaw - b.priorityRaw;
    }
    return a.topic.localeCompare(b.topic);
  });

  // Assign clean sequential 1-based priority numbers
  recommendations.forEach((item, idx) => {
    item.priority = idx + 1;
    delete item.priorityRaw; // internal calculation detail
  });

  // 7. Aggregate roadmap summary and stats
  const totalItems = recommendations.length;
  const completedItems = recommendations.filter((r) => r.isCompleted).length;
  const needsRevisionCount = recommendations.filter((r) => r.state === TOPIC_STATE.NEEDS_REVISION).length;
  const promisingCount = recommendations.filter((r) => r.state === TOPIC_STATE.PROMISING).length;
  const pendingCount = totalItems - completedItems;

  let summary = '';
  if (totalItems === 0) {
    summary = 'No roadmap items active. Configure your learning preferences to generate a personalized roadmap.';
  } else if (needsRevisionCount > 0) {
    summary = `${needsRevisionCount} topic${needsRevisionCount === 1 ? '' : 's'} identified for revision. Focus on foundational gaps before advancing.`;
  } else if (promisingCount > 0) {
    summary = `Great progress! ${promisingCount} topic${promisingCount === 1 ? '' : 's'} showed promising understanding. Ready for advanced practice.`;
  } else {
    summary = `Your revision roadmap has ${totalItems} targeted learning action${totalItems === 1 ? '' : 's'} ready.`;
  }

  return {
    summary,
    activeGoals: user.learningGoals || [],
    activeLanguages: user.languages || [],
    diagnosticSession: latestDiagnostic?._id || null,
    reassessmentComparison: reassessmentComparison ? {
      hasComparison: Boolean(reassessmentComparison.hasComparison),
      comparisonStatus: reassessmentComparison.comparisonStatus || 'not_available',
      previousSessionId: reassessmentComparison.previousSessionId || null,
      currentSessionId: reassessmentComparison.currentSessionId || null,
      overallDeltaPercentage: reassessmentComparison.overallDeltaPercentage ?? null,
      summary: reassessmentComparison.summary || '',
      limitations: Array.isArray(reassessmentComparison.limitations) ? reassessmentComparison.limitations : [],
      topicComparisons: Array.isArray(reassessmentComparison.topicComparisons) ? reassessmentComparison.topicComparisons : []
    } : null,
    lastCalculatedAt: new Date(),
    stats: {
      totalItems,
      completedItems,
      needsRevisionCount,
      promisingCount,
      pendingCount
    },
    recommendations
  };
}

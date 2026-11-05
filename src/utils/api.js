import { getToken, clearAuth } from './auth.js';

/**
 * Resolves and validates an API endpoint against configured or ambient base URL.
 * Safely handles missing/malformed configuration, strips trailing slashes,
 * and prevents protocol-relative URL hijacking.
 *
 * @param {string} endpoint - API path (e.g. '/api/auth/me')
 * @param {object} [envConfig] - Optional environment configuration
 * @returns {string} Fully qualified or normalized relative API URL
 */
export function resolveApiUrl(endpoint, envConfig) {
  if (!endpoint || typeof endpoint !== 'string') {
    endpoint = '/';
  }

  let cleanEndpoint = endpoint.trim();
  // Strip leading double slashes to prevent protocol-relative URL hijacking (e.g. //attacker.com)
  if (cleanEndpoint.startsWith('//')) {
    cleanEndpoint = '/' + cleanEndpoint.replace(/^\/+/, '');
  } else if (!cleanEndpoint.startsWith('/') && !cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
    cleanEndpoint = '/' + cleanEndpoint;
  }

  // If already an absolute http/https URL, return directly
  if (cleanEndpoint.startsWith('http://') || cleanEndpoint.startsWith('https://')) {
    return cleanEndpoint;
  }

  // Resolve environment configuration safely
  const env = envConfig !== undefined
    ? envConfig
    : (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {});

  let baseUrl = env?.VITE_API_BASE_URL;

  if (baseUrl !== undefined && baseUrl !== null) {
    baseUrl = String(baseUrl).trim();
    // Validate protocol: allow http, https, or empty string (relative)
    if (baseUrl.length > 0 && !baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      // Disallowed scheme or malformed protocol (e.g. javascript:), fall back safely
      const isProd = Boolean(env?.PROD || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'));
      baseUrl = isProd ? '' : 'http://localhost:5000';
    }
  } else {
    // Missing configuration:
    // In production build, default to "" (relative to current origin / Nginx reverse proxy)
    // In development, default to http://localhost:5000
    const isProd = Boolean(env?.PROD || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'));
    baseUrl = isProd ? '' : 'http://localhost:5000';
  }

  const cleanBase = baseUrl.replace(/\/+$/, '');
  return cleanBase ? `${cleanBase}${cleanEndpoint}` : cleanEndpoint;
}

// In-memory client rate-limit backpressure cooldown tracking
let clientRateLimitCooldownUntil = 0;

/**
 * Returns current client rate-limit cooldown status.
 * @returns {{ active: boolean, remainingSeconds: number }}
 */
export function getRateLimitCooldown() {
  const remainingMs = clientRateLimitCooldownUntil - Date.now();
  if (remainingMs > 0) {
    return {
      active: true,
      remainingSeconds: Math.max(1, Math.ceil(remainingMs / 1000))
    };
  }
  return { active: false, remainingSeconds: 0 };
}

/**
 * Resets client rate-limit cooldown (used for testing or after explicit clearance).
 */
export function clearRateLimitCooldown() {
  clientRateLimitCooldownUntil = 0;
}

/**
 * Centralized API fetch wrapper for CodeForge.
 * Automatically attaches the JWT Bearer token if present.
 * Standardizes JSON parsing and error handling.
 * On 401 Unauthorized, automatically purges cached auth state.
 * On 429 Too Many Requests, extracts Retry-After and enforces client backpressure.
 *
 * @param {string} endpoint - API path (e.g. '/api/users/profile')
 * @param {RequestInit} [options={}] - Standard fetch options
 * @returns {Promise<{ ok: boolean, status: number, data: any, retryAfter?: number }>}
 */
export async function apiFetch(endpoint, options = {}) {
  // Prevent automatic retry loops while rate-limited: respect Retry-After
  const cooldown = getRateLimitCooldown();
  if (cooldown.active) {
    return {
      ok: false,
      status: 429,
      retryAfter: cooldown.remainingSeconds,
      data: {
        success: false,
        message: `Too many requests. Client rate-limit backpressure active; retry after ${cooldown.remainingSeconds} seconds.`,
        retryAfter: cooldown.remainingSeconds
      }
    };
  }

  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = resolveApiUrl(endpoint);

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    let data;
    try {
      data = await response.json();
    } catch {
      data = {
        success: false,
        message: 'Non-JSON response received from server.'
      };
    }

    if (response.status === 401) {
      clearAuth();
      // Dispatch custom event so React AuthContext or components can react if desired
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('codeforge:unauthorized'));
      }
    }

    // Handle 429 Rate Limiting with Retry-After backpressure enforcement
    if (response.status === 429) {
      let retryAfterSeconds = 60; // Fallback window (seconds)
      const retryHeader = response.headers.get('Retry-After') || response.headers.get('retry-after');
      if (retryHeader) {
        const parsed = parseInt(retryHeader, 10);
        if (!isNaN(parsed) && parsed > 0) {
          retryAfterSeconds = parsed;
        }
      } else if (data?.retryAfter && typeof data.retryAfter === 'number' && data.retryAfter > 0) {
        retryAfterSeconds = data.retryAfter;
      }

      clientRateLimitCooldownUntil = Date.now() + (retryAfterSeconds * 1000);
      data.retryAfter = retryAfterSeconds;

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('codeforge:rate-limited', {
          detail: { retryAfter: retryAfterSeconds, message: data.message }
        }));
      }

      return {
        ok: false,
        status: 429,
        retryAfter: retryAfterSeconds,
        data
      };
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        message: error.message || 'Network error occurred. Unable to connect to server.'
      }
    };
  }
}

/**
 * Fetch authenticated user profile.
 */
export async function getUserProfile() {
  return apiFetch('/api/users/me');
}

/**
 * Update authenticated user profile.
 * @param {{ fullName: string, gender: string, experience: string, interests: string[] }} profileData
 */
export async function updateUserProfile(profileData) {
  return apiFetch('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(profileData)
  });
}

/**
 * Permanently delete authenticated user's account and all associated learning records.
 * @param {{ password: string, confirmation: string }} payload
 */
export async function deleteUserAccount(payload) {
  return apiFetch('/api/users/me', {
    method: 'DELETE',
    body: JSON.stringify(payload)
  });
}

/**
 * Fetch authenticated user's adaptive onboarding state and preferences.
 */
export async function getOnboarding() {
  return apiFetch('/api/users/onboarding');
}

/**
 * Persist authenticated user's adaptive onboarding preferences.
 * @param {{ learningGoals: string[], languages: Array<{ language: string, status: string }>, preferredStartingMode?: string, selectedTopics?: string[] }} onboardingData
 */
export async function saveOnboarding(onboardingData) {
  return apiFetch('/api/users/onboarding', {
    method: 'PUT',
    body: JSON.stringify(onboardingData)
  });
}

/**
 * Skip adaptive onboarding and mark completed with defaults.
 */
export async function skipOnboarding() {
  return apiFetch('/api/users/onboarding/skip', {
    method: 'POST'
  });
}

/**
 * Fetch authenticated user's practice progress and quiz attempts.
 */
export async function getProgress() {
  return apiFetch('/api/progress');
}

/**
 * Fetch authenticated user's practice problem progress list from MongoDB.
 */
export async function getMyProgress() {
  return apiFetch('/api/progress');
}

/**
 * Fetch progress for a single problem by its ObjectId.
 * @param {string} problemId
 */
export async function getProblemProgress(problemId) {
  return apiFetch(`/api/progress/${encodeURIComponent(problemId)}`);
}

/**
 * Mark a problem as completed for the authenticated user.
 * @param {string} problemId
 */
export async function markProblemCompleted(problemId) {
  return apiFetch(`/api/progress/${encodeURIComponent(problemId)}`, {
    method: 'PUT'
  });
}

/**
 * Mark a problem as incomplete for the authenticated user.
 * @param {string} problemId
 */
export async function unmarkProblemCompleted(problemId) {
  return apiFetch(`/api/progress/${encodeURIComponent(problemId)}`, {
    method: 'DELETE'
  });
}

/**
 * Record a problem as completed for the authenticated user (legacy helper).
 * @param {string} problemId
 */
export async function completeProblem(problemId) {
  return apiFetch(`/api/progress/problems/${encodeURIComponent(problemId)}/complete`, {
    method: 'POST'
  });
}

/**
 * Record a quiz attempt for the authenticated user.
 * @param {{ quizId: string, score: number, totalQuestions: number, percentage: number }} attemptData
 */
export async function recordQuizAttempt(attemptData) {
  return apiFetch('/api/progress/quiz', {
    method: 'POST',
    body: JSON.stringify(attemptData)
  });
}

/**
 * Fetch paginated problems list with optional search and filters.
 * @param {Object} [params={}]
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @param {string} [params.search]
 * @param {string} [params.language]
 * @param {string} [params.difficulty]
 * @param {string} [params.topic]
 */
export async function getProblems(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  if (params.language && params.language !== 'All') query.set('language', params.language);
  if (params.difficulty && params.difficulty !== 'All') query.set('difficulty', params.difficulty);
  if (params.topic && params.topic !== 'All') query.set('topic', params.topic);

  const queryString = query.toString();
  return apiFetch(`/api/problems${queryString ? `?${queryString}` : ''}`);
}

/**
 * Fetch a single practice problem by its slug ID.
 * @param {string} id
 */
export async function getProblem(id) {
  return apiFetch(`/api/problems/${encodeURIComponent(id)}`);
}

/**
 * Submit an answer or code attempt for a practice problem.
 * Requires authentication.
 * @param {string} id - Problem ID or slug
 * @param {string} answer - Code or answer string
 */
export async function submitProblem(id, answer) {
  return apiFetch(`/api/problems/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answer })
  });
}

/**
 * Fetch authenticated user's practice problem progress and attempts.
 * Requires authentication.
 */
export async function getMyProblemProgress() {
  return apiFetch('/api/problems/progress/me');
}

/**
 * Fetch assessment questions without answers or explanations.
 * @param {string} [topic]
 */
export async function getQuestions(topic) {
  const query = topic && topic !== 'All' ? `?topic=${encodeURIComponent(topic)}` : '';
  return apiFetch(`/api/questions${query}`);
}

/**
 * Submit quiz answers to the backend for authoritative score evaluation and review.
 * Requires authentication.
 * @param {Array<{ questionId: number, answer: string }> | Object} answers
 */
export async function submitQuiz(answers) {
  return apiFetch('/api/questions/submit', {
    method: 'POST',
    body: JSON.stringify({ answers })
  });
}

/**
 * Fetch sandbox availability status and setup guide.
 */
export async function getSandboxStatus() {
  return apiFetch('/api/code/status');
}

/**
 * Run source code against optional test inputs.
 * @param {{ language: string, sourceCode: string, problemId?: string, customInput?: string }} payload
 */
export async function runCode(payload) {
  return apiFetch('/api/code/run', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Submit code solution for authoritative test-case evaluation and progress recording.
 * Requires authentication.
 * @param {{ problemId: string, language: string, sourceCode: string }} payload
 */
export async function submitCode(payload) {
  return apiFetch('/api/code/submit', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Fetch authenticated user's code submission history.
 * Requires authentication.
 * @param {{ problemId?: string, page?: number, limit?: number }} [params={}]
 */
export async function getSubmissions(params = {}) {
  const query = new URLSearchParams();
  if (params.problemId) query.set('problemId', params.problemId);
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  const qStr = query.toString();
  return apiFetch(`/api/code/submissions${qStr ? `?${qStr}` : ''}`);
}

/**
 * Fetch available quizzes catalog with optional filtering and pagination.
 * @param {Object} [params={}]
 */
export async function getQuizzes(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.topic && params.topic !== 'All') query.set('topic', params.topic);
  if (params.difficulty && params.difficulty !== 'All') query.set('difficulty', params.difficulty);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  const qStr = query.toString();
  return apiFetch(`/api/quizzes${qStr ? `?${qStr}` : ''}`);
}

/**
 * Fetch a quiz by ID or slug with its questions (answers excluded).
 * @param {string} id
 */
export async function getQuiz(id) {
  return apiFetch(`/api/quizzes/${encodeURIComponent(id)}`);
}

/**
 * Start or resume an authenticated quiz attempt.
 * Requires authentication.
 * @param {string} id - Quiz slug or ID
 */
export async function startQuizAttempt(id) {
  return apiFetch(`/api/quizzes/${encodeURIComponent(id)}/attempts`, {
    method: 'POST'
  });
}

/**
 * Fetch authenticated user's attempt history.
 * Requires authentication.
 * @param {Object} [params={}]
 */
export async function getQuizAttempts(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.status && params.status !== 'All') query.set('status', params.status);
  if (params.topic && params.topic !== 'All') query.set('topic', params.topic);
  if (params.quizId && params.quizId !== 'All') query.set('quizId', params.quizId);
  const qStr = query.toString();
  return apiFetch(`/api/quizzes/attempts${qStr ? `?${qStr}` : ''}`);
}

/**
 * Fetch details of a specific quiz attempt.
 * Requires authentication.
 * @param {string} attemptId
 */
export async function getQuizAttempt(attemptId) {
  return apiFetch(`/api/quizzes/attempts/${encodeURIComponent(attemptId)}`);
}

/**
 * Submit answers for an authenticated attempt for authoritative scoring.
 * Requires authentication.
 * @param {string} attemptId
 * @param {Array<{ questionId: number, selectedOption: string }> | Object} answers
 */
export async function submitQuizAttempt(attemptId, answers) {
  return apiFetch(`/api/quizzes/attempts/${encodeURIComponent(attemptId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers })
  });
}

/**
 * Fetch authenticated user's performance overview analytics.
 * Requires authentication.
 */
export async function getAnalyticsOverview() {
  return apiFetch('/api/analytics/overview');
}

/**
 * Fetch authenticated user's topic-wise performance analytics.
 * Requires authentication.
 */
export async function getAnalyticsTopics() {
  return apiFetch('/api/analytics/topics');
}

/**
 * Fetch authenticated user's chronological score trends for charts.
 * Requires authentication.
 */
export async function getAnalyticsTrends() {
  return apiFetch('/api/analytics/trends');
}

/**
 * Fetch Admin Dashboard Overview metrics.
 * Requires admin role.
 */
export async function getAdminOverview() {
  return apiFetch('/api/admin/overview');
}

/**
 * Fetch paginated Admin Audit Logs.
 * Requires admin role.
 * @param {Object} [params={}]
 */
export async function getAdminAuditLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.action && params.action !== 'All') query.set('action', params.action);
  if (params.entity && params.entity !== 'All') query.set('entity', params.entity);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  const qStr = query.toString();
  return apiFetch(`/api/admin/audit-logs${qStr ? `?${qStr}` : ''}`);
}

/**
 * Fetch paginated questions from Question Bank with filters.
 * Requires admin role.
 * @param {Object} [params={}]
 */
export async function getAdminQuestions(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.topic && params.topic !== 'All') query.set('topic', params.topic);
  if (params.difficulty && params.difficulty !== 'All') query.set('difficulty', params.difficulty);
  if (params.status && params.status !== 'All') query.set('status', params.status);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  const qStr = query.toString();
  return apiFetch(`/api/admin/questions${qStr ? `?${qStr}` : ''}`);
}

/**
 * Fetch single question by ID for editing or previewing.
 * Requires admin role.
 * @param {string|number} id
 */
export async function getAdminQuestion(id) {
  return apiFetch(`/api/admin/questions/${encodeURIComponent(id)}`);
}

/**
 * Create a new question in the Question Bank.
 * Requires admin role.
 * @param {Object} payload
 */
export async function createAdminQuestion(payload) {
  return apiFetch('/api/admin/questions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Update an existing question.
 * Requires admin role.
 * @param {string|number} id
 * @param {Object} payload
 */
export async function updateAdminQuestion(id, payload) {
  return apiFetch(`/api/admin/questions/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

/**
 * Archive a question.
 * Requires admin role.
 * @param {string|number} id
 */
export async function archiveAdminQuestion(id) {
  return apiFetch(`/api/admin/questions/${encodeURIComponent(id)}/archive`, {
    method: 'PATCH'
  });
}

/**
 * Restore an archived question.
 * Requires admin role.
 * @param {string|number} id
 */
export async function restoreAdminQuestion(id) {
  return apiFetch(`/api/admin/questions/${encodeURIComponent(id)}/restore`, {
    method: 'PATCH'
  });
}

/**
 * Fetch all quizzes for admin management.
 * Requires admin role.
 * @param {Object} [params={}]
 */
export async function getAdminQuizzes(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.limit) query.set('limit', params.limit);
  if (params.topic && params.topic !== 'All') query.set('topic', params.topic);
  if (params.status && params.status !== 'All') query.set('status', params.status);
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  const qStr = query.toString();
  return apiFetch(`/api/admin/quizzes${qStr ? `?${qStr}` : ''}`);
}

/**
 * Fetch a single quiz by ID for admin quiz builder.
 * Requires admin role.
 * @param {string} id
 */
export async function getAdminQuiz(id) {
  return apiFetch(`/api/admin/quizzes/${encodeURIComponent(id)}`);
}

/**
 * Create a new quiz draft.
 * Requires admin role.
 * @param {Object} payload
 */
export async function createAdminQuiz(payload) {
  return apiFetch('/api/admin/quizzes', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Update an existing quiz.
 * Requires admin role.
 * @param {string} id
 * @param {Object} payload
 */
export async function updateAdminQuiz(id, payload) {
  return apiFetch(`/api/admin/quizzes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

/**
 * Publish a quiz after backend integrity validation.
 * Requires admin role.
 * @param {string} id
 */
export async function publishAdminQuiz(id) {
  return apiFetch(`/api/admin/quizzes/${encodeURIComponent(id)}/publish`, {
    method: 'POST'
  });
}

/**
 * Unpublish a quiz (reverts to draft).
 * Requires admin role.
 * @param {string} id
 */
export async function unpublishAdminQuiz(id) {
  return apiFetch(`/api/admin/quizzes/${encodeURIComponent(id)}/unpublish`, {
    method: 'POST'
  });
}

/**
 * Archive a quiz.
 * Requires admin role.
 * @param {string} id
 */
export async function archiveAdminQuiz(id) {
  return apiFetch(`/api/admin/quizzes/${encodeURIComponent(id)}/archive`, {
    method: 'PATCH'
  });
}

/**
 * Start or resume a diagnostic assessment session.
 * @param {Object} [payload={}] - Optional custom focus topics or learning goals override
 */
export async function startDiagnosticSession(payload = {}) {
  return apiFetch('/api/diagnostics/sessions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Fetch a specific diagnostic assessment session by ID.
 * @param {string} id
 */
export async function getDiagnosticSession(id) {
  return apiFetch(`/api/diagnostics/sessions/${encodeURIComponent(id)}`);
}

/**
 * Submit answers for an in-progress diagnostic assessment.
 * @param {string} id
 * @param {Array<{ questionId: string, selectedOptionIndex: number }>} answers
 */
export async function submitDiagnosticSession(id, answers) {
  return apiFetch(`/api/diagnostics/sessions/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers })
  });
}

/**
 * Abandon an in-progress diagnostic session.
 * @param {string} id
 */
export async function abandonDiagnosticSession(id) {
  return apiFetch(`/api/diagnostics/sessions/${encodeURIComponent(id)}/abandon`, {
    method: 'POST'
  });
}

/**
 * Fetch the learner's most recent diagnostic assessment report.
 */
export async function getLatestDiagnosticReport() {
  return apiFetch('/api/diagnostics/sessions/latest');
}

/**
 * Fetch the learner's full diagnostic assessment history.
 */
export async function getDiagnosticHistory() {
  return apiFetch('/api/diagnostics/history');
}

/**
 * Fetch the learner's persistent, adaptive revision roadmap.
 * Requires authentication.
 */
export async function getRoadmap() {
  return apiFetch('/api/roadmap');
}

/**
 * Force recalculate the revision roadmap based on latest diagnostic and problem progress.
 * Requires authentication.
 */
export async function recalculateRoadmap() {
  return apiFetch('/api/roadmap/recalculate', {
    method: 'POST'
  });
}

/**
 * Update the completion state of a specific roadmap recommendation item.
 * Requires authentication.
 * @param {string} id - Stable recommendation identifier (e.g. 'rec-javascript')
 * @param {boolean} [isCompleted=true]
 */
export async function completeRoadmapRecommendation(id, isCompleted = true) {
  return apiFetch(`/api/roadmap/recommendations/${encodeURIComponent(id)}/complete`, {
    method: 'PATCH',
    body: JSON.stringify({ isCompleted })
  });
}

/**
 * Fetch latest diagnostic reassessment comparison for the authenticated learner.
 */
export async function getLatestComparison() {
  return apiFetch('/api/reinforcement/comparison');
}

/**
 * Fetch comparison for a specific diagnostic session against its predecessor.
 * @param {string} sessionId
 */
export async function getSessionComparison(sessionId) {
  return apiFetch(`/api/reinforcement/comparison/${encodeURIComponent(sessionId)}`);
}

/**
 * Fetch authoritative, paginated activity history with optional filters.
 * @param {Object} [params={}]
 * @param {string} [params.type]
 * @param {boolean} [params.verifiedOnly]
 * @param {string} [params.topic]
 * @param {number} [params.page]
 * @param {number} [params.limit]
 */
export async function getActivityHistory(params = {}) {
  const query = new URLSearchParams();
  if (params.type && params.type !== 'all') query.set('type', params.type);
  if (params.verifiedOnly) query.set('verifiedOnly', 'true');
  if (params.topic && params.topic !== 'all') query.set('topic', params.topic);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return apiFetch(`/api/reinforcement/history${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch high-level activity and reinforcement summary metrics.
 */
export async function getActivitySummary() {
  return apiFetch('/api/reinforcement/summary');
}

/**
 * Fetch the learner's synthesized learning intelligence state model.
 * Requires authentication.
 */
export async function getLearningState() {
  return apiFetch('/api/intelligence/state');
}

/**
 * Fetch prioritized next learning actions grounded in CodeForge catalog.
 * Requires authentication.
 * @param {Object} [params={}]
 * @param {number} [params.limit=10]
 */
export async function getLearningRecommendations(params = {}) {
  const query = new URLSearchParams();
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch(`/api/intelligence/recommendations${qs ? `?${qs}` : ''}`);
}

/**
 * Fetch granular intelligence breakdown for a specific topic.
 * Requires authentication.
 * @param {string} topicName
 */
export async function getTopicIntelligence(topicName) {
  return apiFetch(`/api/intelligence/topic/${encodeURIComponent(topicName)}`);
}

/**
 * Fetch the validated prerequisite knowledge DAG, topological order, and readiness evaluations.
 * Requires authentication.
 */
export async function getPrerequisitePathway() {
  return apiFetch('/api/intelligence/pathways/prerequisites');
}

/**
 * Fetch the active targeted practice bundle with live completion status.
 * Requires authentication.
 * @param {string} [topic]
 */
export async function getActivePracticeBundle(topic) {
  const query = topic ? `?topic=${encodeURIComponent(topic)}` : '';
  return apiFetch(`/api/intelligence/pathways/practice-bundle${query}`);
}

/**
 * Assemble a fresh targeted practice bundle for a target topic or top gap.
 * Requires authentication.
 * @param {string} [topic]
 */
export async function createPracticeBundle(topic) {
  return apiFetch('/api/intelligence/pathways/practice-bundle', {
    method: 'POST',
    body: JSON.stringify({ topic })
  });
}

/**
 * Fetch longitudinal competency comparisons across 30, 60, or 90 days.
 * Requires authentication.
 * @param {number} [windowDays=30]
 */
export async function getCompetencyTrends(windowDays = 30) {
  return apiFetch(`/api/intelligence/pathways/competency-trends?windowDays=${windowDays}`);
}

/**
 * Authoritatively record an immutable dated competency snapshot.
 * Requires authentication.
 * @param {boolean} [force=false]
 */
export async function recordCompetencySnapshot(force = false) {
  return apiFetch('/api/intelligence/pathways/competency-snapshot', {
    method: 'POST',
    body: JSON.stringify({ force })
  });
}

/**
 * ==============================================================================
 * Retention & Durable Learning API Client (Milestone 16C)
 * ==============================================================================
 */

/**
 * Fetch topics eligible for retention review based on evidence freshness.
 * Requires authentication.
 */
export async function getEligibleRetentionTopics() {
  return apiFetch('/api/intelligence/retention/eligible');
}

/**
 * Start or resume a retention assessment session for a topic.
 * Requires authentication.
 * @param {string} topic
 * @param {boolean} [forceNew=false]
 */
export async function startRetentionSession(topic, forceNew = false) {
  return apiFetch('/api/intelligence/retention/session', {
    method: 'POST',
    body: JSON.stringify({ topic, forceNew })
  });
}

/**
 * Fetch an existing retention session by ID.
 * Requires authentication.
 * @param {string} sessionId
 */
export async function getRetentionSession(sessionId) {
  return apiFetch(`/api/intelligence/retention/session/${encodeURIComponent(sessionId)}`);
}

/**
 * Authoritatively submit and score a retention assessment session.
 * Requires authentication.
 * @param {string} sessionId
 * @param {Array<{ questionId: string, selectedOption: number }>} answers
 */
export async function submitRetentionSession(sessionId, answers) {
  return apiFetch(`/api/intelligence/retention/session/${encodeURIComponent(sessionId)}/submit`, {
    method: 'POST',
    body: JSON.stringify({ answers })
  });
}

/**
 * Abandon an in-progress retention session.
 * Requires authentication.
 * @param {string} sessionId
 */
export async function abandonRetentionSession(sessionId) {
  return apiFetch(`/api/intelligence/retention/session/${encodeURIComponent(sessionId)}/abandon`, {
    method: 'POST'
  });
}

/**
 * Fetch retention assessment history with longitudinal comparisons.
 * Requires authentication.
 * @param {Object} [params={}]
 * @param {string} [params.topic]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 */
export async function getRetentionHistory(params = {}) {
  const query = new URLSearchParams();
  if (params.topic) query.set('topic', params.topic);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch(`/api/intelligence/retention/history${qs ? `?${qs}` : ''}`);
}

/**
 * Dismiss a topic retention check for 48 hours.
 * Requires authentication.
 * @param {string} topic
 * @param {number} [hours=48]
 */
export async function dismissRetentionTopic(topic, hours = 48) {
  return apiFetch('/api/intelligence/retention/dismiss', {
    method: 'POST',
    body: JSON.stringify({ topic, hours })
  });
}

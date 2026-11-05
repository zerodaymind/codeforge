/**
 * Learning Plan Utilities for Adaptive Onboarding & Learner Profile (Milestone 15A)
 * Provides centralized catalogues, label formatters, and honest recommendation logic
 * connecting learner profiles directly to CodeForge's genuine content catalogue.
 */

export const GOAL_MAP = {
  beginner: {
    id: 'beginner',
    title: 'Learn programming from scratch',
    icon: '🌱',
    badge: 'Beginner',
    badgeColor: 'success',
    description: 'Focus on core syntax, mental models, and step-by-step problem-solving.'
  },
  revival: {
    id: 'revival',
    title: 'Revive a programming language I learned before',
    icon: '🔄',
    badge: 'Revival',
    badgeColor: 'warning',
    description: 'Diagnose syntax gaps and fast-track concept refresh without basic fluff.'
  },
  interview: {
    id: 'interview',
    title: 'Improve my DSA and interview problem-solving',
    icon: '🎯',
    badge: 'Interview Prep',
    badgeColor: 'primary',
    description: 'Master algorithmic patterns and coding assessment techniques.'
  },
  practice: {
    id: 'practice',
    title: 'General problem-solving practice',
    icon: '⚡',
    badge: 'Continuous Practice',
    badgeColor: 'info',
    description: 'Sharpen implementation speed and build a consistent daily coding habit.'
  }
};

export const LANGUAGE_MAP = {
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    icon: 'JS',
    category: 'Web & Systems',
    statusNote: 'Sandboxed Code Execution Available',
    executionAvailable: true
  },
  python: {
    id: 'python',
    name: 'Python',
    icon: 'PY',
    category: 'Algorithms & Scripting',
    statusNote: 'Practice & Quizzes (Sandbox Coming Soon)',
    executionAvailable: false
  },
  cpp: {
    id: 'cpp',
    name: 'C++',
    icon: 'C++',
    category: 'Competitive & Systems',
    statusNote: 'Practice & Quizzes (Sandbox Coming Soon)',
    executionAvailable: false
  },
  java: {
    id: 'java',
    name: 'Java',
    icon: 'JV',
    category: 'Enterprise & Algorithms',
    statusNote: 'Practice & Quizzes (Sandbox Coming Soon)',
    executionAvailable: false
  },
  c: {
    id: 'c',
    name: 'C',
    icon: 'C',
    category: 'Systems & Architecture',
    statusNote: 'Foundational Language Architecture',
    executionAvailable: false
  }
};

export const LANGUAGE_STATUS_MAP = {
  new: {
    label: 'Learning from Scratch',
    badgeColor: 'info'
  },
  revision: {
    label: 'Reviving / Syntax Refresh',
    badgeColor: 'warning'
  },
  practicing: {
    label: 'Active Practice',
    badgeColor: 'success'
  }
};

export const STARTING_MODE_MAP = {
  diagnostic: {
    label: 'Concept Diagnostic Quiz',
    description: 'Short quiz assessment to uncover what you remember and highlight gaps.'
  },
  practice: {
    label: 'Targeted Problem Practice',
    description: 'Hands-on coding challenges matched to your focus areas in the editor.'
  },
  fundamentals: {
    label: 'Foundational Concepts First',
    description: 'Step-by-step review of primitives, control flow, and syntax conventions.'
  },
  custom: {
    label: 'Custom Balanced Flow',
    description: 'Curated mix of concept checks and code execution challenges.'
  }
};

/**
 * Computes an honest, actionable recommendation based on the learner's profile.
 * Never fabricates features or mentors; links strictly to existing quizzes and practice problems.
 *
 * @param {Object} profile - User or onboarding profile object
 * @returns {Object} { mode, title, reason, suggestedAction, actionPath, badge }
 */
export function getLearnerRecommendation(profile) {
  if (!profile) {
    return {
      mode: 'practice',
      title: 'Explore Practice Problems',
      reason: 'Start solving challenges in our interactive code editor with automated test cases.',
      suggestedAction: 'View Problem Catalog',
      actionPath: '/practice',
      badge: 'Getting Started'
    };
  }

  const goals = profile.learningGoals || [];
  const languages = profile.languages || [];
  const primaryLang = languages[0]?.language || 'javascript';
  const langConfig = LANGUAGE_MAP[primaryLang] || { name: 'JavaScript' };
  const langName = langConfig.name;

  const hasRevival = goals.includes('revival');
  const hasInterview = goals.includes('interview');
  const hasBeginner = goals.includes('beginner');

  if (hasRevival) {
    return {
      mode: 'diagnostic',
      title: `Refresh & Revive ${langName}`,
      reason: `Since you have prior experience with ${langName}, jumping straight into complex problems often causes frustration over minor syntax details. A diagnostic quiz pinpoints exactly what you already understand vs. syntax worth brushing up on.`,
      suggestedAction: 'Take JavaScript Fundamentals Diagnostic Quiz',
      actionPath: '/quiz',
      badge: 'Recommended for Revival'
    };
  }

  if (hasInterview) {
    return {
      mode: 'diagnostic',
      title: 'Interview & DSA Readiness Assessment',
      reason: 'Preparing for technical interviews requires strong algorithmic intuition under timed constraints. Assessing foundational data structures first ensures you focus practice on high-yield patterns.',
      suggestedAction: 'Take Data Structures & Algorithms Assessment',
      actionPath: '/quiz',
      badge: 'Recommended for Interviews'
    };
  }

  if (hasBeginner) {
    return {
      mode: 'fundamentals',
      title: `Foundations of ${langName}`,
      reason: 'Building a strong mental model of programming logic and problem decomposition is the best first step. Begin with straightforward challenges with step-by-step test validation.',
      suggestedAction: 'Start Easy Practice Problems',
      actionPath: '/practice',
      badge: 'Recommended for Beginners'
    };
  }

  return {
    mode: 'practice',
    title: 'Targeted Problem Solving',
    reason: 'Your learning goals focus on consistent challenge-solving and habit building. Explore our curated catalogue of array, string, and algorithmic problems.',
    suggestedAction: 'Explore Practice Catalog',
    actionPath: '/practice',
    badge: 'Recommended for Practice'
  };
}

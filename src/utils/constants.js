/**
 * Application Constants
 */

export const APP_NAME = 'CodeForge';
export const APP_TAGLINE = 'Programming Practice & Assessment Platform';

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PRACTICE: '/practice',
  PRACTICE_DETAIL: (id) => `/practice/${id}`,
  QUIZ: '/quiz',
  QUIZ_RESULT: '/quiz/result',
  PROFILE: '/profile'
};

export const DIFFICULTY_LEVELS = ['Easy', 'Medium', 'Hard'];

/**
 * Profile Utility & Configuration
 * Provides default structure and fallback skills for profile display.
 *
 * NOTE: Legacy localStorage demo persistence (codeforge_demo_profile) is deprecated
 * in Milestone 9. All profile persistence is securely handled by MongoDB via
 * GET /api/users/me and PUT /api/users/me authenticated endpoints.
 * The authentication and session source of truth is 'codeforge_auth'.
 */

export const defaultProfile = {
  fullName: 'CodeForge Member',
  email: 'member@codeforge.local',
  gender: 'Not specified',
  experience: 'Intermediate',
  interests: [
    'Data Structures & Algorithms',
    'Web Development',
    'Artificial Intelligence'
  ],
  skills: [
    { name: 'JavaScript', percentage: 75, color: 'primary' },
    { name: 'Data Structures', percentage: 60, color: 'info' },
    { name: 'Algorithms', percentage: 50, color: 'success' }
  ]
};


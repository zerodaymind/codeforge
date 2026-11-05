/**
 * General Helper Utilities
 */

export const formatDate = (date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date));
};

export const getDifficultyBadgeClass = (difficulty) => {
  switch (String(difficulty).toLowerCase()) {
    case 'easy':
      return 'bg-success';
    case 'medium':
      return 'bg-warning text-dark';
    case 'hard':
      return 'bg-danger';
    default:
      return 'bg-secondary';
  }
};

export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

import React from 'react';

/**
 * FilterPanel Component
 * Provides a structured Bootstrap form with dropdown, radio buttons, and checkboxes
 * for filtering practice problems by Language, Difficulty, and Topics.
 */
export default function FilterPanel({
  selectedLanguage,
  onLanguageChange,
  selectedDifficulty,
  onDifficultyChange,
  selectedTopics,
  onTopicToggle,
  onApply,
  onReset,
  validationError,
  validationMessage
}) {
  const languages = [
    { value: 'All', label: 'All Languages' },
    { value: 'C', label: 'C' },
    { value: 'C++', label: 'C++' },
    { value: 'Java', label: 'Java' },
    { value: 'JavaScript', label: 'JavaScript' },
    { value: 'Python', label: 'Python' }
  ];

  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  const availableTopics = [
    'Arrays',
    'Strings',
    'Recursion',
    'Linked List',
    'Sorting',
    'Searching',
    'Hashing',
    'Stack',
    'Queue'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply();
  };

  return (
    <div className="card border-0 shadow-sm filter-panel">
      <div className="card-header bg-white border-bottom py-3">
        <h5 className="card-title fw-bold mb-0 text-dark">Filter Problems</h5>
      </div>

      <div className="card-body p-4">
        {/* Validation Error Alert */}
        {validationError && (
          <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
            <strong className="d-block mb-1">Validation Notice</strong>
            {validationError}
          </div>
        )}

        {/* Validation Message / Status */}
        {validationMessage && (
          <div
            id="filter-feedback-alert"
            className="alert alert-success py-2 px-3 small mb-3"
            role="alert"
          >
            {validationMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* SECTION 1: LANGUAGE DROPDOWN */}
          <div className="mb-4">
            <label htmlFor="languageSelect" className="form-label fw-bold small text-uppercase text-secondary">
              Language
            </label>
            <select
              id="languageSelect"
              className="form-select"
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              {languages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* SECTION 2: DIFFICULTY RADIO BUTTONS */}
          <div className="mb-4">
            <label className="form-label fw-bold small text-uppercase text-secondary d-block">
              Difficulty
            </label>
            <div className="d-flex flex-column gap-2">
              {difficulties.map((diff) => (
                <div key={diff} className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="difficultyRadio"
                    id={`diff-${diff}`}
                    value={diff}
                    checked={selectedDifficulty === diff}
                    onChange={() => onDifficultyChange(diff)}
                  />
                  <label className="form-check-label small" htmlFor={`diff-${diff}`}>
                    {diff}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: TOPICS CHECKBOXES */}
          <div className="mb-4">
            <label className="form-label fw-bold small text-uppercase text-secondary d-block">
              Topics
            </label>
            <div className="d-flex flex-column gap-2" style={{ maxHeight: '220px', overflowY: 'auto' }}>
              {availableTopics.map((topic) => {
                const isChecked = selectedTopics.includes(topic);
                return (
                  <div key={topic} className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`topic-${topic}`}
                      checked={isChecked}
                      onChange={() => onTopicToggle(topic)}
                    />
                    <label className="form-check-label small" htmlFor={`topic-${topic}`}>
                      {topic}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="d-grid gap-2 pt-2 border-top">
            <button
              id="btn-apply-filters"
              type="submit"
              className="btn btn-primary fw-semibold"
            >
              Apply Filters
            </button>
            <button
              id="btn-reset-filters"
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onReset}
            >
              Reset Filters
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

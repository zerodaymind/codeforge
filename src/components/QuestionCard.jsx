import React from 'react';

/**
 * QuestionCard component displaying a single question and its selectable options.
 * Uses Bootstrap radio buttons for accessible single-choice selection.
 */
export default function QuestionCard({ question, selectedAnswer, onSelectAnswer }) {
  const { id, topic, question: questionText, options } = question;

  return (
    <div className="card shadow-sm border-0 question-card mb-4">
      <div className="card-body p-4 p-md-5">
        {/* Topic Tag */}
        {topic && (
          <span className="badge bg-body-secondary text-secondary border small mb-2">
            Topic: {topic}
          </span>
        )}

        {/* Question Heading */}
        <h3 className="h4 fw-bold text-dark mb-4 lh-base">
          {questionText}
        </h3>

        {/* Radio Button Options */}
        <div className="d-flex flex-column gap-3" role="radiogroup" aria-label={questionText}>
          {options.map((option, idx) => {
            const isSelected = selectedAnswer === option;
            const inputId = `q${id}-opt-${idx}`;

            return (
              <div
                key={option}
                className={`form-check d-flex align-items-center p-3 rounded border transition-all ${
                  isSelected
                    ? 'border-primary bg-primary bg-opacity-10 shadow-sm'
                    : 'border-light-subtle bg-white'
                }`}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelectAnswer(option)}
              >
                <input
                  className="form-check-input ms-1 me-3 my-0"
                  type="radio"
                  name={`quiz-question-${id}`}
                  id={inputId}
                  value={option}
                  checked={isSelected}
                  onChange={() => onSelectAnswer(option)}
                  aria-checked={isSelected}
                />
                <label
                  className="form-check-label w-100 mb-0 fw-medium text-dark"
                  htmlFor={inputId}
                  style={{ cursor: 'pointer' }}
                >
                  {option}
                </label>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

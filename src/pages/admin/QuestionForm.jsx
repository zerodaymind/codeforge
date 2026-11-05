import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminHeader from '../../components/admin/AdminHeader';
import { getAdminQuestion, createAdminQuestion, updateAdminQuestion } from '../../utils/api';

export default function QuestionForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    prompt: '',
    topic: 'JavaScript',
    difficulty: 'Medium',
    points: 1,
    type: 'multiple-choice',
    status: 'active',
    codeSnippet: '',
    options: ['', '', '', ''],
    answer: '',
    explanation: '',
    tags: ''
  });

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!isEditing) return;

    let isMounted = true;
    getAdminQuestion(id)
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success) {
          const q = res.data.data;
          setFormData({
            prompt: q.prompt || '',
            topic: q.topic || 'JavaScript',
            difficulty: q.difficulty || 'Medium',
            points: q.points || 1,
            type: q.type || 'multiple-choice',
            status: q.status || 'active',
            codeSnippet: q.codeSnippet || '',
            options: q.options && q.options.length ? q.options : ['', '', '', ''],
            answer: q.answer || '',
            explanation: q.explanation || '',
            tags: Array.isArray(q.tags) ? q.tags.join(', ') : ''
          });
        } else {
          setError(res.data?.message || `Question #${id} not found.`);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Error loading question details.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, isEditing]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'points' ? Math.max(1, parseInt(value, 10) || 1) : value
    }));
  };

  const handleOptionChange = (index, value) => {
    const updated = [...formData.options];
    const oldValue = updated[index];
    updated[index] = value;

    setFormData((prev) => ({
      ...prev,
      options: updated,
      // If the answer was set to the old value, update it
      answer: prev.answer === oldValue ? value : prev.answer
    }));
  };

  const handleAddOption = () => {
    setFormData((prev) => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const handleRemoveOption = (index) => {
    if (formData.options.length <= 2) {
      alert('Questions must have at least 2 options.');
      return;
    }
    const removedValue = formData.options[index];
    const updated = formData.options.filter((_, i) => i !== index);

    setFormData((prev) => ({
      ...prev,
      options: updated,
      answer: prev.answer === removedValue ? (updated[0] || '') : prev.answer
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!formData.prompt.trim()) {
      setError('Question prompt is required.');
      return;
    }

    const cleanOptions = formData.options.map((opt) => opt.trim());
    if (cleanOptions.length < 2) {
      setError('Question must have at least 2 options.');
      return;
    }

    if (cleanOptions.some((opt) => !opt)) {
      setError('All option fields must contain text.');
      return;
    }

    // Check duplicate options
    const uniqueOptions = new Set(cleanOptions);
    if (uniqueOptions.size !== cleanOptions.length) {
      setError('All options must be unique.');
      return;
    }

    if (!formData.answer.trim()) {
      setError('Please select a correct answer.');
      return;
    }

    if (!cleanOptions.includes(formData.answer.trim())) {
      setError('The selected correct answer must exactly match one of the options.');
      return;
    }

    const payload = {
      prompt: formData.prompt.trim(),
      topic: formData.topic.trim(),
      difficulty: formData.difficulty,
      points: Number(formData.points),
      type: formData.type,
      status: formData.status,
      codeSnippet: formData.codeSnippet ? formData.codeSnippet.trim() : undefined,
      options: cleanOptions,
      answer: formData.answer.trim(),
      explanation: formData.explanation.trim(),
      tags: formData.tags
        ? formData.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : []
    };

    setIsSubmitting(true);
    try {
      const res = isEditing
        ? await updateAdminQuestion(id, payload)
        : await createAdminQuestion(payload);

      if (res.ok && res.data?.success) {
        setSuccess(
          isEditing
            ? `Question #${id} updated successfully!`
            : 'New question created successfully!'
        );
        setTimeout(() => {
          navigate('/admin/questions');
        }, 1200);
      } else {
        setError(res.data?.message || 'Failed to save question.');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred while saving.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <AdminHeader
        title={isEditing ? `Edit Question #${id}` : 'Create Question'}
        subtitle="Author assessment items with options, code snippets, explanations, and instant preview"
        actions={
          <Link to="/admin/questions" className="btn btn-outline-light btn-sm">
            &larr; Back to Questions
          </Link>
        }
      />

      <div className="container pb-5">
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading question...</span>
            </div>
            <p className="text-secondary small mt-2">Loading question configuration...</p>
          </div>
        ) : (
          <div className="row g-4">
            {/* Form Column */}
            <div className="col-12 col-lg-7">
              <div className="card bg-dark border-secondary text-white shadow-sm">
                <div className="card-header border-secondary py-3">
                  <h5 className="mb-0 fw-bold">
                    {isEditing ? `Edit Question #${id}` : 'Question Details'}
                  </h5>
                </div>
                <div className="card-body p-4">
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="alert alert-success" role="alert">
                      {success}
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    {/* Prompt */}
                    <div className="mb-3">
                      <label className="form-label fw-semibold">
                        Prompt <span className="text-danger">*</span>
                      </label>
                      <textarea
                        name="prompt"
                        rows="3"
                        className="form-control bg-secondary text-white border-0"
                        placeholder="What is the output or behavior of..."
                        value={formData.prompt}
                        onChange={handleInputChange}
                        required
                      ></textarea>
                    </div>

                    {/* Metadata Row: Topic, Difficulty, Points, Status */}
                    <div className="row g-3 mb-3">
                      <div className="col-6 col-md-3">
                        <label className="form-label small fw-semibold">Topic</label>
                        <select
                          name="topic"
                          className="form-select form-select-sm bg-secondary text-white border-0"
                          value={formData.topic}
                          onChange={handleInputChange}
                        >
                          <option value="JavaScript">JavaScript</option>
                          <option value="React">React</option>
                          <option value="Node.js">Node.js</option>
                          <option value="Python">Python</option>
                          <option value="HTML & CSS">HTML & CSS</option>
                          <option value="Data Structures">Data Structures</option>
                          <option value="General">General</option>
                        </select>
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label small fw-semibold">Difficulty</label>
                        <select
                          name="difficulty"
                          className="form-select form-select-sm bg-secondary text-white border-0"
                          value={formData.difficulty}
                          onChange={handleInputChange}
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label small fw-semibold">Points</label>
                        <input
                          type="number"
                          name="points"
                          min="1"
                          max="20"
                          className="form-control form-control-sm bg-secondary text-white border-0"
                          value={formData.points}
                          onChange={handleInputChange}
                        />
                      </div>

                      <div className="col-6 col-md-3">
                        <label className="form-label small fw-semibold">Status</label>
                        <select
                          name="status"
                          className="form-select form-select-sm bg-secondary text-white border-0"
                          value={formData.status}
                          onChange={handleInputChange}
                        >
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </div>

                    {/* Code Snippet (Optional) */}
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">
                        Code Snippet <span className="text-secondary">(Optional)</span>
                      </label>
                      <textarea
                        name="codeSnippet"
                        rows="4"
                        className="form-control font-monospace bg-black text-light border-secondary"
                        placeholder={'function example() {\n  return 42;\n}'}
                        value={formData.codeSnippet}
                        onChange={handleInputChange}
                      ></textarea>
                      <div className="form-text text-secondary small">
                        Provide code block formatting if question tests a code example.
                      </div>
                    </div>

                    {/* Options Manager */}
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <label className="form-label fw-semibold mb-0">
                          Options & Correct Answer <span className="text-danger">*</span>
                        </label>
                        <button
                          type="button"
                          className="btn btn-outline-info btn-sm py-0"
                          onClick={handleAddOption}
                          disabled={formData.options.length >= 6}
                        >
                          + Add Option
                        </button>
                      </div>
                      <p className="text-secondary small mb-3">
                        Enter option texts below and select the radio button next to the correct answer.
                      </p>

                      <div className="vstack gap-2">
                        {formData.options.map((opt, idx) => (
                          <div key={idx} className="input-group input-group-sm">
                            <div className="input-group-text bg-secondary border-0">
                              <input
                                type="radio"
                                name="correctAnswerRadio"
                                className="form-check-input mt-0"
                                checked={Boolean(opt && formData.answer === opt)}
                                onChange={() => {
                                  if (opt.trim()) {
                                    setFormData((prev) => ({ ...prev, answer: opt.trim() }));
                                  }
                                }}
                                title="Mark as correct answer"
                              />
                            </div>
                            <span className="input-group-text bg-dark text-white border-secondary">
                              {String.fromCharCode(65 + idx)}
                            </span>
                            <input
                              type="text"
                              className="form-control bg-secondary text-white border-0"
                              placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                              value={opt}
                              onChange={(e) => handleOptionChange(idx, e.target.value)}
                              required
                            />
                            {formData.options.length > 2 && (
                              <button
                                type="button"
                                className="btn btn-outline-danger"
                                onClick={() => handleRemoveOption(idx)}
                                title="Remove option"
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {!formData.answer && (
                        <div className="text-warning small mt-2">
                          &bull; Please choose which option is the correct answer.
                        </div>
                      )}
                    </div>

                    {/* Explanation */}
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">
                        Explanation & Justification
                      </label>
                      <textarea
                        name="explanation"
                        rows="3"
                        className="form-control bg-secondary text-white border-0"
                        placeholder="Explain why the chosen answer is correct for learner review snapshots..."
                        value={formData.explanation}
                        onChange={handleInputChange}
                      ></textarea>
                    </div>

                    {/* Tags */}
                    <div className="mb-4">
                      <label className="form-label small fw-semibold">
                        Tags <span className="text-secondary">(Comma-separated)</span>
                      </label>
                      <input
                        type="text"
                        name="tags"
                        className="form-control form-control-sm bg-secondary text-white border-0"
                        placeholder="closures, scope, es6"
                        value={formData.tags}
                        onChange={handleInputChange}
                      />
                    </div>

                    {/* Actions */}
                    <div className="d-flex justify-content-between align-items-center pt-3 border-top border-secondary">
                      <Link to="/admin/questions" className="btn btn-outline-light btn-sm">
                        Cancel
                      </Link>
                      <button
                        type="submit"
                        className="btn btn-primary px-4"
                        disabled={isSubmitting}
                      >
                        {isSubmitting
                          ? 'Saving...'
                          : isEditing
                          ? 'Update Question'
                          : 'Create Question'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Live Preview Column */}
            <div className="col-12 col-lg-5">
              <div className="card bg-dark border-secondary text-white shadow-sm sticky-top" style={{ top: '80px' }}>
                <div className="card-header border-secondary d-flex justify-content-between align-items-center py-3">
                  <h6 className="mb-0 fw-bold">Learner Preview</h6>
                  <span className="badge bg-primary">Interactive Mock</span>
                </div>
                <div className="card-body p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="badge bg-info text-dark">{formData.topic}</span>
                    <div className="d-flex gap-2">
                      <span className="badge bg-secondary">{formData.difficulty}</span>
                      <span className="badge bg-light text-dark">{formData.points} pt</span>
                    </div>
                  </div>

                  <h5 className="fw-semibold mb-3">
                    {formData.prompt || <span className="text-secondary italic">Enter prompt above...</span>}
                  </h5>

                  {formData.codeSnippet && (
                    <pre className="bg-black text-light p-3 rounded mb-3 font-monospace small overflow-auto">
                      <code>{formData.codeSnippet}</code>
                    </pre>
                  )}

                  <div className="vstack gap-2 mb-3">
                    {formData.options.map((opt, i) => {
                      const isCorrect = Boolean(opt && formData.answer === opt);
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded border small d-flex justify-content-between align-items-center ${
                            isCorrect
                              ? 'border-success bg-success bg-opacity-25 text-white'
                              : 'border-secondary text-light'
                          }`}
                        >
                          <span>
                            <strong>{String.fromCharCode(65 + i)}.</strong>{' '}
                            {opt || <span className="text-secondary">(Option text)</span>}
                          </span>
                          {isCorrect && (
                            <span className="badge bg-success small">Correct Answer</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {formData.explanation && (
                    <div className="p-3 bg-secondary bg-opacity-25 border border-secondary rounded small">
                      <strong className="text-info">Explanation:</strong>
                      <p className="mb-0 mt-1 text-light">{formData.explanation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

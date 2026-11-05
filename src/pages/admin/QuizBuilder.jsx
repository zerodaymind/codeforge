import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AdminHeader from '../../components/admin/AdminHeader';
import {
  getAdminQuiz,
  createAdminQuiz,
  updateAdminQuiz,
  publishAdminQuiz,
  getAdminQuestions
} from '../../utils/api';

export default function QuizBuilder() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();

  // Quiz details state
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    topic: 'JavaScript',
    difficulty: 'Intermediate',
    timeLimitMinutes: 15,
    passingPercentage: 70,
    instructions: 'Answer each question carefully. You may not return once submitted.',
    isPublished: false
  });

  // Selected questions in this quiz
  const [selectedQuestions, setSelectedQuestions] = useState([]);

  // Question Bank Picker state
  const [bankQuestions, setBankQuestions] = useState([]);
  const [bankSearch, setBankSearch] = useState('');
  const [bankTopic, setBankTopic] = useState('All');
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  // Status & UI state
  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Auto-slugify title if creating new quiz
  const handleTitleChange = (e) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      title: val,
      slug: !isEditing ? val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : prev.slug
    }));
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
          ? parseInt(value, 10) || 0
          : value
    }));
  };

  // Load Quiz if editing
  useEffect(() => {
    if (!isEditing) return;

    let isMounted = true;
    getAdminQuiz(id)
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success) {
          const qz = res.data.data;
          setFormData({
            title: qz.title || '',
            slug: qz.slug || '',
            description: qz.description || '',
            topic: qz.topic || 'JavaScript',
            difficulty: qz.difficulty || 'Intermediate',
            timeLimitMinutes: qz.timeLimitMinutes || 15,
            passingPercentage: qz.passingPercentage || 70,
            instructions: qz.instructions || '',
            isPublished: Boolean(qz.isPublished)
          });
          setSelectedQuestions(qz.questions || []);
        } else {
          setError(res.data?.message || `Quiz #${id} not found.`);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Error loading quiz configuration.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, isEditing]);

  // Load Bank Questions when picker is opened
  useEffect(() => {
    if (!showBankPicker) return;

    let isMounted = true;
    getAdminQuestions({
      limit: 50,
      status: 'active',
      search: bankSearch,
      topic: bankTopic
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data?.success) {
          setBankQuestions(res.data.data.questions || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsBankLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [showBankPicker, bankSearch, bankTopic]);

  // Question Reordering & Selection handlers
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const items = [...selectedQuestions];
    const [moved] = items.splice(index, 1);
    items.splice(index - 1, 0, moved);
    setSelectedQuestions(items);
  };

  const handleMoveDown = (index) => {
    if (index === selectedQuestions.length - 1) return;
    const items = [...selectedQuestions];
    const [moved] = items.splice(index, 1);
    items.splice(index + 1, 0, moved);
    setSelectedQuestions(items);
  };

  const handleRemoveQuestion = (index) => {
    setSelectedQuestions(selectedQuestions.filter((_, i) => i !== index));
  };

  const handleAddQuestionFromBank = (bankQ) => {
    // Check duplicate
    const exists = selectedQuestions.some(
      (sq) => (sq.questionId && sq.questionId === bankQ.id) || sq.prompt === bankQ.prompt
    );
    if (exists) return;

    setSelectedQuestions((prev) => [
      ...prev,
      {
        questionId: bankQ.id,
        prompt: bankQ.prompt,
        options: bankQ.options,
        answer: bankQ.answer,
        explanation: bankQ.explanation,
        points: bankQ.points || 1,
        topic: bankQ.topic || formData.topic
      }
    ]);
  };

  const totalPoints = selectedQuestions.reduce((acc, q) => acc + (q.points || 1), 0);

  const handleSubmit = async (publishImmediately = false) => {
    setError(null);
    setSuccess(null);

    if (!formData.title.trim()) {
      setError('Quiz title is required.');
      return;
    }
    if (!formData.slug.trim()) {
      setError('Quiz slug is required.');
      return;
    }
    if (!formData.description.trim()) {
      setError('Quiz description is required.');
      return;
    }

    if (publishImmediately && selectedQuestions.length === 0) {
      setError('A published quiz must contain at least 1 question.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim(),
        description: formData.description.trim(),
        topic: formData.topic,
        difficulty: formData.difficulty,
        timeLimitMinutes: Number(formData.timeLimitMinutes),
        passingPercentage: Number(formData.passingPercentage),
        instructions: formData.instructions ? formData.instructions.trim() : '',
        isPublished: publishImmediately ? true : formData.isPublished,
        questions: selectedQuestions
      };

      let quizId = id;
      const res = isEditing
        ? await updateAdminQuiz(id, payload)
        : await createAdminQuiz(payload);

      if (!res.ok || !res.data?.success) {
        setError(res.data?.message || 'Failed to save quiz blueprint.');
        setIsSubmitting(false);
        return;
      }

      if (!isEditing && res.data?.data?._id) {
        quizId = res.data.data._id;
      }

      if (publishImmediately) {
        const pubRes = await publishAdminQuiz(quizId);
        if (!pubRes.ok || !pubRes.data?.success) {
          setError(
            `Saved as draft, but failed to publish: ${pubRes.data?.message || 'Integrity rules not satisfied.'}`
          );
          setIsSubmitting(false);
          return;
        }
      }

      setSuccess(
        publishImmediately
          ? 'Quiz saved and published to learners successfully!'
          : 'Quiz saved successfully as draft!'
      );

      setTimeout(() => {
        navigate('/admin/quizzes');
      }, 1200);
    } catch (err) {
      setError(err.message || 'Network error saving quiz.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <AdminHeader
        title={isEditing ? `Edit Quiz: ${formData.title || id}` : 'Build New Quiz'}
        subtitle="Configure assessment metadata, pick questions from the bank, and validate scoring rules"
        actions={
          <Link to="/admin/quizzes" className="btn btn-outline-light btn-sm">
            &larr; Back to Quizzes
          </Link>
        }
      />

      <div className="container pb-5">
        {isLoading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading quiz...</span>
            </div>
            <p className="text-secondary small mt-2">Loading quiz configuration...</p>
          </div>
        ) : (
          <>
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

            <div className="row g-4">
              {/* Left Column: Metadata */}
              <div className="col-12 col-lg-5">
                <div className="card bg-dark border-secondary text-white shadow-sm mb-4">
                  <div className="card-header border-secondary py-3">
                    <h5 className="mb-0 fw-bold">Quiz Metadata</h5>
                  </div>
                  <div className="card-body p-4">
                    {/* Title */}
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">
                        Quiz Title <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        className="form-control bg-secondary text-white border-0"
                        placeholder="e.g. JavaScript Core Foundations"
                        value={formData.title}
                        onChange={handleTitleChange}
                        required
                      />
                    </div>

                    {/* Slug */}
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">
                        URL Slug <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        name="slug"
                        className="form-control font-monospace form-control-sm bg-secondary text-white border-0"
                        placeholder="javascript-core-foundations"
                        value={formData.slug}
                        onChange={handleInputChange}
                        required
                      />
                      <div className="form-text text-secondary small">
                        Accessible at /quiz/{formData.slug || 'slug'}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">
                        Description <span className="text-danger">*</span>
                      </label>
                      <textarea
                        name="description"
                        rows="3"
                        className="form-control bg-secondary text-white border-0"
                        placeholder="Concise overview of what concepts this quiz tests..."
                        value={formData.description}
                        onChange={handleInputChange}
                        required
                      ></textarea>
                    </div>

                    {/* Topic & Difficulty */}
                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <label className="form-label small fw-semibold">Topic</label>
                        <select
                          name="topic"
                          className="form-select form-select-sm bg-secondary text-white border-0"
                          value={formData.topic}
                          onChange={handleInputChange}
                        >
                          <option value="JavaScript">JavaScript</option>
                          <option value="React">React</option>
                          <option value="Python">Python</option>
                          <option value="Full Stack">Full Stack</option>
                          <option value="General">General</option>
                        </select>
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold">Difficulty</label>
                        <select
                          name="difficulty"
                          className="form-select form-select-sm bg-secondary text-white border-0"
                          value={formData.difficulty}
                          onChange={handleInputChange}
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                        </select>
                      </div>
                    </div>

                    {/* Time limit & Passing percentage */}
                    <div className="row g-2 mb-3">
                      <div className="col-6">
                        <label className="form-label small fw-semibold">Time Limit (mins)</label>
                        <input
                          type="number"
                          name="timeLimitMinutes"
                          min="1"
                          max="180"
                          className="form-control form-control-sm bg-secondary text-white border-0"
                          value={formData.timeLimitMinutes}
                          onChange={handleInputChange}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-semibold">Passing %</label>
                        <input
                          type="number"
                          name="passingPercentage"
                          min="1"
                          max="100"
                          className="form-control form-control-sm bg-secondary text-white border-0"
                          value={formData.passingPercentage}
                          onChange={handleInputChange}
                        />
                      </div>
                    </div>

                    {/* Instructions */}
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Learner Instructions</label>
                      <textarea
                        name="instructions"
                        rows="2"
                        className="form-control form-control-sm bg-secondary text-white border-0"
                        placeholder="Instructions displayed before quiz begins..."
                        value={formData.instructions}
                        onChange={handleInputChange}
                      ></textarea>
                    </div>

                    {/* Summary box */}
                    <div className="p-3 bg-secondary bg-opacity-25 border border-secondary rounded mb-4">
                      <div className="d-flex justify-content-between text-secondary small mb-1">
                        <span>Total Questions:</span>
                        <strong className="text-white">{selectedQuestions.length}</strong>
                      </div>
                      <div className="d-flex justify-content-between text-secondary small">
                        <span>Total Score:</span>
                        <strong className="text-info">{totalPoints} pts</strong>
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="vstack gap-2">
                      <button
                        type="button"
                        className="btn btn-success"
                        disabled={isSubmitting || selectedQuestions.length === 0}
                        onClick={() => handleSubmit(true)}
                      >
                        {isSubmitting ? 'Saving...' : 'Save & Publish to Learners'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-light"
                        disabled={isSubmitting}
                        onClick={() => handleSubmit(false)}
                      >
                        {isSubmitting ? 'Saving...' : 'Save as Draft'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Question Selection & Ordering */}
              <div className="col-12 col-lg-7">
                <div className="card bg-dark border-secondary text-white shadow-sm mb-4">
                  <div className="card-header border-secondary d-flex justify-content-between align-items-center py-3">
                    <div>
                      <h5 className="mb-0 fw-bold">Quiz Questions ({selectedQuestions.length})</h5>
                      <span className="text-secondary small">
                        Order questions and verify points allocation
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowBankPicker(!showBankPicker)}
                    >
                      {showBankPicker ? 'Close Picker' : '+ Add from Question Bank'}
                    </button>
                  </div>

                  {/* Bank Picker Drawer */}
                  {showBankPicker && (
                    <div className="p-3 bg-black border-bottom border-secondary">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <h6 className="fw-bold text-info mb-0">Select from Active Question Bank</h6>
                        <span className="text-secondary small">Click + to include in quiz</span>
                      </div>
                      <div className="row g-2 mb-2">
                        <div className="col-8">
                          <input
                            type="text"
                            className="form-control form-control-sm bg-secondary text-white border-0"
                            placeholder="Search bank prompts..."
                            value={bankSearch}
                            onChange={(e) => setBankSearch(e.target.value)}
                          />
                        </div>
                        <div className="col-4">
                          <select
                            className="form-select form-select-sm bg-secondary text-white border-0"
                            value={bankTopic}
                            onChange={(e) => setBankTopic(e.target.value)}
                          >
                            <option value="All">All Topics</option>
                            <option value="JavaScript">JavaScript</option>
                            <option value="React">React</option>
                            <option value="Python">Python</option>
                          </select>
                        </div>
                      </div>

                      {isBankLoading ? (
                        <div className="text-center py-3">
                          <span className="spinner-border spinner-border-sm text-info"></span>
                        </div>
                      ) : bankQuestions.length === 0 ? (
                        <p className="text-secondary small mb-0 text-center py-2">
                          No active questions found in bank.
                        </p>
                      ) : (
                        <div
                          className="vstack gap-2 overflow-auto"
                          style={{ maxHeight: '250px' }}
                        >
                          {bankQuestions.map((bq) => {
                            const isAlreadySelected = selectedQuestions.some(
                              (sq) =>
                                (sq.questionId && sq.questionId === bq.id) ||
                                sq.prompt === bq.prompt
                            );
                            return (
                              <div
                                key={bq.id}
                                className="d-flex justify-content-between align-items-center p-2 rounded bg-dark border border-secondary"
                              >
                                <div className="me-2" style={{ maxWidth: '80%' }}>
                                  <div className="small text-white fw-semibold">
                                    #{bq.id} - {bq.prompt.substring(0, 70)}...
                                  </div>
                                  <div className="small text-secondary">
                                    <span className="badge bg-secondary me-1">{bq.topic}</span>
                                    <span>{bq.points || 1} pt</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${isAlreadySelected ? 'btn-secondary disabled' : 'btn-outline-success'}`}
                                  disabled={isAlreadySelected}
                                  onClick={() => handleAddQuestionFromBank(bq)}
                                >
                                  {isAlreadySelected ? 'Added' : '+ Add'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected Questions List */}
                  <div className="card-body p-3">
                    {selectedQuestions.length === 0 ? (
                      <div className="text-center py-5">
                        <p className="text-secondary mb-3">
                          No questions have been added to this quiz yet.
                        </p>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setShowBankPicker(true)}
                        >
                          + Pick Questions from Bank
                        </button>
                      </div>
                    ) : (
                      <div className="vstack gap-3">
                        {selectedQuestions.map((q, idx) => (
                          <div
                            key={idx}
                            className="card bg-secondary bg-opacity-10 border border-secondary"
                          >
                            <div className="card-body p-3">
                              <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                                <div className="d-flex align-items-center gap-2">
                                  <span className="badge bg-primary rounded-circle">
                                    {idx + 1}
                                  </span>
                                  <span className="badge bg-info text-dark small">
                                    {q.topic || 'General'}
                                  </span>
                                  <span className="badge bg-light text-dark small">
                                    {q.points || 1} pt
                                  </span>
                                </div>
                                <div className="d-flex gap-1">
                                  <button
                                    type="button"
                                    className="btn btn-outline-light btn-sm py-0 px-2"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveUp(idx)}
                                    title="Move question up"
                                  >
                                    &uarr;
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-light btn-sm py-0 px-2"
                                    disabled={idx === selectedQuestions.length - 1}
                                    onClick={() => handleMoveDown(idx)}
                                    title="Move question down"
                                  >
                                    &darr;
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm py-0 px-2"
                                    onClick={() => handleRemoveQuestion(idx)}
                                    title="Remove question from quiz"
                                  >
                                    &times;
                                  </button>
                                </div>
                              </div>
                              <h6 className="fw-semibold text-white mb-2">{q.prompt}</h6>
                              <div className="small text-secondary">
                                Options:{' '}
                                {Array.isArray(q.options)
                                  ? q.options.join(' | ')
                                  : 'Multiple choices'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

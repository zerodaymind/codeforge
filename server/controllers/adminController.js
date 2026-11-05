import mongoose from 'mongoose';
import Question from '../models/Question.js';
import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';

/**
 * Helper to record audit log events safely.
 * Strips secrets, passwords, or tokens.
 */
const recordAudit = async (req, action, entityType, entityId, metadata = {}) => {
  try {
    const actor = req.adminUser?._id || req.user?.id;
    const actorEmail = req.adminUser?.email || 'admin@codeforge.dev';

    await AuditLog.create({
      actor,
      actorEmail,
      action,
      entityType,
      entityId: entityId.toString(),
      metadata,
      timestamp: new Date()
    });
  } catch (err) {
    console.warn('[AuditLog] Warning recording audit log:', err.message);
  }
};

/**
 * Escapes regex special characters.
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Harmonize question model representation with prompt and question fields
 */
const formatQuestion = (q) => {
  if (!q) return null;
  const doc = typeof q.toObject === 'function' ? q.toObject() : { ...q };
  return {
    ...doc,
    prompt: doc.question || doc.prompt || '',
    question: doc.question || doc.prompt || ''
  };
};

/**
 * Harmonize quiz model representation with slug, id, and questions
 */
const formatQuiz = (qz) => {
  if (!qz) return null;
  const doc = typeof qz.toObject === 'function' ? qz.toObject() : { ...qz };
  const questions = (doc.questions || []).map((q) => {
    const qDoc = typeof q.toObject === 'function' ? q.toObject() : { ...q };
    return {
      ...qDoc,
      prompt: qDoc.question || qDoc.prompt || '',
      question: qDoc.question || qDoc.prompt || ''
    };
  });
  return {
    ...doc,
    slug: doc.id,
    questions,
    totalPoints: questions.reduce((sum, item) => sum + (item.points || 1), 0)
  };
};

/**
 * Harmonize audit log representation with entity and entityType
 */
const formatAuditLog = (l) => {
  if (!l) return null;
  const doc = typeof l.toObject === 'function' ? l.toObject() : { ...l };
  return {
    ...doc,
    entity: doc.entityType,
    entityType: doc.entityType
  };
};

// =========================================================================
// SECTION 1: QUESTION BANK CONTROLLERS
// =========================================================================

/**
 * GET /api/admin/questions
 * List all questions with bounded pagination, search, and filters.
 */
export const getAdminQuestions = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, search, topic, difficulty, status } = req.query;

    const query = {};

    if (status && status !== 'All') {
      query.status = status.toLowerCase().trim();
    }

    if (topic && topic !== 'All') {
      query.topic = new RegExp(`^${escapeRegex(topic.trim())}$`, 'i');
    }

    if (difficulty && difficulty !== 'All') {
      query.difficulty = difficulty.trim();
    }

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ question: regex }, { topic: regex }, { explanation: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [questions, total] = await Promise.all([
      Question.find(query)
        .sort({ id: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Question.countDocuments(query)
    ]);

    const formatted = questions.map(formatQuestion);

    res.status(200).json({
      success: true,
      data: {
        questions: formatted,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      },
      questions: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/questions
 * Create a new question in the Question Bank.
 */
export const createAdminQuestion = async (req, res, next) => {
  try {
    const prompt = (req.body.prompt || req.body.question || '').trim();
    const {
      topic,
      codeSnippet = '',
      options,
      answer,
      explanation,
      difficulty = 'Medium',
      points = 1,
      tags = [],
      status = 'active'
    } = req.body;

    // 1. Validation
    if (!prompt || typeof prompt !== 'string' || prompt.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Question prompt is required.'
      });
    }

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Question topic is required.'
      });
    }

    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      return res.status(400).json({
        success: false,
        message: 'A question must provide between 2 and 6 options.'
      });
    }

    // Check unique options
    const uniqueOptions = new Set(options.map((o) => (typeof o === 'string' ? o.trim() : '')));
    if (uniqueOptions.size !== options.length) {
      return res.status(400).json({
        success: false,
        message: 'Question options must be unique.'
      });
    }

    if (!answer || !options.includes(answer)) {
      return res.status(400).json({
        success: false,
        message: 'Correct answer must be one of the provided options.'
      });
    }

    if (!explanation || typeof explanation !== 'string' || explanation.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Explanation is required.'
      });
    }

    const pointsNum = Math.max(1, parseInt(points, 10) || 1);

    // 2. Determine next numeric ID
    const maxQ = await Question.findOne().sort({ id: -1 }).select('id').lean();
    const nextId = (maxQ?.id || 0) + 1;

    // 3. Create question document
    const newQuestion = await Question.create({
      id: nextId,
      topic: topic.trim(),
      question: prompt.trim(),
      codeSnippet: codeSnippet.trim(),
      options: options.map((o) => o.trim()),
      answer: answer.trim(),
      explanation: explanation.trim(),
      difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium',
      type: 'multiple-choice',
      points: pointsNum,
      tags: Array.isArray(tags) ? tags.map((t) => t.trim()) : [],
      status: ['active', 'draft', 'archived'].includes(status) ? status : 'active',
      createdBy: req.adminUser._id,
      updatedBy: req.adminUser._id
    });

    // 4. Audit Log
    await recordAudit(req, 'QUESTION_CREATE', 'Question', newQuestion.id ?? newQuestion._id, {
      id: newQuestion.id,
      topic: newQuestion.topic,
      difficulty: newQuestion.difficulty
    });

    res.status(201).json({
      success: true,
      message: 'Question created successfully.',
      data: formatQuestion(newQuestion)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/questions/:id
 * Retrieve single question details for editing or preview.
 */
export const getAdminQuestionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      $or: [
        ...(isNaN(Number(id)) ? [] : [{ id: Number(id) }]),
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const question = await Question.findOne(query).lean();

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.'
      });
    }

    res.status(200).json({
      success: true,
      data: formatQuestion(question)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/questions/:id
 * Update an existing question.
 */
export const updateAdminQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prompt = req.body.prompt !== undefined ? req.body.prompt : req.body.question;
    const {
      topic,
      codeSnippet,
      options,
      answer,
      explanation,
      difficulty,
      points,
      tags,
      status
    } = req.body;

    const query = {
      $or: [
        ...(isNaN(Number(id)) ? [] : [{ id: Number(id) }]),
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const question = await Question.findOne(query);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.'
      });
    }

    // Validate updates
    if (prompt !== undefined) {
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Question prompt cannot be empty.' });
      }
      question.question = prompt.trim();
    }

    if (topic !== undefined) {
      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Topic cannot be empty.' });
      }
      question.topic = topic.trim();
    }

    if (codeSnippet !== undefined) {
      question.codeSnippet = typeof codeSnippet === 'string' ? codeSnippet.trim() : '';
    }

    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
        return res.status(400).json({ success: false, message: 'Options must be between 2 and 6.' });
      }
      question.options = options.map((o) => o.trim());
    }

    if (answer !== undefined) {
      if (!question.options.includes(answer)) {
        return res.status(400).json({
          success: false,
          message: 'Correct answer must be one of the provided options.'
        });
      }
      question.answer = answer.trim();
    }

    if (explanation !== undefined) {
      if (!explanation || typeof explanation !== 'string' || explanation.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Explanation cannot be empty.' });
      }
      question.explanation = explanation.trim();
    }

    if (difficulty !== undefined && ['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      question.difficulty = difficulty;
    }

    if (points !== undefined) {
      question.points = Math.max(1, parseInt(points, 10) || 1);
    }

    if (tags !== undefined && Array.isArray(tags)) {
      question.tags = tags.map((t) => t.trim());
    }

    if (status !== undefined && ['active', 'draft', 'archived'].includes(status)) {
      question.status = status;
    }

    question.updatedBy = req.adminUser._id;
    await question.save();

    await recordAudit(req, 'QUESTION_UPDATE', 'Question', question.id ?? question._id, {
      id: question.id,
      topic: question.topic
    });

    res.status(200).json({
      success: true,
      message: 'Question updated successfully.',
      data: formatQuestion(question)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/questions/:id/archive
 * Soft-delete / archive a question.
 */
export const archiveAdminQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      $or: [
        ...(isNaN(Number(id)) ? [] : [{ id: Number(id) }]),
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const question = await Question.findOne(query);

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    question.status = 'archived';
    question.updatedBy = req.adminUser._id;
    await question.save();

    await recordAudit(req, 'QUESTION_ARCHIVE', 'Question', question.id ?? question._id, { id: question.id });

    res.status(200).json({
      success: true,
      message: 'Question archived successfully.',
      data: formatQuestion(question)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/questions/:id/restore
 * Restore an archived question.
 */
export const restoreAdminQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      $or: [
        ...(isNaN(Number(id)) ? [] : [{ id: Number(id) }]),
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const question = await Question.findOne(query);

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    question.status = 'active';
    question.updatedBy = req.adminUser._id;
    await question.save();

    await recordAudit(req, 'QUESTION_RESTORE', 'Question', question.id ?? question._id, { id: question.id });

    res.status(200).json({
      success: true,
      message: 'Question restored successfully.',
      data: formatQuestion(question)
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// SECTION 2: QUIZ BUILDER & MANAGEMENT CONTROLLERS
// =========================================================================

/**
 * GET /api/admin/quizzes
 * List all quizzes (published, draft, archived) for administration.
 */
export const getAdminQuizzes = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, search, topic, status } = req.query;

    const query = {};

    if (status === 'published') {
      query.isPublished = true;
      query.isArchived = { $ne: true };
    } else if (status === 'draft') {
      query.isPublished = false;
      query.isArchived = { $ne: true };
    } else if (status === 'archived') {
      query.isArchived = true;
    }

    if (topic && topic !== 'All') {
      query.topic = new RegExp(`^${escapeRegex(topic.trim())}$`, 'i');
    }

    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ title: regex }, { description: regex }, { topic: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const [quizzes, total] = await Promise.all([
      Quiz.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Quiz.countDocuments(query)
    ]);

    const formatted = quizzes.map(formatQuiz);

    res.status(200).json({
      success: true,
      data: {
        quizzes: formatted,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      },
      quizzes: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/quizzes
 * Create a new quiz draft in the system.
 */
export const createAdminQuiz = async (req, res, next) => {
  try {
    const {
      title,
      description,
      topic,
      difficulty = 'Medium',
      instructions = '',
      pointsPerQuestion = 1,
      questions = [],
      isPublished = false
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Quiz title is required.' });
    }

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Quiz topic is required.' });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Quiz description is required.' });
    }

    // Auto-generate clean slug if not provided
    const slug = (
      req.body.slug ||
      req.body.id ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
    ).trim();

    // Check slug uniqueness
    const existing = await Quiz.findOne({ id: slug });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A quiz with identifier "${slug}" already exists.`
      });
    }

    const mappedQuestions = Array.isArray(questions)
      ? questions.map((q, idx) => ({
          questionId: q.questionId || q.id || idx + 1,
          question: (q.question || q.prompt || '').trim(),
          options: Array.isArray(q.options) ? q.options.map((o) => (typeof o === 'string' ? o.trim() : o)) : [],
          answer: (q.answer || '').trim(),
          explanation: (q.explanation || '').trim(),
          points: Math.max(1, parseInt(q.points, 10) || parseInt(pointsPerQuestion, 10) || 1)
        }))
      : [];

    const newQuiz = await Quiz.create({
      id: slug,
      title: title.trim(),
      description: description.trim(),
      topic: topic.trim(),
      difficulty: ['Beginner', 'Easy', 'Intermediate', 'Medium', 'Advanced', 'Hard'].includes(difficulty)
        ? difficulty
        : 'Intermediate',
      instructions: instructions.trim(),
      pointsPerQuestion: Math.max(1, parseInt(pointsPerQuestion, 10) || 1),
      isPublished: Boolean(isPublished),
      isArchived: false,
      version: 1,
      questions: mappedQuestions,
      createdBy: req.adminUser._id,
      updatedBy: req.adminUser._id
    });

    await recordAudit(req, 'QUIZ_CREATE', 'Quiz', newQuiz._id, {
      id: newQuiz.id,
      title: newQuiz.title,
      questionCount: newQuiz.questions.length
    });

    res.status(201).json({
      success: true,
      message: 'Quiz created successfully.',
      data: formatQuiz(newQuiz)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/quizzes/:id
 * Retrieve complete quiz document including full question specifications for admin editing.
 */
export const getAdminQuizById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      $or: [
        { id: id.toLowerCase().trim() },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const quiz = await Quiz.findOne(query).lean();

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    res.status(200).json({
      success: true,
      data: formatQuiz(quiz)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/quizzes/:id
 * Update quiz metadata, instructions, points, and selected questions.
 */
export const updateAdminQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      topic,
      difficulty,
      instructions,
      pointsPerQuestion,
      questions,
      isPublished
    } = req.body;

    const query = {
      $or: [
        { id: id.toLowerCase().trim() },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const quiz = await Quiz.findOne(query);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Title cannot be empty.' });
      }
      quiz.title = title.trim();
    }

    if (description !== undefined) {
      if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Description cannot be empty.' });
      }
      quiz.description = description.trim();
    }

    if (topic !== undefined) {
      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Topic cannot be empty.' });
      }
      quiz.topic = topic.trim();
    }

    if (difficulty !== undefined) {
      quiz.difficulty = difficulty;
    }

    if (instructions !== undefined) {
      quiz.instructions = typeof instructions === 'string' ? instructions.trim() : '';
    }

    if (pointsPerQuestion !== undefined) {
      quiz.pointsPerQuestion = Math.max(1, parseInt(pointsPerQuestion, 10) || 1);
    }

    if (questions !== undefined && Array.isArray(questions)) {
      quiz.questions = questions.map((q, idx) => ({
        questionId: q.questionId || q.id || idx + 1,
        question: (q.question || q.prompt || '').trim(),
        options: Array.isArray(q.options) ? q.options.map((o) => (typeof o === 'string' ? o.trim() : o)) : [],
        answer: (q.answer || '').trim(),
        explanation: (q.explanation || '').trim(),
        points: Math.max(1, parseInt(q.points, 10) || quiz.pointsPerQuestion || 1)
      }));
    }

    if (isPublished !== undefined) {
      quiz.isPublished = Boolean(isPublished);
    }

    quiz.version = (quiz.version || 1) + 1;
    quiz.updatedBy = req.adminUser._id;
    await quiz.save();

    await recordAudit(req, 'QUIZ_UPDATE', 'Quiz', quiz._id, {
      id: quiz.id,
      version: quiz.version,
      questionCount: quiz.questions.length
    });

    res.status(200).json({
      success: true,
      message: 'Quiz updated successfully.',
      data: formatQuiz(quiz)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/quizzes/:id/publish
 * Validate and publish a quiz for learner access.
 */
export const publishAdminQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      $or: [
        { id: id.toLowerCase().trim() },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const quiz = await Quiz.findOne(query);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    // 1. Publishing Validation
    if (!quiz.questions || quiz.questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish a quiz with zero questions. Add at least one question.'
      });
    }

    // 2. Validate every question has prompt, at least 2 options, and valid answer
    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      if (!q.question || q.question.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: `Question at position ${i + 1} has an empty prompt.`
        });
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({
          success: false,
          message: `Question at position ${i + 1} must provide at least 2 options.`
        });
      }
      if (!q.answer || !q.options.includes(q.answer)) {
        return res.status(400).json({
          success: false,
          message: `Question at position ${i + 1} does not have a valid correct answer matching its options.`
        });
      }
    }

    // 3. Verify no archived questions from Question Bank are included
    const questionBankIds = quiz.questions.map((q) => q.questionId).filter(Boolean);
    if (questionBankIds.length > 0) {
      const archivedInBank = await Question.find({
        id: { $in: questionBankIds },
        status: 'archived'
      }).select('id question').lean();

      if (archivedInBank.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot publish quiz containing archived question: "${archivedInBank[0].question}" (ID: ${archivedInBank[0].id}).`
        });
      }
    }

    // 4. Mark published
    quiz.isPublished = true;
    quiz.isArchived = false;
    quiz.updatedBy = req.adminUser._id;
    await quiz.save();

    await recordAudit(req, 'QUIZ_PUBLISH', 'Quiz', quiz._id, {
      id: quiz.id,
      questionCount: quiz.questions.length
    });

    res.status(200).json({
      success: true,
      message: 'Quiz validated and published successfully.',
      data: formatQuiz(quiz)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/quizzes/:id/unpublish
 * Unpublish a quiz so learners cannot view or start it.
 */
export const unpublishAdminQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      $or: [
        { id: id.toLowerCase().trim() },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const quiz = await Quiz.findOne(query);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    quiz.isPublished = false;
    quiz.updatedBy = req.adminUser._id;
    await quiz.save();

    await recordAudit(req, 'QUIZ_UNPUBLISH', 'Quiz', quiz._id, { id: quiz.id });

    res.status(200).json({
      success: true,
      message: 'Quiz unpublished successfully.',
      data: formatQuiz(quiz)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/quizzes/:id/archive
 * Safe archive of a quiz without deleting historical attempts.
 */
export const archiveAdminQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = {
      $or: [
        { id: id.toLowerCase().trim() },
        ...(mongoose.Types.ObjectId.isValid(id) ? [{ _id: new mongoose.Types.ObjectId(id) }] : [])
      ]
    };

    const quiz = await Quiz.findOne(query);

    if (!quiz) {
      return res.status(404).json({ success: false, message: 'Quiz not found.' });
    }

    quiz.isArchived = true;
    quiz.isPublished = false;
    quiz.updatedBy = req.adminUser._id;
    await quiz.save();

    await recordAudit(req, 'QUIZ_ARCHIVE', 'Quiz', quiz._id, { id: quiz.id });

    res.status(200).json({
      success: true,
      message: 'Quiz archived successfully. Historical attempts remain preserved.',
      data: formatQuiz(quiz)
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// SECTION 3: OVERVIEW & AUDIT LOGS
// =========================================================================

/**
 * GET /api/admin/overview
 * Return administrative summary metrics.
 */
export const getAdminOverview = async (req, res, next) => {
  try {
    const [
      totalQuestions,
      activeQuestions,
      draftQuestions,
      archivedQuestions,
      totalQuizzes,
      publishedQuizzes,
      draftQuizzes,
      archivedQuizzes,
      totalAttempts,
      passedAttempts,
      totalUsers,
      totalAdmins,
      recentAuditLogs
    ] = await Promise.all([
      Question.countDocuments(),
      Question.countDocuments({ status: 'active' }),
      Question.countDocuments({ status: 'draft' }),
      Question.countDocuments({ status: 'archived' }),
      Quiz.countDocuments(),
      Quiz.countDocuments({ isPublished: true, isArchived: { $ne: true } }),
      Quiz.countDocuments({ isPublished: false, isArchived: { $ne: true } }),
      Quiz.countDocuments({ isArchived: true }),
      QuizAttempt.countDocuments(),
      QuizAttempt.countDocuments({ isPassed: true }),
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      AuditLog.find().sort({ timestamp: -1 }).limit(10).lean()
    ]);

    const formattedLogs = recentAuditLogs.map(formatAuditLog);

    res.status(200).json({
      success: true,
      data: {
        questions: {
          total: totalQuestions,
          active: activeQuestions,
          draft: draftQuestions,
          archived: archivedQuestions
        },
        quizzes: {
          total: totalQuizzes,
          published: publishedQuizzes,
          draft: draftQuizzes,
          archived: archivedQuizzes
        },
        attempts: {
          total: totalAttempts,
          passed: passedAttempts
        },
        users: {
          total: totalUsers,
          learners: Math.max(0, totalUsers - totalAdmins),
          admins: totalAdmins
        },
        recentAuditLogs: formattedLogs,
        // Backward-compatible flat metrics
        totalQuestions,
        activeQuestions,
        archivedQuestions,
        totalQuizzes,
        publishedQuizzes,
        draftQuizzes,
        archivedQuizzes,
        totalAttempts
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/audit-logs
 * Retrieve bounded paginated administrative audit logs.
 */
export const getAdminAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, entity, entityType, search } = req.query;

    const query = {};
    if (action && action !== 'All') {
      query.action = action.trim();
    }
    const targetEntity = entity || entityType;
    if (targetEntity && targetEntity !== 'All') {
      query.entityType = targetEntity.trim();
    }
    if (search && search.trim()) {
      const regex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [{ actorEmail: regex }, { entityId: regex }, { action: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    const formatted = logs.map(formatAuditLog);

    res.status(200).json({
      success: true,
      data: {
        logs: formatted,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || 1
        }
      },
      logs: formatted,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (error) {
    next(error);
  }
};

import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import ProblemAttempt from '../models/ProblemAttempt.js';
import Progress from '../models/Progress.js';

/**
 * Escapes regex special characters to prevent regex injection attacks.
 * @param {string} str
 * @returns {string}
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Evaluates a submitted answer/code against the problem's expected answer or primary output.
 * Supports exact text, trimmed whitespace, normalized whitespace, JSON equality, and substring matching.
 * @param {string} submitted
 * @param {string} expected
 * @param {string} [exampleOutput]
 * @returns {boolean}
 */
const evaluateAnswer = (submitted, expected, exampleOutput) => {
  if (!submitted || typeof submitted !== 'string') return false;

  const cleanSub = submitted.trim();
  if (cleanSub.length === 0) return false;

  const targets = [expected, exampleOutput].filter((t) => typeof t === 'string' && t.trim().length > 0);
  if (targets.length === 0) return true; // If no expected answer is configured, accept non-empty submission

  for (const target of targets) {
    const cleanExp = target.trim();

    // 1. Exact match (case-sensitive or case-insensitive)
    if (cleanSub === cleanExp || cleanSub.toLowerCase() === cleanExp.toLowerCase()) {
      return true;
    }

    // 2. Whitespace-removed match (e.g. "[0, 1]" vs "[0,1]")
    const noSpaceSub = cleanSub.replace(/\s+/g, '');
    const noSpaceExp = cleanExp.replace(/\s+/g, '');
    if (noSpaceSub === noSpaceExp || noSpaceSub.toLowerCase() === noSpaceExp.toLowerCase()) {
      return true;
    }

    // 3. JSON parsed deep comparison
    try {
      const jsonSub = JSON.parse(cleanSub);
      const jsonExp = JSON.parse(cleanExp);
      if (JSON.stringify(jsonSub) === JSON.stringify(jsonExp)) {
        return true;
      }
    } catch {
      // not JSON
    }

    // 4. Substring inclusion if submission contains expected output
    if (cleanSub.includes(cleanExp) || noSpaceSub.includes(noSpaceExp)) {
      return true;
    }
  }

  return false;
};

/**
 * Helper to resolve a problem document by ObjectId, slug, or id.
 * @param {string} idParam
 * @param {boolean} [includeExpected=false]
 */
const findProblemByIdOrSlug = async (idParam, includeExpected = false) => {
  if (!idParam) return null;

  let query = Problem.findOne({
    $or: [
      { slug: idParam },
      { id: idParam },
      ...(mongoose.Types.ObjectId.isValid(idParam) ? [{ _id: new mongoose.Types.ObjectId(idParam) }] : [])
    ]
  });

  if (includeExpected) {
    query = query.select('+expectedAnswer');
  } else {
    query = query.select('-expectedAnswer');
  }

  return query;
};

/**
 * GET /api/problems
 * Public endpoint.
 * Retrieves available practice problems with optional filtering, search, and pagination.
 * Excludes expectedAnswer.
 */
export const getProblems = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const query = {};

    // 1. Language Filter
    if (req.query.language && req.query.language !== 'All') {
      query.language = new RegExp(`^${escapeRegex(req.query.language.trim())}$`, 'i');
    }

    // 2. Difficulty Filter
    if (req.query.difficulty && req.query.difficulty !== 'All') {
      query.difficulty = new RegExp(`^${escapeRegex(req.query.difficulty.trim())}$`, 'i');
    }

    // 3. Topic(s) Filter
    if (req.query.topic && req.query.topic !== 'All') {
      const topicList = req.query.topic
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (topicList.length > 0) {
        query.$or = [
          { topic: { $in: topicList.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')) } },
          { topics: { $in: topicList.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')) } }
        ];
      }
    }

    // 4. Search Filter (matches title, description, topic, topics, language)
    if (req.query.search && req.query.search.trim()) {
      const searchRegex = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { topic: searchRegex },
        { topics: searchRegex },
        { language: searchRegex }
      ];
    }

    const [problems, total] = await Promise.all([
      Problem.find(query)
        .select('-expectedAnswer')
        .sort({ createdAt: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Problem.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const sanitizedProblems = problems.map((prob) => {
      if (Array.isArray(prob.testCases)) {
        return {
          ...prob,
          testCases: prob.testCases.filter((tc) => !tc.isHidden)
        };
      }
      return prob;
    });

    res.status(200).json({
      success: true,
      count: sanitizedProblems.length,
      problems: sanitizedProblems,
      data: sanitizedProblems,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/problems/:id
 * Public endpoint.
 * Retrieves a single problem by ObjectId or slug/id.
 * Excludes expectedAnswer and hidden testCases.
 */
export const getProblemById = async (req, res, next) => {
  try {
    const lookupKey = req.params.slug || req.params.id;
    const problem = await findProblemByIdOrSlug(lookupKey, false);

    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    const problemObj = problem.toObject ? problem.toObject() : { ...problem };
    if (Array.isArray(problemObj.testCases)) {
      problemObj.testCases = problemObj.testCases.filter((tc) => !tc.isHidden);
    }

    res.status(200).json({
      success: true,
      problem: problemObj,
      data: problemObj
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/problems/:id/submit
 * Authenticated endpoint (requires JWT).
 * Evaluates answer submission against stored expectedAnswer.
 * Records ProblemAttempt document associated strictly with req.user.id.
 */
export const submitProblem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    // Validate submission payload
    if (answer === undefined || answer === null || typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Answer is required and cannot be empty.'
      });
    }

    if (answer.length > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Answer exceeds maximum allowed length of 50,000 characters.'
      });
    }

    // Load problem including expectedAnswer for server evaluation
    const problem = await findProblemByIdOrSlug(id, true);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    const exampleOutput = problem.examples && problem.examples.length > 0 ? problem.examples[0].output : '';
    const isCorrect = evaluateAnswer(answer, problem.expectedAnswer, exampleOutput);
    const status = isCorrect ? 'Accepted' : 'Incorrect';

    // Persist attempt in MongoDB
    await ProblemAttempt.create({
      user: req.user.id,
      problem: problem._id,
      status,
      submittedAnswer: answer,
      executionTime: Math.floor(Math.random() * 40) + 12
    });

    // If accepted, also synchronize legacy Progress document for seamless milestone continuity
    if (isCorrect) {
      const slugId = problem.slug || problem.id;
      let userProgress = await Progress.findOne({ user: req.user.id });
      if (!userProgress) {
        userProgress = new Progress({ user: req.user.id, completedProblems: [], quizAttempts: [] });
      }
      if (!userProgress.completedProblems.some((p) => p.problemId === slugId)) {
        userProgress.completedProblems.push({
          problemId: slugId,
          completedAt: new Date()
        });
        await userProgress.save();
      }
    }

    return res.status(200).json({
      success: true,
      result: {
        status,
        correct: isCorrect
      },
      explanation: isCorrect ? problem.explanation : undefined
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/problems/progress/me
 * Authenticated endpoint (requires JWT).
 * Retrieves the authenticated user's practice problem progress metrics and itemized attempts.
 */
export const getMyProblemProgress = async (req, res, next) => {
  try {
    const attempts = await ProblemAttempt.find({ user: req.user.id })
      .populate('problem', 'title slug id difficulty topic topics')
      .sort({ createdAt: -1 })
      .lean();

    // Group attempts by problem
    const grouped = {};
    for (const att of attempts) {
      if (!att.problem) continue;
      const probKey = att.problem._id.toString();

      if (!grouped[probKey]) {
        grouped[probKey] = {
          problemId: att.problem.slug || att.problem.id || probKey,
          title: att.problem.title,
          difficulty: att.problem.difficulty,
          topic: att.problem.topic,
          status: att.status,
          attemptCount: 0,
          lastAttemptAt: att.createdAt
        };
      }

      grouped[probKey].attemptCount += 1;
      // If any attempt is Accepted, overall problem status is Accepted
      if (att.status === 'Accepted') {
        grouped[probKey].status = 'Accepted';
      }
    }

    const byProblem = Object.values(grouped);
    const solved = byProblem.filter((p) => p.status === 'Accepted').length;
    const incorrect = byProblem.filter((p) => p.status !== 'Accepted').length;
    const totalAttempted = byProblem.length;

    return res.status(200).json({
      success: true,
      progress: {
        totalAttempted,
        solved,
        incorrect,
        totalAttempts: attempts.length,
        byProblem
      }
    });
  } catch (error) {
    next(error);
  }
};

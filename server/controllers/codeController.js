import mongoose from 'mongoose';
import Problem from '../models/Problem.js';
import Submission from '../models/Submission.js';
import ProblemProgress from '../models/ProblemProgress.js';
import {
  isSandboxAvailableAsync,
  runInSandbox,
  compareOutputs,
  validateCodePayload,
  DOCKER_SETUP_GUIDE
} from '../services/codeExecutionService.js';
import { normalizeLanguageId } from '../config/languages.js';

/**
 * Resolves a Problem document by ObjectId or slug.
 * @param {string} idParam
 */
const findProblem = async (idParam) => {
  if (!idParam) return null;

  return Problem.findOne({
    $or: [
      { slug: idParam },
      { id: idParam },
      ...(mongoose.Types.ObjectId.isValid(idParam)
        ? [{ _id: new mongoose.Types.ObjectId(idParam) }]
        : [])
    ]
  });
};

/**
 * GET /api/code/status
 * Public endpoint.
 * Returns current Docker sandbox availability and setup guide.
 */
export const getSandboxStatus = async (req, res) => {
  const available = await isSandboxAvailableAsync();
  return res.status(200).json({
    success: true,
    sandboxAvailable: available,
    engine: available ? 'docker' : null,
    setupGuide: available ? null : DOCKER_SETUP_GUIDE
  });
};

/**
 * POST /api/code/run
 * Runs source code against an optional custom input.
 * Supports public and authenticated execution.
 */
export const runCode = async (req, res, next) => {
  try {
    const { language = 'javascript', sourceCode, problemId, customInput = '' } = req.body;
    const canonicalLang = normalizeLanguageId(language) || 'javascript';

    // 1. Validate payload
    validateCodePayload(language, sourceCode);

    // 2. Resolve problem if specified
    let problem = null;
    if (problemId) {
      problem = await findProblem(problemId);
      if (!problem) {
        return res.status(404).json({
          success: false,
          message: 'Problem not found.'
        });
      }
    }

    // 3. Check sandbox availability
    const sandboxReady = await isSandboxAvailableAsync();
    if (!sandboxReady) {
      return res.status(503).json({
        success: false,
        sandboxAvailable: false,
        status: 'SANDBOX_UNAVAILABLE',
        verdict: 'Sandbox Unavailable',
        message: 'Secure Docker execution sandbox is unavailable. Host execution disabled.',
        setupGuide: DOCKER_SETUP_GUIDE
      });
    }

    // 4. If problem has visible test cases and customInput was not explicitly provided:
    // Evaluate sample/visible test cases with honest result semantics
    const visibleTestCases = problem ? (problem.testCases || []).filter((tc) => !tc.isHidden) : [];

    if (problem && visibleTestCases.length > 0 && !customInput) {
      let passedTests = 0;
      let totalDuration = 0;
      let overallVerdict = 'Passed';
      let overallStatus = 'PASSED';
      const testResults = [];

      for (let i = 0; i < visibleTestCases.length; i++) {
        const tc = visibleTestCases[i];
        const result = await runInSandbox(sourceCode, tc.input, canonicalLang, {
          problemSlug: problem?.slug,
          problemId: problem?.id
        });
        totalDuration += result.executionDuration || 0;

        if (result.status === 'CONCURRENCY_LIMIT_EXCEEDED') {
          return res.status(429).json({
            success: false,
            sandboxAvailable: true,
            status: result.status,
            verdict: result.verdict,
            message: result.stderr
          });
        }

        if (result.status === 'COMPILATION_ERROR') {
          overallVerdict = 'Compilation Error';
          overallStatus = 'COMPILATION_ERROR';
          testResults.push({
            testIndex: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: result.stdout || '',
            error: result.stderr || 'Compilation error occurred.'
          });
          break;
        }

        if (result.status === 'OUTPUT_LIMIT_EXCEEDED') {
          overallVerdict = 'Output Limit Exceeded';
          overallStatus = 'OUTPUT_LIMIT_EXCEEDED';
          testResults.push({
            testIndex: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: result.stdout || '',
            error: result.stderr || 'Output limit exceeded.'
          });
          break;
        }

        if (result.status === 'TIME_LIMIT_EXCEEDED') {
          overallVerdict = 'Time Limit Exceeded';
          overallStatus = 'TIME_LIMIT_EXCEEDED';
          testResults.push({
            testIndex: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: 'Time Limit Exceeded (5000ms)',
            error: result.stderr || 'Execution timed out.'
          });
          break;
        }

        if (result.status === 'RUNTIME_ERROR') {
          overallVerdict = 'Runtime Error';
          overallStatus = 'RUNTIME_ERROR';
          testResults.push({
            testIndex: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: result.stdout || '',
            error: result.stderr || 'Runtime error occurred.'
          });
          break;
        }

        const passed = compareOutputs(result.stdout, tc.expectedOutput);
        if (passed) {
          passedTests++;
        } else {
          if (overallVerdict === 'Passed') {
            overallVerdict = 'Failed';
            overallStatus = 'FAILED';
          }
        }

        testResults.push({
          testIndex: i + 1,
          passed,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: (result.stdout || '').trim(),
          error: result.stderr ? result.stderr.trim() : undefined
        });
      }

      return res.status(200).json({
        success: true,
        sandboxAvailable: true,
        status: overallStatus,
        verdict: overallVerdict,
        passedTests,
        totalTests: visibleTestCases.length,
        executionDuration: totalDuration,
        results: testResults,
        stdout: testResults[0]?.actualOutput || '',
        stderr: testResults.find((t) => t.error)?.error || ''
      });
    }

    // 5. Raw execution against customInput (or problem without test cases)
    const result = await runInSandbox(sourceCode, customInput, canonicalLang, {
      problemSlug: problem?.slug,
      problemId: problem?.id
    });

    if (result.status === 'CONCURRENCY_LIMIT_EXCEEDED') {
      return res.status(429).json({
        success: false,
        sandboxAvailable: true,
        status: result.status,
        verdict: result.verdict,
        message: result.stderr
      });
    }

    return res.status(200).json({
      success: true,
      sandboxAvailable: true,
      status: result.status,
      verdict: result.status === 'SUCCESS' ? 'Executed' : result.verdict,
      passedTests: 0,
      totalTests: 0,
      results: [],
      stdout: result.stdout,
      stderr: result.stderr,
      executionDuration: result.executionDuration
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    return next(error);
  }
};

/**
 * POST /api/code/submit
 * Authenticated endpoint (requires JWT).
 * Evaluates solution against test cases, creates Submission record,
 * and updates user problem completion progress if Accepted.
 */
export const submitCode = async (req, res, next) => {
  try {
    const { problemId, language = 'javascript', sourceCode } = req.body;
    const canonicalLang = normalizeLanguageId(language) || 'javascript';

    // 1. Validate code payload
    validateCodePayload(language, sourceCode);

    // 2. Resolve problem
    if (!problemId) {
      return res.status(400).json({
        success: false,
        message: 'Problem identifier is required.'
      });
    }

    const problem = await findProblem(problemId);
    if (!problem) {
      return res.status(404).json({
        success: false,
        message: 'Problem not found.'
      });
    }

    const testCases = problem.testCases || [];
    const totalTests = testCases.length > 0 ? testCases.length : 1;

    // 3. Check sandbox availability
    const sandboxReady = await isSandboxAvailableAsync();
    if (!sandboxReady) {
      // Record a submission reflecting sandbox status
      const submission = await Submission.create({
        user: req.user.id,
        problem: problem._id,
        language: canonicalLang,
        sourceCode,
        verdict: 'Sandbox Unavailable',
        passedTests: 0,
        totalTests,
        executionDuration: 0,
        stderr: 'Docker sandbox was unavailable at submission time.'
      });

      return res.status(503).json({
        success: false,
        sandboxAvailable: false,
        status: 'SANDBOX_UNAVAILABLE',
        verdict: 'Sandbox Unavailable',
        message: 'Secure Docker execution sandbox is unavailable. Host execution disabled.',
        setupGuide: DOCKER_SETUP_GUIDE,
        submission
      });
    }

    // 4. Sandbox is available -> execute test cases
    let passedTests = 0;
    let totalDuration = 0;
    let overallVerdict = 'Accepted';
    const testResults = [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      const result = await runInSandbox(sourceCode, tc.input, canonicalLang, {
        problemSlug: problem?.slug,
        problemId: problem?.id
      });
      totalDuration += result.executionDuration || 0;

      if (result.status === 'CONCURRENCY_LIMIT_EXCEEDED') {
        return res.status(429).json({
          success: false,
          sandboxAvailable: true,
          status: result.status,
          verdict: result.verdict,
          message: result.stderr
        });
      }

      if (result.status === 'OUTPUT_LIMIT_EXCEEDED') {
        overallVerdict = 'Output Limit Exceeded';
        if (!tc.isHidden) {
          testResults.push({
            testIndex: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: result.stdout,
            error: result.stderr
          });
        }
        break;
      }

      if (result.status === 'TIME_LIMIT_EXCEEDED') {
        overallVerdict = 'Time Limit Exceeded';
        if (!tc.isHidden) {
          testResults.push({
            testIndex: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: 'Time Limit Exceeded (5000ms)',
            error: result.stderr
          });
        }
        break;
      }

      if (result.status === 'COMPILATION_ERROR') {
        overallVerdict = 'Compilation Error';
        if (!tc.isHidden) {
          testResults.push({
            testIndex: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: result.stdout || '',
            error: result.stderr || 'Compilation error occurred.'
          });
        }
        break;
      }

      if (result.status === 'RUNTIME_ERROR') {
        overallVerdict = 'Runtime Error';
        if (!tc.isHidden) {
          testResults.push({
            testIndex: i + 1,
            passed: false,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: result.stdout,
            error: result.stderr
          });
        }
        break;
      }

      const passed = compareOutputs(result.stdout, tc.expectedOutput);
      if (passed) {
        passedTests++;
      } else {
        if (overallVerdict === 'Accepted') {
          overallVerdict = 'Wrong Answer';
        }
      }

      // Do NOT leak hidden test details to client
      if (!tc.isHidden) {
        testResults.push({
          testIndex: i + 1,
          passed,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: result.stdout.trim()
        });
      }
    }

    // 5. Persist submission document
    const submission = await Submission.create({
      user: req.user.id,
      problem: problem._id,
      language: canonicalLang,
      sourceCode,
      verdict: overallVerdict,
      passedTests,
      totalTests,
      executionDuration: totalDuration,
      stdout: testResults[0]?.actualOutput || '',
      stderr: testResults[0]?.error || ''
    });

    // 6. If Accepted, update user ProblemProgress
    if (overallVerdict === 'Accepted') {
      await ProblemProgress.findOneAndUpdate(
        { user: req.user.id, problem: problem._id },
        {
          $set: {
            completed: true,
            completedAt: new Date()
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    return res.status(200).json({
      success: true,
      sandboxAvailable: true,
      verdict: overallVerdict,
      passedTests,
      totalTests,
      executionDuration: totalDuration,
      results: testResults,
      submission
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    return next(error);
  }
};

/**
 * GET /api/code/submissions
 * Authenticated endpoint (requires JWT).
 * Retrieves submission history strictly belonging to req.user.id.
 */
export const getSubmissions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { user: req.user.id };

    if (req.query.problemId) {
      const problem = await findProblem(req.query.problemId);
      if (problem) {
        query.problem = problem._id;
      } else {
        return res.status(200).json({
          success: true,
          count: 0,
          submissions: [],
          pagination: { page, limit, total: 0, totalPages: 0 }
        });
      }
    }

    const [submissions, total] = await Promise.all([
      Submission.find(query)
        .populate('problem', 'title slug difficulty topic')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Submission.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    return next(error);
  }
};

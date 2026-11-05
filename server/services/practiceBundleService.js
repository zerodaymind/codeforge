import crypto from 'crypto';
import Problem from '../models/Problem.js';
import Quiz from '../models/Quiz.js';
import Submission from '../models/Submission.js';
import QuizAttempt from '../models/QuizAttempt.js';
import PracticeBundle from '../models/PracticeBundle.js';
import { getLearnerIntelligence, LEARNING_STATE } from './learningIntelligenceService.js';
import { evaluatePrerequisiteReadiness } from './prerequisiteGraph.js';
import { normalizeTopicName, slugify } from './roadmapPlanner.js';

/**
 * ==============================================================================
 * Targeted Practice Bundle Service (Milestone 16B)
 *
 * Assembles focused 3-5 item practice sessions based on evidence gaps,
 * prerequisite dependencies, and catalog availability.
 *
 * GUARANTEES:
 * 1. Uses genuine catalog items from MongoDB Problem & Quiz collections.
 * 2. Never fabricates slugs or quiz IDs.
 * 3. Enforces verified completion semantics: only Accepted submissions or passed quizzes count.
 * 4. Prevents duplicate items within the same bundle.
 * 5. Returns explicit insufficient-content results when catalog cannot support a bundle.
 * ==============================================================================
 */

export const BUNDLE_ITEM_ROLE = {
  PREREQUISITE_REVIEW: 'prerequisite_review',
  CONCEPT_REVIEW: 'concept_review',
  CORE_PRACTICE: 'core_practice',
  STRETCH_CHALLENGE: 'stretch_challenge'
};

export const BUNDLE_STATUS = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned'
};

/**
 * Generates or retrieves an active targeted practice bundle for a learner.
 *
 * @param {string} userId - Authenticated user ID
 * @param {Object} [options={}]
 * @param {string} [options.topic] - Target topic (if omitted, picks highest priority gap)
 * @param {boolean} [options.forceNew=false] - If true, archives active bundle and creates fresh one
 * @returns {Promise<Object>} Practice bundle response
 */
export async function getOrCreatePracticeBundle(userId, options = {}) {
  const { topic, targetTopic: rawTargetTopic, forceNew = false } = options;

  // 1. Fetch Learner Intelligence Model
  const intelligence = await getLearnerIntelligence(userId);
  const { topicStates, overview } = intelligence;

  // Determine target topic
  let targetTopic = (topic || rawTargetTopic) ? normalizeTopicName(topic || rawTargetTopic) : null;
  if (!targetTopic) {
    // Pick first topic needing attention, or first in topological states
    if (overview.topicsNeedingAttention && overview.topicsNeedingAttention.length > 0) {
      targetTopic = overview.topicsNeedingAttention[0];
    } else {
      targetTopic = topicStates[0]?.topic || 'Arrays';
    }
  }

  // 2. Check for an existing active bundle for this topic
  if (!forceNew) {
    const existingBundle = await PracticeBundle.findOne({
      user: userId,
      targetTopic,
      status: 'active'
    }).lean();

    if (existingBundle) {
      // Re-evaluate live completion status of bundle items against user's verified records
      const refreshedBundle = await refreshBundleCompletionState(userId, existingBundle);
      return {
        success: true,
        hasBundle: true,
        bundle: refreshedBundle
      };
    }
  } else {
    // Mark existing active bundles for this topic as abandoned before creating fresh one
    await PracticeBundle.updateMany(
      { user: userId, targetTopic, status: 'active' },
      { $set: { status: 'abandoned' } }
    );
  }

  // 3. Evaluate Prerequisite Readiness for the Target Topic
  const readiness = evaluatePrerequisiteReadiness(targetTopic, topicStates);

  // 4. Fetch User's Solved Problems & Passed Quizzes
  const [userSubmissions, userQuizAttempts] = await Promise.all([
    Submission.find({ user: userId, verdict: 'Accepted' })
      .populate('problem', 'slug')
      .lean(),
    QuizAttempt.find({ user: userId, isPassed: true, status: { $in: ['submitted', 'completed'] } })
      .select('quizId')
      .lean()
  ]);

  const solvedSlugs = new Set(
    userSubmissions
      .filter((s) => s.problem?.slug)
      .map((s) => s.problem.slug)
  );

  const passedQuizIds = new Set(
    userQuizAttempts
      .filter((q) => q.quizId)
      .map((q) => q.quizId)
  );

  // 5. Query Real Catalog Items for Target Topic and Prerequisite Topics
  const topicStateInfo = topicStates.find((t) => t.topic === targetTopic);
  const currentState = topicStateInfo?.state || LEARNING_STATE.UNASSESSED;

  // Fetch candidate problems from database matching topic or topics array
  const candidateProblems = await Problem.find({
    $or: [
      { topic: targetTopic },
      { topics: targetTopic }
    ]
  })
    .select('title slug difficulty topic topics')
    .lean();

  const candidateQuizzes = await Quiz.find({
    $or: [
      { topic: targetTopic },
      { id: slugify(targetTopic) }
    ]
  })
    .select('id title difficulty topic')
    .lean();

  // If candidate items are insufficient (< 2 items and no quiz), check fallback
  if (candidateProblems.length === 0 && candidateQuizzes.length === 0) {
    return {
      success: true,
      hasBundle: false,
      reason: 'insufficient_content',
      message: `The catalog currently does not have sufficient practice problems or quizzes for '${targetTopic}'.`
    };
  }

  // 6. Assemble Curated Bundle Items
  const bundleItems = [];
  const selectedIdentifiers = new Set();

  function addItem(item) {
    if (!item || selectedIdentifiers.has(item.identifier)) return false;
    selectedIdentifiers.add(item.identifier);
    bundleItems.push(item);
    return true;
  }

  // (a) Slot 1: Prerequisite Review (If an unmet prerequisite exists)
  if (!readiness.isReady && readiness.unmetPrerequisites.length > 0) {
    const unmetPrereq = readiness.unmetPrerequisites[0];
    // Find problem or quiz for this prerequisite topic
    const prereqProblems = await Problem.find({
      $or: [{ topic: unmetPrereq.topic }, { topics: unmetPrereq.topic }]
    })
      .select('title slug difficulty')
      .lean();

    const prereqQuizzes = await Quiz.find({ topic: unmetPrereq.topic })
      .select('id title difficulty')
      .lean();

    // Prefer unsolved problem or quiz
    const unsolvedPrereqProb = prereqProblems.find((p) => !solvedSlugs.has(p.slug));
    const prereqQuiz = prereqQuizzes[0];

    if (unsolvedPrereqProb) {
      addItem({
        id: `item-${bundleItems.length + 1}`,
        type: 'problem',
        identifier: unsolvedPrereqProb.slug,
        title: `${unmetPrereq.topic}: ${unsolvedPrereqProb.title}`,
        difficulty: unsolvedPrereqProb.difficulty,
        role: BUNDLE_ITEM_ROLE.PREREQUISITE_REVIEW,
        selectionReason: `Prerequisite review: solidifying foundational patterns in ${unmetPrereq.topic} before advancing in ${targetTopic}.`,
        url: `/practice/${unsolvedPrereqProb.slug}`,
        isCompleted: false,
        completedAt: null
      });
    } else if (prereqQuiz) {
      addItem({
        id: `item-${bundleItems.length + 1}`,
        type: 'quiz',
        identifier: prereqQuiz.id,
        title: `${unmetPrereq.topic}: ${prereqQuiz.title}`,
        difficulty: prereqQuiz.difficulty,
        role: BUNDLE_ITEM_ROLE.PREREQUISITE_REVIEW,
        selectionReason: `Prerequisite benchmark: review core concepts in ${unmetPrereq.topic} prior to tackling ${targetTopic}.`,
        url: `/quiz?quizId=${prereqQuiz.id}`,
        isCompleted: passedQuizIds.has(prereqQuiz.id),
        completedAt: null
      });
    }
  }

  // (b) Slot 2: Concept Review (For struggling or unassessed learners)
  if (currentState === LEARNING_STATE.STRUGGLING || currentState === LEARNING_STATE.INSUFFICIENT_EVIDENCE) {
    // If a quiz exists for this topic, include it for conceptual grounding
    const quizCandidate = candidateQuizzes[0];
    if (quizCandidate && !passedQuizIds.has(quizCandidate.id)) {
      addItem({
        id: `item-${bundleItems.length + 1}`,
        type: 'quiz',
        identifier: quizCandidate.id,
        title: quizCandidate.title,
        difficulty: quizCandidate.difficulty,
        role: BUNDLE_ITEM_ROLE.CONCEPT_REVIEW,
        selectionReason: `Focused knowledge review: refresh foundational principles and syntax for ${targetTopic}.`,
        url: `/quiz?quizId=${quizCandidate.id}`,
        isCompleted: false,
        completedAt: null
      });
    } else {
      // Find an easy problem
      const easyProblem = candidateProblems.find((p) => p.difficulty === 'Easy' && !solvedSlugs.has(p.slug)) ||
                          candidateProblems.find((p) => p.difficulty === 'Easy');
      if (easyProblem) {
        addItem({
          id: `item-${bundleItems.length + 1}`,
          type: 'problem',
          identifier: easyProblem.slug,
          title: easyProblem.title,
          difficulty: easyProblem.difficulty,
          role: BUNDLE_ITEM_ROLE.CONCEPT_REVIEW,
          selectionReason: `Foundational drill: re-establish problem-solving baseline with an approachable exercise.`,
          url: `/practice/${easyProblem.slug}`,
          isCompleted: solvedSlugs.has(easyProblem.slug),
          completedAt: null
        });
      }
    }
  }

  // (c) Core Practice Problems (Medium or unsolved challenges)
  const unsolvedCore = candidateProblems.filter(
    (p) => !solvedSlugs.has(p.slug) && (p.difficulty === 'Medium' || p.difficulty === 'Easy')
  );

  for (const prob of unsolvedCore) {
    if (bundleItems.length >= 4) break;
    addItem({
      id: `item-${bundleItems.length + 1}`,
      type: 'problem',
      identifier: prob.slug,
      title: prob.title,
      difficulty: prob.difficulty,
      role: BUNDLE_ITEM_ROLE.CORE_PRACTICE,
      selectionReason: `Targeted practice: apply your active understanding of ${targetTopic} to solve a structured problem.`,
      url: `/practice/${prob.slug}`,
      isCompleted: false,
      completedAt: null
    });
  }

  // (d) Stretch Challenge (For developing, proficient, or mastered states)
  if (bundleItems.length < 5 && (currentState === LEARNING_STATE.DEVELOPING || currentState === LEARNING_STATE.PROFICIENT || currentState === LEARNING_STATE.MASTERED)) {
    const hardOrMed = candidateProblems.find((p) => p.difficulty === 'Hard' && !solvedSlugs.has(p.slug)) ||
                      candidateProblems.find((p) => p.difficulty === 'Medium' && !selectedIdentifiers.has(p.slug));
    if (hardOrMed) {
      addItem({
        id: `item-${bundleItems.length + 1}`,
        type: 'problem',
        identifier: hardOrMed.slug,
        title: hardOrMed.title,
        difficulty: hardOrMed.difficulty,
        role: BUNDLE_ITEM_ROLE.STRETCH_CHALLENGE,
        selectionReason: `Challenge progression: expand your algorithmic depth with a higher-complexity challenge.`,
        url: `/practice/${hardOrMed.slug}`,
        isCompleted: solvedSlugs.has(hardOrMed.slug),
        completedAt: null
      });
    }
  }

  // Fill up to at least 2 items if needed using any available catalog problems
  if (bundleItems.length < 2) {
    for (const prob of candidateProblems) {
      if (bundleItems.length >= 3) break;
      addItem({
        id: `item-${bundleItems.length + 1}`,
        type: 'problem',
        identifier: prob.slug,
        title: prob.title,
        difficulty: prob.difficulty,
        role: BUNDLE_ITEM_ROLE.CORE_PRACTICE,
        selectionReason: `Reinforcement exercise in ${targetTopic}.`,
        url: `/practice/${prob.slug}`,
        isCompleted: solvedSlugs.has(prob.slug),
        completedAt: null
      });
    }
  }

  if (bundleItems.length === 0) {
    return {
      success: true,
      hasBundle: false,
      reason: 'insufficient_content',
      insufficientContentDisclosure: `Unable to assemble practice bundle for '${targetTopic}' due to insufficient catalog entries.`,
      message: `Unable to assemble practice bundle for '${targetTopic}' due to insufficient catalog entries.`
    };
  }

  // 7. Persist Bundle Document in MongoDB
  const bundleId = `bundle-${slugify(targetTopic)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const headline = readiness.isReady
    ? `Targeted Practice: ${targetTopic} Pathway`
    : `Remediation & Practice: ${targetTopic} (Prerequisite Gaps Noted)`;

  const insufficientContentDisclosure = bundleItems.length < 3
    ? `Target topic '${targetTopic}' currently has limited catalog items (${bundleItems.length} available). Bundle includes all available items.`
    : null;

  const bundleDoc = await PracticeBundle.create({
    user: userId,
    bundleId,
    targetTopic,
    headline,
    targetState: currentState,
    prerequisiteNotes: readiness.guidance,
    items: bundleItems,
    status: 'active',
    estimatedMinutes: bundleItems.length * 15
  });

  return {
    success: true,
    hasBundle: true,
    bundle: bundleDoc.toObject(),
    insufficientContentDisclosure
  };
}

/**
 * Re-evaluates live completion status of items within a bundle document.
 *
 * @param {string} userId - Authenticated user ID
 * @param {Object} bundle - PracticeBundle lean object
 * @returns {Promise<Object>} Updated bundle object with live completion flags
 */
export async function refreshBundleCompletionState(arg1, arg2) {
  let userId;
  let bundle;

  if (typeof arg1 === 'object' && arg1 !== null && arg1.items) {
    bundle = arg1;
    userId = arg2 || bundle.user;
  } else if (typeof arg2 === 'object' && arg2 !== null && arg2.items) {
    bundle = arg2;
    userId = arg1;
  } else {
    // One argument is bundleId, the other is userId
    const bundleDoc = await PracticeBundle.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(arg1) ? arg1 : null },
        { bundleId: arg1 },
        { _id: mongoose.isValidObjectId(arg2) ? arg2 : null },
        { bundleId: arg2 }
      ]
    }).lean();

    if (bundleDoc) {
      bundle = bundleDoc;
      userId = bundleDoc.user ? bundleDoc.user.toString() : (arg1 === bundleDoc._id.toString() || arg1 === bundleDoc.bundleId ? arg2 : arg1);
    }
  }

  if (!bundle || !Array.isArray(bundle.items)) return bundle;

  const problemSlugs = bundle.items.filter((i) => i.type === 'problem').map((i) => i.identifier);
  const quizIds = bundle.items.filter((i) => i.type === 'quiz').map((i) => i.identifier);

  const [submissions, quizAttempts] = await Promise.all([
    Problem.find({ slug: { $in: problemSlugs } })
      .select('_id slug')
      .lean()
      .then((probs) => {
        const pMap = new Map(probs.map((p) => [p._id.toString(), p.slug]));
        return Submission.find({
          user: userId,
          problem: { $in: probs.map((p) => p._id) },
          verdict: 'Accepted'
        })
          .select('problem createdAt')
          .lean()
          .then((subs) => {
            const solvedMap = new Map();
            subs.forEach((s) => {
              const slug = pMap.get(s.problem.toString());
              if (slug) solvedMap.set(slug, s.createdAt);
            });
            return solvedMap;
          });
      }),
    QuizAttempt.find({
      user: userId,
      quizId: { $in: quizIds },
      isPassed: true,
      status: { $in: ['submitted', 'completed'] }
    })
      .select('quizId submittedAt createdAt')
      .lean()
      .then((qas) => {
        const passedMap = new Map();
        qas.forEach((qa) => {
          passedMap.set(qa.quizId, qa.submittedAt || qa.createdAt);
        });
        return passedMap;
      })
  ]);

  let allCompleted = true;
  let verifiedCount = 0;

  const updatedItems = bundle.items.map((item) => {
    let isCompleted = item.isCompleted;
    let completedAt = item.completedAt;

    if (item.type === 'problem') {
      if (submissions.has(item.identifier)) {
        isCompleted = true;
        completedAt = completedAt || submissions.get(item.identifier);
      }
    } else if (item.type === 'quiz') {
      if (quizAttempts.has(item.identifier)) {
        isCompleted = true;
        completedAt = completedAt || quizAttempts.get(item.identifier);
      }
    }

    if (isCompleted) {
      verifiedCount++;
    } else {
      allCompleted = false;
    }

    return {
      ...item,
      isCompleted,
      completedAt
    };
  });

  const status = allCompleted && updatedItems.length > 0 ? 'completed' : bundle.status;

  // Persist updated completion state if changed
  if (status !== bundle.status || verifiedCount > 0) {
    await PracticeBundle.updateOne(
      { _id: bundle._id },
      { $set: { items: updatedItems, status } }
    );
  }

  const completionRate = updatedItems.length > 0 ? Math.round((verifiedCount / updatedItems.length) * 100) : 0;

  return {
    ...bundle,
    items: updatedItems,
    status,
    verifiedCount,
    totalItems: updatedItems.length,
    completionRate,
    isAllCompleted: allCompleted
  };
}

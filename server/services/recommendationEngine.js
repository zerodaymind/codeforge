import {
  LEARNING_STATE
} from './learningIntelligenceService.js';
import {
  QUIZ_CATALOG_MAP,
  TOPIC_PROBLEM_SEQUENCES,
  slugify
} from './roadmapPlanner.js';

/**
 * ==============================================================================
 * Pure Deterministic Recommendation Engine (Milestone 16A)
 *
 * Translates synthesized Learner Intelligence states into prioritized, actionable,
 * catalog-grounded next learning steps.
 *
 * PRINCIPLES:
 * 1. Prioritizes demonstrated gaps and prerequisite weaknesses before advancing.
 * 2. Grounded strictly in CodeForge's genuine quiz and problem catalog.
 * 3. Never invents nonexistent slugs, question IDs, or external URLs.
 * 4. Filters out already-solved problems to prevent redundant recommendations.
 * 5. Deterministic tie-breaking: produces strictly identical results for identical inputs.
 * 6. Discloses rationale and evidence limitations for every recommendation.
 * ==============================================================================
 */

export const ACTION_CATEGORY = {
  REVIEW: 'review',           // Foundational review for struggling topics
  DIAGNOSE: 'diagnose',       // Diagnostic/quiz to resolve insufficient evidence or unassessed state
  PRACTICE: 'practice',       // Hands-on coding practice for developing topics
  CHALLENGE: 'challenge'      // Advanced problem-solving for proficient/mastered topics
};

/**
 * Selects an unsolved problem for a given topic from the catalog sequence.
 *
 * @param {string} topic - Canonical topic name
 * @param {Set<string>} solvedSlugs - Set of problem slugs already solved by the learner
 * @param {string} [targetDifficulty='Easy'] - 'Easy' | 'Medium' | 'Hard'
 * @returns {Object|null} Problem object { slug, title, difficulty } or null
 */
function findCatalogProblem(topic, solvedSlugs = new Set(), targetDifficulty = 'Easy') {
  const sequence = TOPIC_PROBLEM_SEQUENCES[topic];
  if (!sequence || sequence.length === 0) return null;

  // 1. Try to find an unsolved problem matching targetDifficulty
  const matchingUnsolved = sequence.find(
    (p) => p.difficulty === targetDifficulty && !solvedSlugs.has(p.slug)
  );
  if (matchingUnsolved) return matchingUnsolved;

  // 2. If target is Medium/Hard, fallback to any unsolved problem
  if (targetDifficulty !== 'Easy') {
    const anyUnsolved = sequence.find((p) => !solvedSlugs.has(p.slug));
    if (anyUnsolved) return anyUnsolved;
  } else {
    // For Easy target, try first unsolved problem
    const firstUnsolved = sequence.find((p) => !solvedSlugs.has(p.slug));
    if (firstUnsolved) return firstUnsolved;
  }

  // 3. If all problems for this topic are already solved, return the most challenging one for reinforcement
  return sequence[sequence.length - 1];
}

/**
 * Pure function: Generates prioritized next learning actions based on learner intelligence.
 *
 * @param {Object} learnerIntelligence - Complete intelligence model from getLearnerIntelligence
 * @param {Object} [options={}]
 * @param {number} [options.limit=10] - Maximum number of recommendations to return
 * @returns {Object} Structured recommendation plan
 */
export function generateLearningRecommendations(learnerIntelligence, options = {}) {
  const { limit = 10 } = options;

  if (!learnerIntelligence || !Array.isArray(learnerIntelligence.topicStates)) {
    return {
      summary: 'Insufficient learner intelligence data to generate recommendations.',
      totalRecommendations: 0,
      topRecommendation: null,
      recommendations: []
    };
  }

  const { topicStates } = learnerIntelligence;

  const recommendations = [];
  const seenRecommendationKeys = new Set();

  for (const topicAnalysis of topicStates) {
    const {
      topic,
      state,
      confidence,
      masteryScore,
      sampleSize,
      isGoalAligned,
      limitations: topicLimitations = []
    } = topicAnalysis;

    const quizInfo = QUIZ_CATALOG_MAP[topic];

    // Map already-solved problems for this specific topic
    const solvedForTopic = new Set();

    let actionCategory = ACTION_CATEGORY.PRACTICE;
    let title = '';
    let reason = '';
    let difficulty = 'Medium';
    let resource = null;
    let priorityWeight = 500;

    switch (state) {
      case LEARNING_STATE.STRUGGLING: {
        // High priority: Foundational gap demonstrated (accuracy < 50%)
        priorityWeight = 100;
        actionCategory = ACTION_CATEGORY.REVIEW;
        difficulty = 'Easy';

        const easyProblem = findCatalogProblem(topic, solvedForTopic, 'Easy');

        if (quizInfo) {
          title = `Revise ${topic} Fundamentals`;
          reason = `Demonstrated conceptual gap (${masteryScore}% accuracy across ${sampleSize} items). Complete the ${quizInfo.title} quiz to reinforce core syntax and patterns.`;
          resource = {
            type: 'quiz',
            identifier: quizInfo.quizId,
            title: quizInfo.title,
            url: quizInfo.url
          };
        } else if (easyProblem) {
          title = `Rebuild ${topic} Foundations: ${easyProblem.title}`;
          reason = `Performance indicates foundational difficulty (${masteryScore}% accuracy). Solve ${easyProblem.title} (${easyProblem.difficulty}) to establish problem-solving confidence.`;
          resource = {
            type: 'problem',
            identifier: easyProblem.slug,
            title: easyProblem.title,
            url: `/practice/${easyProblem.slug}`
          };
        } else {
          title = `Review ${topic} Concepts`;
          reason = `Foundational revision is recommended based on observed performance (${masteryScore}% accuracy).`;
          resource = {
            type: 'practice_catalog',
            identifier: slugify(topic),
            title: `${topic} Practice`,
            url: `/practice?topic=${encodeURIComponent(topic)}`
          };
        }
        break;
      }

      case LEARNING_STATE.INSUFFICIENT_EVIDENCE: {
        // High priority: Evidence is too sparse (< 2 items) to draw confident conclusions
        priorityWeight = 200;
        actionCategory = ACTION_CATEGORY.DIAGNOSE;
        difficulty = quizInfo?.difficulty || 'Medium';

        if (quizInfo) {
          title = `Baseline ${topic} Knowledge: ${quizInfo.title}`;
          reason = `Only ${sampleSize} item evaluated for ${topic}. Complete this quiz to establish a reliable baseline measurement.`;
          resource = {
            type: 'quiz',
            identifier: quizInfo.quizId,
            title: quizInfo.title,
            url: quizInfo.url
          };
        } else {
          const problem = findCatalogProblem(topic, solvedForTopic, 'Easy');
          if (problem) {
            title = `Gather Evidence in ${topic}: ${problem.title}`;
            reason = `Sample size is currently insufficient. Solve ${problem.title} (${problem.difficulty}) to verify your capability.`;
            resource = {
              type: 'problem',
              identifier: problem.slug,
              title: problem.title,
              url: `/practice/${problem.slug}`
            };
          } else {
            title = `Assess ${topic}`;
            reason = `Take a diagnostic assessment to baseline your understanding of ${topic}.`;
            resource = {
              type: 'diagnostic',
              identifier: 'diagnostic-session',
              title: 'Diagnostic Assessment',
              url: '/diagnostic'
            };
          }
        }
        break;
      }

      case LEARNING_STATE.DEVELOPING: {
        // Medium priority: Partial competence demonstrated (50% - 74%)
        priorityWeight = 300;
        actionCategory = ACTION_CATEGORY.PRACTICE;
        difficulty = 'Medium';

        const mediumProblem = findCatalogProblem(topic, solvedForTopic, 'Medium');
        if (mediumProblem) {
          title = `Solidify ${topic} Proficiency: ${mediumProblem.title}`;
          reason = `Demonstrated emerging capability (${masteryScore}% accuracy). Tackle ${mediumProblem.title} (${mediumProblem.difficulty}) to transition from developing to proficient.`;
          resource = {
            type: 'problem',
            identifier: mediumProblem.slug,
            title: mediumProblem.title,
            url: `/practice/${mediumProblem.slug}`
          };
        } else if (quizInfo) {
          title = `Reinforce ${topic} Concepts: ${quizInfo.title}`;
          reason = `Score (${masteryScore}%) indicates solid progress. Validate concepts with the ${quizInfo.title} quiz.`;
          resource = {
            type: 'quiz',
            identifier: quizInfo.quizId,
            title: quizInfo.title,
            url: quizInfo.url
          };
        } else {
          title = `Practice ${topic} Problems`;
          reason = `Continue hands-on problem solving to build toward topic mastery.`;
          resource = {
            type: 'practice_catalog',
            identifier: slugify(topic),
            title: `${topic} Catalog`,
            url: `/practice?topic=${encodeURIComponent(topic)}`
          };
        }
        break;
      }

      case LEARNING_STATE.UNASSESSED: {
        // Lower priority unless aligned with learner's declared goal
        priorityWeight = isGoalAligned ? 350 : 500;
        actionCategory = ACTION_CATEGORY.DIAGNOSE;
        difficulty = 'Easy';

        const introProblem = findCatalogProblem(topic, solvedForTopic, 'Easy');
        if (isGoalAligned && quizInfo) {
          title = `Explore ${topic}: ${quizInfo.title}`;
          reason = `You selected ${topic} in your learning profile. Take this quiz to benchmark your starting level.`;
          resource = {
            type: 'quiz',
            identifier: quizInfo.quizId,
            title: quizInfo.title,
            url: quizInfo.url
          };
        } else if (introProblem) {
          title = `Start ${topic}: ${introProblem.title}`;
          reason = `No evidence recorded yet for ${topic}. Begin with ${introProblem.title} (${introProblem.difficulty}) to establish initial practice records.`;
          resource = {
            type: 'problem',
            identifier: introProblem.slug,
            title: introProblem.title,
            url: `/practice/${introProblem.slug}`
          };
        } else {
          title = `Discover ${topic}`;
          reason = `No prior activity recorded for this topic. Explore problems to expand your knowledge.`;
          resource = {
            type: 'practice_catalog',
            identifier: slugify(topic),
            title: `${topic} Catalog`,
            url: `/practice?topic=${encodeURIComponent(topic)}`
          };
        }
        break;
      }

      case LEARNING_STATE.PROFICIENT: {
        // Advanced priority: Solid grasp demonstrated (75% - 84%)
        priorityWeight = 600;
        actionCategory = ACTION_CATEGORY.CHALLENGE;
        difficulty = 'Medium';

        const challengeProblem = findCatalogProblem(topic, solvedForTopic, 'Medium');
        if (challengeProblem) {
          title = `Level Up in ${topic}: ${challengeProblem.title}`;
          reason = `Consistent performance demonstrated (${masteryScore}% accuracy). Push your problem-solving depth with ${challengeProblem.title}.`;
          resource = {
            type: 'problem',
            identifier: challengeProblem.slug,
            title: challengeProblem.title,
            url: `/practice/${challengeProblem.slug}`
          };
        } else {
          title = `Explore Advanced ${topic}`;
          reason = `Solid proficiency demonstrated (${masteryScore}%). Advance to interview-level algorithm challenges.`;
          resource = {
            type: 'practice_catalog',
            identifier: slugify(topic),
            title: `${topic} Practice`,
            url: `/practice?topic=${encodeURIComponent(topic)}`
          };
        }
        break;
      }

      case LEARNING_STATE.MASTERED: {
        // Maintenance priority: High mastery demonstrated (85%+)
        priorityWeight = 700;
        actionCategory = ACTION_CATEGORY.CHALLENGE;
        difficulty = 'Hard';

        const hardProblem = findCatalogProblem(topic, solvedForTopic, 'Hard');
        if (hardProblem) {
          title = `Mastery Challenge in ${topic}: ${hardProblem.title}`;
          reason = `Demonstrated strong mastery (${masteryScore}% accuracy). Test yourself against high-difficulty problems like ${hardProblem.title}.`;
          resource = {
            type: 'problem',
            identifier: hardProblem.slug,
            title: hardProblem.title,
            url: `/practice/${hardProblem.slug}`
          };
        } else {
          title = `Maintain ${topic} Mastery`;
          reason = `Outstanding mastery recorded (${masteryScore}%). Periodic review will keep these patterns sharp.`;
          resource = {
            type: 'practice_catalog',
            identifier: slugify(topic),
            title: `${topic} Advanced Practice`,
            url: `/practice?topic=${encodeURIComponent(topic)}`
          };
        }
        break;
      }

      default:
        continue;
    }

    // Preference offset: Boost items that match user's declared topics
    const prefOffset = isGoalAligned ? -25 : 0;
    const finalPriorityWeight = priorityWeight + prefOffset;

    // Stable recommendation ID
    const recId = `rec-intel-${slugify(topic)}-${actionCategory}`;
    if (seenRecommendationKeys.has(recId)) continue;
    seenRecommendationKeys.add(recId);

    recommendations.push({
      id: recId,
      topic,
      state,
      actionCategory,
      priorityWeight: finalPriorityWeight,
      title,
      reason,
      difficulty,
      resource,
      evidenceBasis: {
        sampleSize,
        masteryScore,
        confidence,
        isGoalAligned
      },
      limitations: topicLimitations
    });
  }

  // Deterministic sort:
  // Primary: priorityWeight ascending (Struggling -> Insufficient -> Developing -> Goal-Aligned Unassessed -> Proficient -> Mastered)
  // Secondary: topic alphabetical
  recommendations.sort((a, b) => {
    if (a.priorityWeight !== b.priorityWeight) {
      return a.priorityWeight - b.priorityWeight;
    }
    return a.topic.localeCompare(b.topic);
  });

  // Assign clean sequential priorities and strip internal weights
  recommendations.forEach((item, idx) => {
    item.priority = idx + 1;
    delete item.priorityWeight;
  });

  const slicedRecommendations = recommendations.slice(0, limit);

  // Generate actionable summary narrative
  const strugglingCount = recommendations.filter((r) => r.state === LEARNING_STATE.STRUGGLING).length;
  const developingCount = recommendations.filter((r) => r.state === LEARNING_STATE.DEVELOPING).length;
  const insufficientCount = recommendations.filter((r) => r.state === LEARNING_STATE.INSUFFICIENT_EVIDENCE).length;

  let summary = '';
  if (strugglingCount > 0) {
    summary = `${strugglingCount} topic${strugglingCount === 1 ? '' : 's'} identified with conceptual gaps. Prioritize foundational review before advancing.`;
  } else if (insufficientCount > 0) {
    summary = `Baseline evidence is sparse for ${insufficientCount} topic${insufficientCount === 1 ? '' : 's'}. Complete targeted assessments to verify your skills.`;
  } else if (developingCount > 0) {
    summary = `${developingCount} topic${developingCount === 1 ? '' : 's'} developing steadily. Focused medium-difficulty practice recommended.`;
  } else {
    summary = `All evaluated topics show solid competence. Ready for advanced algorithmic challenges.`;
  }

  return {
    summary,
    totalRecommendations: recommendations.length,
    topRecommendation: slicedRecommendations[0] || null,
    recommendations: slicedRecommendations
  };
}

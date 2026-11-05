import CompetencySnapshot from '../models/CompetencySnapshot.js';
import { getLearnerIntelligence, LEARNING_STATE } from './learningIntelligenceService.js';
import { normalizeTopicName } from './roadmapPlanner.js';

/**
 * ==============================================================================
 * Longitudinal Competency Tracking Service (Milestone 16B)
 *
 * Tracks, preserves, and compares dated learner competency snapshots across
 * 30-, 60-, and 90-day retention and progression windows.
 *
 * SCIENTIFIC MEASUREMENT INTEGRITY:
 * 1. Measured historical scores are NEVER lowered merely because time elapsed.
 * 2. Missing activity is NEVER equated with cognitive forgetting.
 * 3. Compares like-with-like (discloses differences in sample size, difficulty mix).
 * 4. Strictly prevents client-side score injection (all metrics derived server-side).
 * 5. Rate-limits redundant snapshot recording within a 6-hour cooldown window.
 * ==============================================================================
 */

export const TREND_STATUS = {
  IMPROVED: 'improved',
  STABLE: 'stable',
  REGRESSED: 'regressed',
  INSUFFICIENT_DATA: 'insufficient_data',
  NEW_TOPIC: 'new_topic',
  UNASSESSED: 'unassessed'
};

export const COMPARISON_LIMITATIONS = {
  DIFFICULTY_MISMATCH: 'Assessment difficulty composition varied between baseline and current periods.',
  SAMPLE_SIZE_DISPARITY: 'Sample sizes differed significantly between periods; interpret delta directionally.',
  PROMPT_FAMILIARITY: 'Identical practice problems or questions evaluated; improvement may reflect recall.',
  SPARSE_BASELINE: 'Baseline measurement relied on fewer than 2 items; confidence is limited.'
};

/**
 * Records an authoritative dated competency snapshot for an authenticated learner.
 * Rate-limits duplicate snapshots within 6 hours unless forced.
 *
 * @param {string} userId - Authenticated user ID
 * @param {string|Object} [sourceEventOrOptions='manual_checkpoint']
 * @param {Date} [refDate=new Date()]
 * @param {boolean} [forceFlag=false]
 * @returns {Promise<Object>} Created snapshot object
 */
export async function recordCompetencySnapshot(
  userId,
  sourceEventOrOptions = 'manual_checkpoint',
  refDate = new Date(),
  forceFlag = false
) {
  if (!userId) {
    throw new Error('User ID is required to record competency snapshot.');
  }

  let sourceEvent = 'manual_checkpoint';
  let referenceDate = refDate;
  let force = forceFlag;
  let notes = '';

  if (typeof sourceEventOrOptions === 'object' && sourceEventOrOptions !== null) {
    sourceEvent = sourceEventOrOptions.sourceEvent || sourceEventOrOptions.trigger || 'manual_checkpoint';
    if (sourceEventOrOptions.referenceDate) referenceDate = sourceEventOrOptions.referenceDate;
    if (sourceEventOrOptions.force !== undefined) force = sourceEventOrOptions.force;
    if (sourceEventOrOptions.notes) notes = sourceEventOrOptions.notes;
  } else if (typeof sourceEventOrOptions === 'string') {
    sourceEvent = sourceEventOrOptions;
  }

  // 1. Rate-limit check: check if snapshot was created within last 6 hours
  if (!force) {
    const sixHoursAgo = new Date(referenceDate.getTime() - 6 * 60 * 60 * 1000);
    const recentSnapshot = await CompetencySnapshot.findOne({
      user: userId,
      snapshotDate: { $gte: sixHoursAgo }
    })
      .sort({ snapshotDate: -1 })
      .lean();

    if (recentSnapshot) {
      const err = new Error('Rate-limit cooldown window active (6h). A snapshot was already recorded recently.');
      err.status = 429;
      err.snapshot = recentSnapshot;
      throw err;
    }
  }

  // 2. Fetch Fresh Learner Intelligence Model
  const intelligence = await getLearnerIntelligence(userId, referenceDate);
  const { overview, topicStates } = intelligence;

  // 3. Map Topic Metrics
  const topicMetrics = topicStates.map((ts) => ({
    topic: ts.topic,
    state: ts.state,
    learningState: ts.state,
    confidence: ts.confidence,
    confidenceLevel: ts.confidence,
    masteryScore: ts.masteryScore,
    accuracyPercentage: ts.accuracyPercentage,
    confidenceScore: ts.confidenceScore,
    sampleSize: ts.sampleSize,
    evidenceCount: ts.sampleSize,
    distinctProblemsSolved: ts.distinctProblemsSolved,
    quizPassCount: ts.quizPassCount,
    diagnosticQuestionCount: ts.diagnosticQuestionCount,
    freshnessScore: ts.freshnessScore,
    solvedDifficulty: ts.evidenceBreakdown?.practice?.solvedDifficulty || { Easy: 0, Medium: 0, Hard: 0 },
    evidenceBreakdown: ts.evidenceBreakdown || {}
  }));

  const summary = {
    totalTopicsTracked: topicStates.length,
    overallMasteryScore: overview.overallMasteryScore,
    evaluatedTopicsCount: overview.evaluatedTopicsCount
  };

  // 4. Persist Immutable Snapshot Document
  const snapshotDoc = await CompetencySnapshot.create({
    user: userId,
    snapshotDate: referenceDate,
    sourceEvent,
    trigger: sourceEvent,
    notes,
    overallMasteryScore: overview.overallMasteryScore,
    evaluatedTopicsCount: overview.evaluatedTopicsCount,
    summary,
    topicMetrics,
    topicSnapshots: topicMetrics
  });

  const obj = snapshotDoc.toObject();
  obj.topicSnapshots = obj.topicMetrics;
  obj.summary = summary;
  obj.isNew = true;
  obj.snapshot = obj;

  return obj;
}

/**
 * Computes single-window longitudinal comparison metrics.
 */
async function computeSingleWindowTrend(userId, windowDays, referenceDate, currentIntelligence) {
  const cutoffDate = new Date(referenceDate.getTime() - windowDays * 24 * 60 * 60 * 1000);

  const snapshots = await CompetencySnapshot.find({
    user: userId,
    snapshotDate: { $gte: cutoffDate, $lte: referenceDate }
  })
    .sort({ snapshotDate: 1 })
    .lean();

  const comparabilityDisclosures = [
    {
      rule: 'no_score_decay_from_inactivity',
      message: 'Historical mastery scores are preserved without decay. Inactivity is never equated with forgetting.'
    }
  ];

  if (snapshots.length === 0) {
    const topicDeltas = [];
    for (const ct of currentIntelligence.topicStates) {
      const canonical = normalizeTopicName(ct.topic);
      const deltaItem = {
        topic: canonical,
        trend: TREND_STATUS.NEW_TOPIC,
        baselineScore: null,
        currentScore: ct.masteryScore,
        scoreDelta: null,
        baselineSampleSize: 0,
        currentSampleSize: ct.sampleSize,
        currentState: ct.state,
        baselineState: LEARNING_STATE.UNASSESSED,
        isComparable: false,
        interpretation: 'No baseline snapshot found in window.',
        limitations: ['No baseline snapshot in this window.']
      };
      topicDeltas.push(deltaItem);
      topicDeltas[canonical] = deltaItem;
    }

    return {
      hasTrend: false,
      windowDays,
      reason: 'baseline_established',
      message: `No baseline snapshot found in the ${windowDays}-day window.`,
      currentSnapshotDate: referenceDate,
      baselineSnapshotDate: referenceDate,
      baselineOverallScore: null,
      currentOverallScore: currentIntelligence.overview.overallMasteryScore,
      averageScoreDelta: 0,
      comparabilityDisclosures,
      topicDeltas
    };
  }

  const baselineSnapshot = snapshots[0];
  const baselineTopicMap = new Map();
  for (const m of (baselineSnapshot.topicMetrics || baselineSnapshot.topicSnapshots || [])) {
    baselineTopicMap.set(normalizeTopicName(m.topic), m);
  }

  const topicDeltas = [];

  for (const currentTopic of currentIntelligence.topicStates) {
    const canonical = normalizeTopicName(currentTopic.topic);
    const baseline = baselineTopicMap.get(canonical);
    const limitations = [];

    // Case A: Unassessed currently and previously
    if (!baseline && currentTopic.state === LEARNING_STATE.UNASSESSED) {
      const deltaItem = {
        topic: canonical,
        trend: TREND_STATUS.UNASSESSED,
        baselineScore: null,
        currentScore: null,
        scoreDelta: null,
        baselineSampleSize: 0,
        currentSampleSize: 0,
        currentState: currentTopic.state,
        baselineState: LEARNING_STATE.UNASSESSED,
        isComparable: false,
        interpretation: 'Topic has not been evaluated in either period.',
        limitations: []
      };
      topicDeltas.push(deltaItem);
      topicDeltas[canonical] = deltaItem;
      continue;
    }

    // Case B: Newly assessed topic in current window
    if (!baseline || (baseline.state === LEARNING_STATE.UNASSESSED && !baseline.masteryScore)) {
      const deltaItem = {
        topic: canonical,
        trend: TREND_STATUS.NEW_TOPIC,
        baselineScore: null,
        currentScore: currentTopic.masteryScore,
        scoreDelta: null,
        baselineSampleSize: 0,
        currentSampleSize: currentTopic.sampleSize,
        currentState: currentTopic.state,
        baselineState: LEARNING_STATE.UNASSESSED,
        isComparable: false,
        interpretation: `Evaluated for the first time during the ${windowDays}-day window (${currentTopic.masteryScore}% across ${currentTopic.sampleSize} items).`,
        limitations: ['No baseline assessment existed prior in this window.']
      };
      topicDeltas.push(deltaItem);
      topicDeltas[canonical] = deltaItem;
      continue;
    }

    // Case C: Evaluated in both baseline and current
    const baseScore = baseline.masteryScore !== undefined ? baseline.masteryScore : null;
    const currScore = currentTopic.masteryScore !== undefined ? currentTopic.masteryScore : null;
    const baseSample = baseline.sampleSize || baseline.evidenceCount || 0;
    const currSample = currentTopic.sampleSize || 0;

    // Check sample size threshold
    if (baseSample < 2 || currSample < 2) {
      limitations.push(COMPARISON_LIMITATIONS.SPARSE_BASELINE);
      const deltaItem = {
        topic: canonical,
        trend: TREND_STATUS.INSUFFICIENT_DATA,
        baselineScore: baseScore,
        currentScore: currScore,
        scoreDelta: null,
        baselineSampleSize: baseSample,
        currentSampleSize: currSample,
        currentState: currentTopic.state,
        baselineState: baseline.state || baseline.learningState,
        isComparable: false,
        interpretation: `Sample size too small for confident longitudinal comparison (${baseSample} items baseline vs ${currSample} items currently).`,
        limitations
      };
      topicDeltas.push(deltaItem);
      topicDeltas[canonical] = deltaItem;
      continue;
    }

    const scoreDelta = (currScore !== null && baseScore !== null) ? (currScore - baseScore) : 0;

    // Check difficulty composition variation
    const baseDiff = baseline.solvedDifficulty || {};
    const currDiff = currentTopic.evidenceBreakdown?.practice?.solvedDifficulty || {};

    const baseHarderCount = (baseDiff.Medium || 0) + (baseDiff.Hard || 0);
    const currHarderCount = (currDiff.Medium || 0) + (currDiff.Hard || 0);

    if (Math.abs(currHarderCount - baseHarderCount) >= 2) {
      limitations.push(COMPARISON_LIMITATIONS.DIFFICULTY_MISMATCH);
      comparabilityDisclosures.push({
        topic: canonical,
        rule: 'difficulty_composition_mismatch',
        message: `Assessment difficulty composition varied for ${canonical} between baseline and current periods.`
      });
    }

    if (Math.abs(currSample - baseSample) >= 4) {
      limitations.push(COMPARISON_LIMITATIONS.SAMPLE_SIZE_DISPARITY);
    }

    let trend = TREND_STATUS.STABLE;
    let interpretation = '';

    if (scoreDelta >= 10) {
      trend = TREND_STATUS.IMPROVED;
      interpretation = `Observed competency increased by ${scoreDelta} percentage points (${baseScore}% -> ${currScore}% across ${currSample} items).`;
    } else if (scoreDelta <= -10) {
      trend = TREND_STATUS.REGRESSED;
      interpretation = `Observed accuracy decreased by ${Math.abs(scoreDelta)} percentage points (${baseScore}% -> ${currScore}% across ${currSample} items). Foundational reinforcement recommended.`;
    } else {
      trend = TREND_STATUS.STABLE;
      const sign = scoreDelta >= 0 ? '+' : '';
      interpretation = `Competency appears broadly stable (${baseScore}% vs ${currScore}%, delta: ${sign}${scoreDelta}pp across ${currSample} items).`;
    }

    const deltaItem = {
      topic: canonical,
      trend,
      baselineScore: baseScore,
      currentScore: currScore,
      scoreDelta,
      baselineSampleSize: baseSample,
      currentSampleSize: currSample,
      currentState: currentTopic.state,
      baselineState: baseline.state || baseline.learningState,
      isComparable: true,
      interpretation,
      limitations
    };
    topicDeltas.push(deltaItem);
    topicDeltas[canonical] = deltaItem;
  }

  const comparableDeltas = topicDeltas.filter((td) => td.isComparable && td.scoreDelta !== null);
  const averageDelta = comparableDeltas.length > 0
    ? Math.round(comparableDeltas.reduce((acc, td) => acc + td.scoreDelta, 0) / comparableDeltas.length)
    : 0;

  return {
    hasTrend: true,
    windowDays,
    baselineSnapshotDate: baselineSnapshot.snapshotDate,
    currentSnapshotDate: referenceDate,
    baselineOverallScore: baselineSnapshot.overallMasteryScore,
    currentOverallScore: currentIntelligence.overview.overallMasteryScore,
    averageScoreDelta: averageDelta,
    comparabilityDisclosures,
    topicDeltas
  };
}

/**
 * Computes longitudinal competency trends across 30, 60, or 90 days.
 *
 * @param {string} userId - Authenticated user ID
 * @param {Object} [options={}]
 * @param {number} [options.windowDays=30] - 30 | 60 | 90
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {Promise<Object>} Longitudinal comparison report with multi-window analytics
 */
export async function getCompetencyTrend(userId, options = {}) {
  const { windowDays = 30, referenceDate = new Date() } = options;
  const currentIntelligence = await getLearnerIntelligence(userId, referenceDate);

  const [report30, report60, report90, recentHistory] = await Promise.all([
    computeSingleWindowTrend(userId, 30, referenceDate, currentIntelligence),
    computeSingleWindowTrend(userId, 60, referenceDate, currentIntelligence),
    computeSingleWindowTrend(userId, 90, referenceDate, currentIntelligence),
    CompetencySnapshot.find({ user: userId })
      .sort({ snapshotDate: -1 })
      .limit(10)
      .lean()
  ]);

  const selectedReport = Number(windowDays) === 60 ? report60 : Number(windowDays) === 90 ? report90 : report30;

  return {
    windows: {
      '30d': report30,
      '60d': report60,
      '90d': report90
    },
    ...selectedReport,
    history: recentHistory
  };
}

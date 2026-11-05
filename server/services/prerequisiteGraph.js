import { CANONICAL_TOPICS, normalizeTopicName } from './roadmapPlanner.js';
import { LEARNING_STATE } from './learningIntelligenceService.js';

/**
 * ==============================================================================
 * Prerequisite Knowledge Graph (Milestone 16B)
 *
 * Models foundational and sequential curriculum dependencies across canonical
 * computer science topics as an explicit, validated Directed Acyclic Graph (DAG).
 *
 * PRINCIPLES:
 * 1. Represents prerequisite relationships separately from learner performance.
 * 2. Strict cycle detection (rejects cyclic or self-referential graph definitions).
 * 3. Topological sorting for deterministic, dependency-aware pathway ordering.
 * 4. Non-rigid navigation: flags prerequisite gaps with guidance without
 *    artificially locking learners out of exploring unrelated topics.
 * ==============================================================================
 */

/**
 * Default Canonical Prerequisite Knowledge Graph (Adjacency List: topic -> prerequisites[])
 */
export const PREREQUISITE_GRAPH = {
  'JavaScript': [],
  'Data Structures & Algorithms': [],
  'Arrays': ['Data Structures & Algorithms'],
  'Strings': ['Arrays'],
  'Searching': ['Arrays'],
  'Sorting': ['Arrays', 'Recursion'],
  'Linked List': ['Data Structures & Algorithms'],
  'Stack': ['Arrays'],
  'Queue': ['Arrays', 'Linked List'],
  'Recursion': ['Data Structures & Algorithms'],
  'Hashing': ['Arrays'],
  'Dynamic Programming': ['Arrays', 'Recursion'],
  'Operating Systems': [],
  'Computer Networks': ['Operating Systems'],
  'Cybersecurity': ['Computer Networks']
};

/**
 * Validates graph structural integrity:
 * 1. All nodes and edges must reference recognized canonical topics.
 * 2. Graph must be strictly acyclic (no cycles or self-referential loops).
 *
 * @param {Object} graph - Adjacency map of topic -> prerequisites[]
 * @param {Array<string>} [allowedTopics] - List of recognized topics
 * @returns {{ valid: boolean, error?: string, cycle?: string[] }}
 */
export function validateGraph(graph = PREREQUISITE_GRAPH, allowedTopics = null) {
  const recognizedSet = new Set(
    allowedTopics || Object.values(CANONICAL_TOPICS).map(normalizeTopicName)
  );

  // Check 1: All keys and dependencies must exist in recognized topics
  for (const [topic, prereqs] of Object.entries(graph)) {
    const canonical = normalizeTopicName(topic);
    if (!recognizedSet.has(canonical)) {
      return {
        valid: false,
        isValid: false,
        error: `Unrecognized node '${topic}' in prerequisite graph.`
      };
    }

    if (!Array.isArray(prereqs)) {
      return {
        valid: false,
        isValid: false,
        error: `Prerequisites for '${topic}' must be an array.`
      };
    }

    for (const prereq of prereqs) {
      const canonicalPrereq = normalizeTopicName(prereq);
      if (!recognizedSet.has(canonicalPrereq)) {
        return {
          valid: false,
          isValid: false,
          error: `Unrecognized prerequisite '${prereq}' referenced by topic '${topic}'.`
        };
      }
      if (canonical === canonicalPrereq) {
        return {
          valid: false,
          isValid: false,
          error: `Self-referential prerequisite detected on topic '${topic}'.`,
          cycle: [topic, topic]
        };
      }
    }
  }

  // Check 2: Cycle Detection using DFS with recursion stack
  // Note: graph maps dependent -> prerequisites. An edge in dependency flow is prereq -> dependent.
  const visited = new Set();
  const recStack = new Set();
  const cyclePath = [];

  function detectCycleDFS(node) {
    visited.add(node);
    recStack.add(node);
    cyclePath.push(node);

    const prereqs = graph[node] || [];
    for (const neighbor of prereqs) {
      if (!visited.has(neighbor)) {
        if (detectCycleDFS(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        cyclePath.push(neighbor);
        return true;
      }
    }

    recStack.delete(node);
    cyclePath.pop();
    return false;
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      if (detectCycleDFS(node)) {
        return {
          valid: false,
          isValid: false,
          error: `Cycle detected: ${cyclePath.join(' -> ')}`,
          cycle: cyclePath
        };
      }
    }
  }

  return {
    valid: true,
    isValid: true,
    topicCount: Object.keys(graph).length
  };
}

/**
 * Computes deterministic topological order of topics where prerequisites
 * always appear before dependents.
 *
 * @param {Object} [graph=PREREQUISITE_GRAPH]
 * @returns {Array<string>} Topologically sorted list of topics
 */
export function getTopologicalOrder(graph = PREREQUISITE_GRAPH) {
  const validation = validateGraph(graph);
  if (!validation.valid) {
    throw new Error(`Cannot compute topological order: ${validation.error}`);
  }

  // Build in-degree map and forward graph (prereq -> dependents[])
  const inDegree = new Map();
  const forwardGraph = new Map();

  for (const node of Object.keys(graph)) {
    inDegree.set(node, 0);
    forwardGraph.set(node, []);
  }

  for (const [dependent, prereqs] of Object.entries(graph)) {
    inDegree.set(dependent, prereqs.length);
    for (const prereq of prereqs) {
      if (!forwardGraph.has(prereq)) {
        forwardGraph.set(prereq, []);
      }
      forwardGraph.get(prereq).push(dependent);
    }
  }

  // Queue of nodes with in-degree 0 (foundational topics with no prerequisites)
  const queue = [];
  for (const [node, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  // Sort queue alphabetically for deterministic tie-breaking
  queue.sort();

  const sortedOrder = [];

  while (queue.length > 0) {
    const current = queue.shift();
    sortedOrder.push(current);

    const dependents = forwardGraph.get(current) || [];
    dependents.sort(); // deterministic tie-breaking

    for (const dep of dependents) {
      const newDegree = inDegree.get(dep) - 1;
      inDegree.set(dep, newDegree);
      if (newDegree === 0) {
        queue.push(dep);
      }
    }
  }

  return sortedOrder;
}

/**
 * Returns all direct or transitive prerequisites for a specific topic.
 *
 * @param {string} topic - Canonical topic name
 * @param {Object} [graph=PREREQUISITE_GRAPH]
 * @param {Object} [options={}]
 * @param {boolean} [options.transitive=false] - If true, returns full ancestor closure
 * @returns {Array<string>}
 */
export function getPrerequisites(topic, graphOrOptions = PREREQUISITE_GRAPH, maybeOptions = {}) {
  let graph = PREREQUISITE_GRAPH;
  let options = { transitive: true };

  if (graphOrOptions && typeof graphOrOptions === 'object') {
    if ('transitive' in graphOrOptions) {
      options = { ...options, ...graphOrOptions };
    } else {
      graph = graphOrOptions;
      if (maybeOptions && typeof maybeOptions === 'object') {
        options = { ...options, ...maybeOptions };
      }
    }
  }

  const canonical = normalizeTopicName(topic);
  const direct = graph[canonical] || [];

  if (!options.transitive) {
    return [...direct];
  }

  const allPrereqs = new Set();
  const queue = [...direct];

  while (queue.length > 0) {
    const curr = queue.shift();
    if (!allPrereqs.has(curr)) {
      allPrereqs.add(curr);
      const ancestors = graph[curr] || [];
      ancestors.forEach((a) => queue.push(a));
    }
  }

  return Array.from(allPrereqs);
}

/**
 * Evaluates whether a learner has satisfied the prerequisites for a target topic
 * based on their current topic learning states from Milestone 16A.
 *
 * @param {string} targetTopic - Topic the learner wants or is recommended to practice
 * @param {Array<Object>|Object} learnerTopicStates - topicStates from getLearnerIntelligence or object map
 * @param {Object} [graph=PREREQUISITE_GRAPH]
 * @returns {Object} Prerequisite readiness evaluation
 */
export function evaluatePrerequisiteReadiness(targetTopic, learnerTopicStates = [], graph = PREREQUISITE_GRAPH) {
  const canonicalTarget = normalizeTopicName(targetTopic);
  const prereqs = getPrerequisites(canonicalTarget, graph, { transitive: false });

  if (prereqs.length === 0) {
    return {
      targetTopic: canonicalTarget,
      hasPrerequisites: false,
      isReady: true,
      prerequisites: [],
      unmetPrerequisites: [],
      guidance: `${canonicalTarget} is a foundational topic with no prerequisite dependencies.`
    };
  }

  const stateMap = new Map();
  if (Array.isArray(learnerTopicStates)) {
    for (const ts of learnerTopicStates) {
      if (ts && ts.topic) {
        stateMap.set(normalizeTopicName(ts.topic), ts);
      }
    }
  } else if (learnerTopicStates && typeof learnerTopicStates === 'object') {
    for (const [topicKey, val] of Object.entries(learnerTopicStates)) {
      const ts = typeof val === 'object' ? { topic: topicKey, ...val } : { topic: topicKey, state: val };
      stateMap.set(normalizeTopicName(topicKey), ts);
    }
  }

  const evaluatedPrereqs = [];
  const unmetPrereqs = [];

  for (const prereqName of prereqs) {
    const stateInfo = stateMap.get(prereqName);
    const state = stateInfo?.state || stateInfo?.learningState || LEARNING_STATE.UNASSESSED;
    const masteryScore = stateInfo?.masteryScore ?? null;
    const sampleSize = stateInfo?.sampleSize ?? 0;

    // Prerequisite is satisfied if state is developing, proficient, or mastered
    const isMet = (
      state === LEARNING_STATE.DEVELOPING ||
      state === LEARNING_STATE.PROFICIENT ||
      state === LEARNING_STATE.MASTERED
    );

    const item = {
      topic: prereqName,
      state,
      masteryScore,
      sampleSize,
      isMet
    };

    evaluatedPrereqs.push(item);
    if (!isMet) {
      unmetPrereqs.push(item);
    }
  }

  const isReady = unmetPrereqs.length === 0;
  let guidance = '';

  if (isReady) {
    guidance = `All prerequisites for ${canonicalTarget} (${prereqs.join(', ')}) are verified. You are well prepared for this topic.`;
  } else {
    const unmetNames = unmetPrereqs.map((u) => `${u.topic} (${u.state.replace('_', ' ')})`).join(', ');
    guidance = `Foundational gaps or sparse evidence detected in prerequisite topic(s): ${unmetNames}. Prioritize prerequisite remediation to build steady problem-solving momentum.`;
  }

  return {
    targetTopic: canonicalTarget,
    hasPrerequisites: true,
    isReady,
    prerequisites: evaluatedPrereqs,
    unmetPrerequisites: unmetPrereqs,
    guidance
  };
}

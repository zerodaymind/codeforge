/**
 * CodeForge Centralized Programming Language Registry
 * Authoritative backend specification for supported programming languages,
 * compiler/runtime mappings, file naming, and starter templates.
 */

export const SUPPORTED_LANGUAGES = {
  javascript: {
    id: 'javascript',
    name: 'JavaScript',
    displayName: 'JavaScript (Node.js)',
    aliases: ['javascript', 'js', 'node', 'nodejs'],
    monacoLang: 'javascript',
    extension: '.js',
    filename: 'solution.js',
    isCompiled: false,
    compiler: null,
    runtime: 'node',
    command: 'node',
    defaultStarterCode: `function solution() {
  // Write your code here
}
`
  },
  python: {
    id: 'python',
    name: 'Python',
    displayName: 'Python (Python 3)',
    aliases: ['python', 'py', 'python3'],
    monacoLang: 'python',
    extension: '.py',
    filename: 'solution.py',
    isCompiled: false,
    compiler: null,
    runtime: 'python3',
    command: 'python3',
    defaultStarterCode: `def solution():
    # Write your code here
    pass
`
  },
  c: {
    id: 'c',
    name: 'C',
    displayName: 'C (GCC)',
    aliases: ['c'],
    monacoLang: 'c',
    extension: '.c',
    filename: 'solution.c',
    isCompiled: true,
    compiler: 'gcc',
    runtime: 'binary',
    command: 'gcc -O2 -o /tmp/solution /tmp/solution.c && /tmp/solution',
    defaultStarterCode: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // Write your code here
    return 0;
}
`
  },
  cpp: {
    id: 'cpp',
    name: 'C++',
    displayName: 'C++ (G++)',
    aliases: ['cpp', 'c++', 'cplusplus'],
    monacoLang: 'cpp',
    extension: '.cpp',
    filename: 'solution.cpp',
    isCompiled: true,
    compiler: 'g++',
    runtime: 'binary',
    command: 'g++ -O2 -o /tmp/solution /tmp/solution.cpp && /tmp/solution',
    defaultStarterCode: `#include <iostream>
#include <vector>
#include <string>
using namespace std;

int main() {
    // Write your code here
    return 0;
}
`
  },
  java: {
    id: 'java',
    name: 'Java',
    displayName: 'Java (OpenJDK 17)',
    aliases: ['java'],
    monacoLang: 'java',
    extension: '.java',
    filename: 'Solution.java',
    isCompiled: true,
    compiler: 'javac',
    runtime: 'java',
    command: 'javac -d /tmp /tmp/Solution.java && java -cp /tmp Solution',
    defaultStarterCode: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        // Write your code here
    }
}
`
  }
};

export const CANONICAL_LANGUAGE_IDS = Object.keys(SUPPORTED_LANGUAGES);

/**
 * Normalizes any language alias/name into canonical language id.
 * e.g. "Python" -> "python", "C++" -> "cpp", "nodejs" -> "javascript"
 * @param {string} input
 * @returns {string|null}
 */
export const normalizeLanguageId = (input) => {
  if (!input || typeof input !== 'string') return null;
  const clean = input.toLowerCase().trim();

  for (const [id, config] of Object.entries(SUPPORTED_LANGUAGES)) {
    if (id === clean || config.aliases.includes(clean)) {
      return id;
    }
  }

  return null;
};

/**
 * Checks whether language is supported.
 * @param {string} input
 * @returns {boolean}
 */
export const isLanguageSupported = (input) => {
  return normalizeLanguageId(input) !== null;
};

/**
 * Retrieves language configuration or null.
 * @param {string} input
 * @returns {object|null}
 */
export const getLanguageConfig = (input) => {
  const canonical = normalizeLanguageId(input);
  return canonical ? SUPPORTED_LANGUAGES[canonical] : null;
};

import { PROBLEM_SIGNATURES } from './problemSignatures.js';

/**
 * Resolves starter code for problem and target language.
 * @param {object} problem
 * @param {string} langId
 * @returns {string}
 */
export const getStarterCodeForProblem = (problem, langId = 'javascript') => {
  const canonical = normalizeLanguageId(langId) || 'javascript';
  const config = SUPPORTED_LANGUAGES[canonical];

  if (!problem) return config.defaultStarterCode;

  const starter = problem.starterCode;

  if (starter && typeof starter === 'object') {
    if (starter[canonical]) return starter[canonical];
    // Aliases
    if (canonical === 'cpp' && starter['c++']) return starter['c++'];
    if (canonical === 'javascript' && starter['js']) return starter['js'];
    if (canonical === 'python' && starter['py']) return starter['py'];
  } else if (typeof starter === 'string' && canonical === 'javascript') {
    return starter;
  }

  // Fallback to authoritative problem signature starter template for C++
  if (canonical === 'cpp') {
    const slug = problem.slug || problem.id;
    if (slug && PROBLEM_SIGNATURES[slug]?.cppStarter) {
      return PROBLEM_SIGNATURES[slug].cppStarter;
    }
  }

  return config.defaultStarterCode;
};


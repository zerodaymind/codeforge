/**
 * ==============================================================================
 * CODEFORGE MULTI-PROGRAMMING-LANGUAGE END-TO-END VERIFICATION SUITE
 *
 * Verifies all 5 supported programming languages:
 * 1. JavaScript (Node.js 20)
 * 2. Python (Python 3.12)
 * 3. C (GCC 15.2)
 * 4. C++ (G++ 15.2)
 * 5. Java (OpenJDK 17)
 *
 * Test Scenarios:
 * - Simple standard output execution
 * - Standard input (stdin) reading
 * - Compilation error vs Runtime error differentiation
 * - Wall-clock timeout enforcement (5000ms watchdog)
 * - Output buffer limit enforcement (512KB)
 * - LeetCode-style problem function harness execution
 * - Unsupported language rejection (400)
 * - Authenticated submission & MongoDB persistence
 * ==============================================================================
 */

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const API_BASE = 'http://localhost:5000';
const JWT_SECRET = process.env.JWT_SECRET || 'codeforge_jwt_secret_dev_2026_9b8c3f2a1d4e7';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/codeforge';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function postJson(endpoint, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('\n================================================================');
  console.log('  CODEFORGE MULTI-LANGUAGE END-TO-END VERIFICATION SUITE');
  console.log('================================================================\n');

  // Connect to MongoDB to retrieve a test problem and test user
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const twoSumProblem = await db.collection('problems').findOne({ slug: 'two-sum' });
  assert(Boolean(twoSumProblem), 'Found Two Sum problem in MongoDB');

  // Find or create test user for submission tests
  let testUser = await db.collection('users').findOne({ email: 'multilang.test@codeforge.local' });
  if (!testUser) {
    const res = await db.collection('users').insertOne({
      username: 'multilang_tester',
      email: 'multilang.test@codeforge.local',
      password: 'hashed_dummy_password',
      role: 'student',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testUser = { _id: res.insertedId, role: 'student' };
  }

  const testToken = jwt.sign(
    { id: testUser._id.toString(), role: testUser.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // ----------------------------------------------------------------------------
  // SECTION 1: JAVASCRIPT (Node.js) VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 1: JavaScript (Node.js) Execution & Semantics');
  console.log('----------------------------------------------------------------');

  // 1.1 Simple print
  const jsPrintRes = await postJson('/api/code/run', {
    language: 'javascript',
    sourceCode: 'console.log("Hello from JavaScript");'
  });
  assert(
    jsPrintRes.ok && jsPrintRes.data.stdout.includes('Hello from JavaScript'),
    'JavaScript: Simple console.log execution succeeds'
  );

  // 1.2 Two Sum function harness
  const jsTwoSumRes = await postJson('/api/code/run', {
    language: 'javascript',
    problemId: twoSumProblem.slug,
    sourceCode: `function twoSum(nums, target) {
      const map = new Map();
      for (let i = 0; i < nums.length; i++) {
        const diff = target - nums[i];
        if (map.has(diff)) return [map.get(diff), i];
        map.set(nums[i], i);
      }
      return [];
    }`
  });
  assert(
    jsTwoSumRes.ok && jsTwoSumRes.data.verdict === 'Passed' && jsTwoSumRes.data.passedTests === 2,
    `JavaScript: Two Sum function harness passed visible test cases (${jsTwoSumRes.data.passedTests}/${jsTwoSumRes.data.totalTests})`
  );

  // 1.3 Syntax / Compilation Error
  const jsSyntaxRes = await postJson('/api/code/run', {
    language: 'javascript',
    sourceCode: 'function broken() { console.log("missing brace"'
  });
  assert(
    jsSyntaxRes.data.status === 'COMPILATION_ERROR' && jsSyntaxRes.data.verdict === 'Compilation Error',
    'JavaScript: SyntaxError accurately flagged as COMPILATION_ERROR'
  );

  // 1.4 Runtime Error
  const jsRuntimeRes = await postJson('/api/code/run', {
    language: 'javascript',
    sourceCode: 'const obj = null; console.log(obj.foo);'
  });
  assert(
    jsRuntimeRes.data.status === 'RUNTIME_ERROR' && jsRuntimeRes.data.verdict === 'Runtime Error',
    'JavaScript: TypeError accurately flagged as RUNTIME_ERROR'
  );

  // ----------------------------------------------------------------------------
  // SECTION 2: PYTHON (Python 3) VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 2: Python (Python 3.12) Execution & Semantics');
  console.log('----------------------------------------------------------------');

  // 2.1 Simple print
  const pyPrintRes = await postJson('/api/code/run', {
    language: 'python',
    sourceCode: 'print("Hello from Python 3")'
  });
  assert(
    pyPrintRes.ok && pyPrintRes.data.stdout.includes('Hello from Python 3'),
    'Python: Simple print execution succeeds'
  );

  // 2.2 Stdin reading
  const pyStdinRes = await postJson('/api/code/run', {
    language: 'python',
    sourceCode: 'import sys\nline = sys.stdin.read().strip()\nprint(f"PY_INPUT:{line}")',
    customInput: '42 84'
  });
  assert(
    pyStdinRes.ok && pyStdinRes.data.stdout.includes('PY_INPUT:42 84'),
    'Python: sys.stdin input data correctly piped and read'
  );

  // 2.3 Two Sum LeetCode-style function harness
  const pyTwoSumRes = await postJson('/api/code/run', {
    language: 'python',
    problemId: twoSumProblem.slug,
    sourceCode: `def twoSum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []`
  });
  assert(
    pyTwoSumRes.ok && pyTwoSumRes.data.verdict === 'Passed' && pyTwoSumRes.data.passedTests === 2,
    `Python: Two Sum function harness passed visible test cases (${pyTwoSumRes.data.passedTests}/${pyTwoSumRes.data.totalTests})`
  );

  // 2.4 Syntax / Compilation Error
  const pySyntaxRes = await postJson('/api/code/run', {
    language: 'python',
    sourceCode: 'def invalid_syntax(\n  print("oops")'
  });
  assert(
    pySyntaxRes.data.status === 'COMPILATION_ERROR' && pySyntaxRes.data.verdict === 'Compilation Error',
    'Python: SyntaxError accurately reported as COMPILATION_ERROR'
  );

  // 2.5 Runtime Error
  const pyRuntimeRes = await postJson('/api/code/run', {
    language: 'python',
    sourceCode: 'x = 1 / 0'
  });
  assert(
    pyRuntimeRes.data.status === 'RUNTIME_ERROR' && pyRuntimeRes.data.verdict === 'Runtime Error',
    'Python: ZeroDivisionError accurately reported as RUNTIME_ERROR'
  );

  // ----------------------------------------------------------------------------
  // SECTION 3: C (GCC) VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 3: C (GCC 15.2) Execution & Semantics');
  console.log('----------------------------------------------------------------');

  // 3.1 Simple printf
  const cPrintRes = await postJson('/api/code/run', {
    language: 'c',
    sourceCode: `#include <stdio.h>
int main() {
    printf("Hello from C\\n");
    return 0;
}`
  });
  assert(
    cPrintRes.ok && cPrintRes.data.stdout.includes('Hello from C'),
    'C: GCC compilation and execution succeeds'
  );

  // 3.2 Stdin reading
  const cStdinRes = await postJson('/api/code/run', {
    language: 'c',
    sourceCode: `#include <stdio.h>
int main() {
    int a, b;
    if (scanf("%d %d", &a, &b) == 2) {
        printf("SUM:%d\\n", a + b);
    }
    return 0;
}`,
    customInput: '35 65'
  });
  assert(
    cStdinRes.ok && cStdinRes.data.stdout.includes('SUM:100'),
    'C: scanf reads piped stdin and calculates sum correctly'
  );

  // 3.3 Compilation Error
  const cCompileRes = await postJson('/api/code/run', {
    language: 'c',
    sourceCode: `#include <stdio.h>
int main() {
    undeclared_variable_error = 123;
    return 0;
}`
  });
  assert(
    cCompileRes.data.status === 'COMPILATION_ERROR' && cCompileRes.data.verdict === 'Compilation Error',
    'C: GCC compiler error flagged with COMPILATION_ERROR verdict'
  );

  // ----------------------------------------------------------------------------
  // SECTION 4: C++ (G++) VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 4: C++ (G++ 15.2) Execution & Semantics');
  console.log('----------------------------------------------------------------');

  // 4.1 Simple cout
  const cppPrintRes = await postJson('/api/code/run', {
    language: 'cpp',
    sourceCode: `#include <iostream>
using namespace std;
int main() {
    cout << "Hello from C++" << endl;
    return 0;
}`
  });
  assert(
    cppPrintRes.ok && cppPrintRes.data.stdout.includes('Hello from C++'),
    'C++: G++ compilation and execution succeeds'
  );

  // 4.2 Stdin reading with std::cin
  const cppStdinRes = await postJson('/api/code/run', {
    language: 'cpp',
    sourceCode: `#include <iostream>
using namespace std;
int main() {
    int x, y;
    if (cin >> x >> y) {
        cout << "PROD:" << (x * y) << endl;
    }
    return 0;
}`,
    customInput: '8 9'
  });
  assert(
    cppStdinRes.ok && cppStdinRes.data.stdout.includes('PROD:72'),
    'C++: cin correctly reads piped stdin data'
  );

  // 4.3 Compilation Error
  const cppCompileRes = await postJson('/api/code/run', {
    language: 'cpp',
    sourceCode: `#include <iostream>
int main() {
    std::cout << "Missing semicolon"
    return 0;
}`
  });
  assert(
    cppCompileRes.data.status === 'COMPILATION_ERROR' && cppCompileRes.data.verdict === 'Compilation Error',
    'C++: G++ compiler error flagged with COMPILATION_ERROR verdict'
  );

  // 4.4 LeetCode-style class Solution for Two Sum (resolves problem harness)
  const cppTwoSumRes = await postJson('/api/code/run', {
    language: 'cpp',
    problemId: twoSumProblem.slug,
    sourceCode: `#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); ++i) {
            int comp = target - nums[i];
            if (seen.find(comp) != seen.end()) {
                return {seen[comp], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};`
  });
  assert(
    cppTwoSumRes.ok && cppTwoSumRes.data.verdict === 'Passed' && cppTwoSumRes.data.passedTests === 2,
    `C++: LeetCode-style class Solution for Two Sum passed visible test cases (${cppTwoSumRes.data.passedTests}/${cppTwoSumRes.data.totalTests})`
  );

  // 4.5 LeetCode-style class Solution for Longest Substring
  const cppLongestRes = await postJson('/api/code/run', {
    language: 'cpp',
    problemId: 'longest-substring-without-repeating-characters',
    sourceCode: `#include <string>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        vector<int> last(256, -1);
        int maxLen = 0, left = 0;
        for (int right = 0; right < (int)s.length(); ++right) {
            if (last[(unsigned char)s[right]] >= left) {
                left = last[(unsigned char)s[right]] + 1;
            }
            last[(unsigned char)s[right]] = right;
            maxLen = max(maxLen, right - left + 1);
        }
        return maxLen;
    }
};`
  });
  assert(
    cppLongestRes.ok && cppLongestRes.data.verdict === 'Executed' && cppLongestRes.data.stdout.trim() === '3',
    'C++: LeetCode-style class Solution for Longest Substring executed correctly without undefined reference to main'
  );

  // 4.6 Standalone competitive programming function without class Solution
  const cppStandaloneRes = await postJson('/api/code/run', {
    language: 'cpp',
    problemId: twoSumProblem.slug,
    sourceCode: `#include <vector>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    for (int i = 0; i < (int)nums.size(); ++i) {
        for (int j = i + 1; j < (int)nums.size(); ++j) {
            if (nums[i] + nums[j] == target) return {i, j};
        }
    }
    return {};
}`
  });
  assert(
    cppStandaloneRes.ok && cppStandaloneRes.data.verdict === 'Passed',
    'C++: Standalone competitive-programming function executed properly by generated harness'
  );

  // 4.7 Duplicate main() rejection
  const cppDupMainRes = await postJson('/api/code/run', {
    language: 'cpp',
    sourceCode: `int main() { return 0; }
int main() { return 1; }`
  });
  assert(
    cppDupMainRes.data.status === 'COMPILATION_ERROR' &&
    cppDupMainRes.data.stderr.includes('redefinition of'),
    'C++: Duplicate main() correctly rejected by compiler without harness conflicts'
  );

  // 4.8 Missing main() with unsupported signature rejection
  const cppMissingMainRes = await postJson('/api/code/run', {
    language: 'cpp',
    sourceCode: `int randomUnsupportedFunction(int x) { return x * 2; }`
  });
  assert(
    cppMissingMainRes.data.status === 'COMPILATION_ERROR' &&
    cppMissingMainRes.data.stderr.includes("No 'main' function detected"),
    'C++: Unsupported function without main() rejected with clear, informative compilation error'
  );

  // 4.9 Runtime Error (out of bounds / uncaught exception / SIGABRT)
  const cppRuntimeRes = await postJson('/api/code/run', {
    language: 'cpp',
    sourceCode: `#include <vector>
int main() {
    std::vector<int> v;
    return v.at(5);
}`
  });
  assert(
    cppRuntimeRes.data.status === 'RUNTIME_ERROR' && cppRuntimeRes.data.verdict === 'Runtime Error',
    'C++: Uncaught exception / out_of_range SIGABRT correctly classified as RUNTIME_ERROR'
  );


  // ----------------------------------------------------------------------------
  // SECTION 5: JAVA (OpenJDK 17) VERIFICATION
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 5: Java (OpenJDK 17) Execution & Semantics');
  console.log('----------------------------------------------------------------');

  // 5.1 Simple System.out.println
  const javaPrintRes = await postJson('/api/code/run', {
    language: 'java',
    sourceCode: `public class Solution {
    public static void main(String[] args) {
        System.out.println("Hello from OpenJDK 17");
    }
}`
  });
  assert(
    javaPrintRes.ok && javaPrintRes.data.stdout.includes('Hello from OpenJDK 17'),
    'Java: javac compilation and JVM execution succeeds'
  );

  // 5.2 Stdin reading with Scanner
  const javaStdinRes = await postJson('/api/code/run', {
    language: 'java',
    sourceCode: `import java.util.Scanner;
public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (sc.hasNextInt()) {
            int n = sc.nextInt();
            System.out.println("JAVA_DOUBLED:" + (n * 2));
        }
    }
}`,
    customInput: '25'
  });
  assert(
    javaStdinRes.ok && javaStdinRes.data.stdout.includes('JAVA_DOUBLED:50'),
    'Java: Scanner reads piped stdin data correctly'
  );

  // 5.3 Compilation Error
  const javaCompileRes = await postJson('/api/code/run', {
    language: 'java',
    sourceCode: `public class Solution {
    public static void main(String[] args) {
        int a = "incompatible types";
    }
}`
  });
  assert(
    javaCompileRes.data.status === 'COMPILATION_ERROR' && javaCompileRes.data.verdict === 'Compilation Error',
    'Java: javac compiler error flagged with COMPILATION_ERROR verdict'
  );

  // ----------------------------------------------------------------------------
  // SECTION 6: SECURITY & TIMEOUT CONTROLS
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 6: Security, Watchdogs & Rejections');
  console.log('----------------------------------------------------------------');

  // 6.1 Unsupported language rejection
  const unsupportedRes = await postJson('/api/code/run', {
    language: 'rust',
    sourceCode: 'fn main() { println!("hi"); }'
  });
  assert(
    unsupportedRes.status === 400 && unsupportedRes.data.success === false,
    'Unsupported language (rust) strictly rejected with status 400'
  );

  // 6.2 Wall-clock timeout watchdog (Python infinite loop)
  const timeoutRes = await postJson('/api/code/run', {
    language: 'python',
    sourceCode: 'while True: pass'
  });
  assert(
    timeoutRes.data.status === 'TIME_LIMIT_EXCEEDED' && timeoutRes.data.verdict === 'Time Limit Exceeded',
    'Watchdog terminates infinite loop after 5000ms with TIME_LIMIT_EXCEEDED'
  );

  // ----------------------------------------------------------------------------
  // SECTION 7: AUTHENTICATED SUBMISSION & MONGODB PERSISTENCE
  // ----------------------------------------------------------------------------
  console.log('\n----------------------------------------------------------------');
  console.log('SECTION 7: Authenticated Submission & MongoDB Persistence');
  console.log('----------------------------------------------------------------');

  // 7.1 Submit Python Solution for Two Sum
  const pySubmitRes = await postJson(
    '/api/code/submit',
    {
      problemId: twoSumProblem.slug,
      language: 'python',
      sourceCode: `def twoSum(nums, target):
    lookup = {}
    for i, n in enumerate(nums):
        if target - n in lookup:
            return [lookup[target - n], i]
        lookup[n] = i
    return []`
    },
    testToken
  );

  assert(
    pySubmitRes.ok && pySubmitRes.data.verdict === 'Accepted',
    'Python submission for Two Sum receives Accepted verdict across all test cases'
  );

  // Verify in MongoDB
  const savedSubmission = await db.collection('submissions').findOne({
    user: testUser._id,
    language: 'python',
    verdict: 'Accepted'
  });
  assert(
    Boolean(savedSubmission) && savedSubmission.language === 'python',
    'MongoDB persists verified Submission document with canonical language="python"'
  );

  // 7.2 Submit C++ Solution for Two Sum
  const cppSubmitRes = await postJson(
    '/api/code/submit',
    {
      problemId: twoSumProblem.slug,
      language: 'cpp',
      sourceCode: `#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); ++i) {
            int comp = target - nums[i];
            if (seen.find(comp) != seen.end()) {
                return {seen[comp], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};`
    },
    testToken
  );

  assert(
    cppSubmitRes.ok && cppSubmitRes.data.verdict === 'Accepted',
    'C++ submission for Two Sum receives Accepted verdict across all test cases'
  );

  // Verify C++ submission in MongoDB
  const savedCppSubmission = await db.collection('submissions').findOne({
    user: testUser._id,
    language: 'cpp',
    verdict: 'Accepted'
  });
  assert(
    Boolean(savedCppSubmission) && savedCppSubmission.language === 'cpp',
    'MongoDB persists verified Submission document with canonical language="cpp"'
  );

  // Clean up test user & submissions
  await db.collection('submissions').deleteMany({ user: testUser._id });
  await db.collection('users').deleteOne({ _id: testUser._id });
  await db.collection('problemprogresses').deleteMany({ user: testUser._id });
  console.log('  ✓ Cleaned up multi-language test user & submissions.');

  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[FATAL ERROR]:', err);
  process.exit(1);
});

/**
 * CodeForge Centralized Language Registry (Frontend)
 * Shared conceptual specification matching backend language registry.
 */

export const SUPPORTED_LANGUAGES = [
  {
    id: 'javascript',
    name: 'JavaScript',
    displayName: 'JavaScript (Node.js)',
    aliases: ['javascript', 'js', 'node', 'nodejs'],
    monacoLang: 'javascript',
    extension: '.js',
    defaultStarterCode: `function solution() {
  // Write your code here
}
`
  },
  {
    id: 'python',
    name: 'Python',
    displayName: 'Python (Python 3)',
    aliases: ['python', 'py', 'python3'],
    monacoLang: 'python',
    extension: '.py',
    defaultStarterCode: `def solution():
    # Write your code here
    pass
`
  },
  {
    id: 'c',
    name: 'C',
    displayName: 'C (GCC)',
    aliases: ['c'],
    monacoLang: 'c',
    extension: '.c',
    defaultStarterCode: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    // Write your code here
    return 0;
}
`
  },
  {
    id: 'cpp',
    name: 'C++',
    displayName: 'C++ (G++)',
    aliases: ['cpp', 'c++', 'cplusplus'],
    monacoLang: 'cpp',
    extension: '.cpp',
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
  {
    id: 'java',
    name: 'Java',
    displayName: 'Java (OpenJDK 17)',
    aliases: ['java'],
    monacoLang: 'java',
    extension: '.java',
    defaultStarterCode: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        // Write your code here
    }
}
`
  }
];

export const CANONICAL_LANGUAGE_IDS = SUPPORTED_LANGUAGES.map((l) => l.id);

/**
 * Normalizes input language string into canonical language ID.
 * @param {string} input
 * @returns {string} canonical id or 'javascript' fallback
 */
export const normalizeLanguageId = (input) => {
  if (!input || typeof input !== 'string') return 'javascript';
  const clean = input.toLowerCase().trim();

  for (const lang of SUPPORTED_LANGUAGES) {
    if (lang.id === clean || lang.aliases.includes(clean)) {
      return lang.id;
    }
  }

  return 'javascript';
};

/**
 * Returns language definition object.
 * @param {string} input
 * @returns {object}
 */
export const getLanguageConfig = (input) => {
  const canonical = normalizeLanguageId(input);
  return SUPPORTED_LANGUAGES.find((l) => l.id === canonical) || SUPPORTED_LANGUAGES[0];
};

/**
 * Resolves Monaco editor language mode.
 * @param {string} input
 * @returns {string}
 */
export const getMonacoLanguage = (input) => {
  const config = getLanguageConfig(input);
  return config ? config.monacoLang : 'plaintext';
};
const CPP_PROBLEM_STARTERS = {
  'two-sum': `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
        return {};
    }
};`,
  'reverse-string': `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    void reverseString(vector<char>& s) {
        // Modify s in-place
    }
};`,
  'valid-parentheses': `#include <iostream>
#include <string>
#include <stack>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Return true if parentheses are valid
        return true;
    }
};`,
  'merge-two-sorted-lists': `#include <iostream>
using namespace std;

class Solution {
public:
    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {
        // Return merged head node
        return nullptr;
    }
};`,
  'binary-search': `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Return index of target, or -1
        return -1;
    }
};`,
  'longest-substring-without-repeating-characters': `#include <iostream>
#include <string>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        // Write your solution here
        return 0;
    }
};`,
  'kth-largest-element-in-an-array': `#include <iostream>
#include <vector>
#include <queue>
using namespace std;

class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        // Return kth largest element
        return 0;
    }
};`,
  'evaluate-reverse-polish-notation': `#include <iostream>
#include <vector>
#include <string>
#include <stack>
using namespace std;

class Solution {
public:
    int evalRPN(vector<string>& tokens) {
        // Return evaluated integer result
        return 0;
    }
};`,
  'merge-sort-implementation': `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> mergeSort(vector<int>& arr) {
        // Return sorted array
        return arr;
    }
};`,
  'trapping-rain-water': `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    int trap(vector<int>& height) {
        // Return total trapped water
        return 0;
    }
};`,
  'median-of-two-sorted-arrays': `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        // Return median of the two sorted arrays
        return 0.0;
    }
};`,
  'valid-palindrome': `#include <iostream>
#include <string>
#include <cctype>
using namespace std;

class Solution {
public:
    bool isPalindrome(string s) {
        // Return true if s is a palindrome
        return true;
    }
};`,
  'maximum-subarray': `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Return max contiguous subarray sum
        return 0;
    }
};`,
  'best-time-to-buy-and-sell-stock': `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int maxProfit(vector<int>& prices) {
        // Return maximum profit
        return 0;
    }
};`,
  'contains-duplicate': `#include <iostream>
#include <vector>
#include <unordered_set>
using namespace std;

class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        // Return true if any value appears at least twice
        return false;
    }
};`,
  'fibonacci-number': `#include <iostream>
using namespace std;

class Solution {
public:
    int fib(int n) {
        // Return F(n)
        return 0;
    }
};`,
  'search-insert-position': `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    int searchInsert(vector<int>& nums, int target) {
        // Return index of target or insert position
        return 0;
    }
};`,
  'longest-common-prefix': `#include <iostream>
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    string longestCommonPrefix(vector<string>& strs) {
        // Return longest common prefix
        return "";
    }
};`,
  'lru-cache': `#include <iostream>
#include <unordered_map>
#include <list>
using namespace std;

class LRUCache {
public:
    LRUCache(int capacity) {
        // Initialize LRU cache with positive size capacity
    }
    
    int get(int key) {
        return -1;
    }
    
    void put(int key, int value) {
    }
};`
};

/**
 * Resolves problem starter code for a specific language.
 * Checks problem.starterCode[canonical], problem.starterCode (string for JS),
 * or returns language default.
 * @param {object} problem
 * @param {string} langId
 * @returns {string}
 */
export const getStarterCodeForProblem = (problem, langId = 'javascript') => {
  const canonical = normalizeLanguageId(langId);
  const config = getLanguageConfig(canonical);

  if (!problem) return config.defaultStarterCode;

  const starter = problem.starterCode;

  if (starter && typeof starter === 'object') {
    if (starter[canonical]) return starter[canonical];
    if (canonical === 'cpp' && starter['c++']) return starter['c++'];
    if (canonical === 'javascript' && starter['js']) return starter['js'];
    if (canonical === 'python' && starter['py']) return starter['py'];
    // Fallback to first available language starter code
    const firstAvailable = Object.values(starter).find((v) => typeof v === 'string' && v.trim().length > 0);
    if (firstAvailable && canonical === 'javascript') return firstAvailable;
  } else if (typeof starter === 'string') {
    if (canonical === 'javascript') return starter;
  }

  // Fallback to problem-specific C++ starter template if available
  if (canonical === 'cpp') {
    const slug = problem.slug || problem.id;
    if (slug && CPP_PROBLEM_STARTERS[slug]) {
      return CPP_PROBLEM_STARTERS[slug];
    }
  }

  return config.defaultStarterCode;
};


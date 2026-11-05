/**
 * Authoritative Problem Signatures & Starter Code Registry for CodeForge
 * Explicit signatures, types, and parameter mappings for multi-language execution harnesses.
 */

export const PROBLEM_SIGNATURES = {
  'two-sum': {
    slug: 'two-sum',
    title: 'Two Sum',
    methodName: 'twoSum',
    returnType: 'vector<int>',
    params: [
      { name: 'nums', type: 'vector<int>&', baseType: 'vector<int>' },
      { name: 'target', type: 'int', baseType: 'int' }
    ],
    defaultInput: 'nums = [2,7,11,15], target = 9',
    cppStarter: `#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Write your solution here
        return {};
    }
};`
  },
  'reverse-string': {
    slug: 'reverse-string',
    title: 'Reverse String',
    methodName: 'reverseString',
    returnType: 'void',
    isVoidInPlace: true,
    mutatedParam: 's',
    params: [
      { name: 's', type: 'vector<char>&', baseType: 'vector<char>' }
    ],
    defaultInput: 's = ["h","e","l","l","o"]',
    cppStarter: `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    void reverseString(vector<char>& s) {
        // Modify s in-place
    }
};`
  },
  'valid-parentheses': {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    methodName: 'isValid',
    returnType: 'bool',
    params: [
      { name: 's', type: 'string', baseType: 'string' }
    ],
    defaultInput: 's = "()[]{}"',
    cppStarter: `#include <iostream>
#include <string>
#include <stack>
using namespace std;

class Solution {
public:
    bool isValid(string s) {
        // Return true if parentheses are valid
        return true;
    }
};`
  },
  'merge-two-sorted-lists': {
    slug: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    methodName: 'mergeTwoLists',
    returnType: 'ListNode*',
    params: [
      { name: 'list1', type: 'ListNode*', baseType: 'ListNode*' },
      { name: 'list2', type: 'ListNode*', baseType: 'ListNode*' }
    ],
    defaultInput: 'list1 = [1,2,4], list2 = [1,3,4]',
    cppStarter: `#include <iostream>
using namespace std;

// struct ListNode { int val; ListNode *next; ... };

class Solution {
public:
    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {
        // Return merged head node
        return nullptr;
    }
};`
  },
  'binary-search': {
    slug: 'binary-search',
    title: 'Binary Search',
    methodName: 'search',
    returnType: 'int',
    params: [
      { name: 'nums', type: 'vector<int>&', baseType: 'vector<int>' },
      { name: 'target', type: 'int', baseType: 'int' }
    ],
    defaultInput: 'nums = [-1,0,3,5,9,12], target = 9',
    cppStarter: `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Return index of target, or -1
        return -1;
    }
};`
  },
  'longest-substring-without-repeating-characters': {
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    methodName: 'lengthOfLongestSubstring',
    returnType: 'int',
    params: [
      { name: 's', type: 'string', baseType: 'string' }
    ],
    defaultInput: 's = "abcabcbb"',
    cppStarter: `#include <iostream>
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
};`
  },
  'kth-largest-element-in-an-array': {
    slug: 'kth-largest-element-in-an-array',
    title: 'Kth Largest Element in an Array',
    methodName: 'findKthLargest',
    returnType: 'int',
    params: [
      { name: 'nums', type: 'vector<int>&', baseType: 'vector<int>' },
      { name: 'k', type: 'int', baseType: 'int' }
    ],
    defaultInput: 'nums = [3,2,1,5,6,4], k = 2',
    cppStarter: `#include <iostream>
#include <vector>
#include <queue>
using namespace std;

class Solution {
public:
    int findKthLargest(vector<int>& nums, int k) {
        // Return kth largest element
        return 0;
    }
};`
  },
  'evaluate-reverse-polish-notation': {
    slug: 'evaluate-reverse-polish-notation',
    title: 'Evaluate Reverse Polish Notation',
    methodName: 'evalRPN',
    returnType: 'int',
    params: [
      { name: 'tokens', type: 'vector<string>&', baseType: 'vector<string>' }
    ],
    defaultInput: 'tokens = ["2","1","+","3","*"]',
    cppStarter: `#include <iostream>
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
};`
  },
  'merge-sort-implementation': {
    slug: 'merge-sort-implementation',
    title: 'Merge Sort Implementation',
    methodName: 'mergeSort',
    returnType: 'vector<int>',
    params: [
      { name: 'arr', type: 'vector<int>&', baseType: 'vector<int>' }
    ],
    defaultInput: 'arr = [5,2,4,7,1,3,2,6]',
    cppStarter: `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> mergeSort(vector<int>& arr) {
        // Return sorted array
        return arr;
    }
};`
  },
  'trapping-rain-water': {
    slug: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    methodName: 'trap',
    returnType: 'int',
    params: [
      { name: 'height', type: 'vector<int>&', baseType: 'vector<int>' }
    ],
    defaultInput: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]',
    cppStarter: `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    int trap(vector<int>& height) {
        // Return total trapped water
        return 0;
    }
};`
  },
  'median-of-two-sorted-arrays': {
    slug: 'median-of-two-sorted-arrays',
    title: 'Median of Two Sorted Arrays',
    methodName: 'findMedianSortedArrays',
    returnType: 'double',
    params: [
      { name: 'nums1', type: 'vector<int>&', baseType: 'vector<int>' },
      { name: 'nums2', type: 'vector<int>&', baseType: 'vector<int>' }
    ],
    defaultInput: 'nums1 = [1,3], nums2 = [2]',
    cppStarter: `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        // Return median of the two sorted arrays
        return 0.0;
    }
};`
  },
  'valid-palindrome': {
    slug: 'valid-palindrome',
    title: 'Valid Palindrome',
    methodName: 'isPalindrome',
    returnType: 'bool',
    params: [
      { name: 's', type: 'string', baseType: 'string' }
    ],
    defaultInput: 's = "A man, a plan, a canal: Panama"',
    cppStarter: `#include <iostream>
#include <string>
#include <cctype>
using namespace std;

class Solution {
public:
    bool isPalindrome(string s) {
        // Return true if s is a palindrome
        return true;
    }
};`
  },
  'maximum-subarray': {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    methodName: 'maxSubArray',
    returnType: 'int',
    params: [
      { name: 'nums', type: 'vector<int>&', baseType: 'vector<int>' }
    ],
    defaultInput: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
    cppStarter: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Return max contiguous subarray sum
        return 0;
    }
};`
  },
  'best-time-to-buy-and-sell-stock': {
    slug: 'best-time-to-buy-and-sell-stock',
    title: 'Best Time to Buy and Sell Stock',
    methodName: 'maxProfit',
    returnType: 'int',
    params: [
      { name: 'prices', type: 'vector<int>&', baseType: 'vector<int>' }
    ],
    defaultInput: 'prices = [7,1,5,3,6,4]',
    cppStarter: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

class Solution {
public:
    int maxProfit(vector<int>& prices) {
        // Return maximum profit
        return 0;
    }
};`
  },
  'contains-duplicate': {
    slug: 'contains-duplicate',
    title: 'Contains Duplicate',
    methodName: 'containsDuplicate',
    returnType: 'bool',
    params: [
      { name: 'nums', type: 'vector<int>&', baseType: 'vector<int>' }
    ],
    defaultInput: 'nums = [1,2,3,1]',
    cppStarter: `#include <iostream>
#include <vector>
#include <unordered_set>
using namespace std;

class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        // Return true if any value appears at least twice
        return false;
    }
};`
  },
  'fibonacci-number': {
    slug: 'fibonacci-number',
    title: 'Fibonacci Number',
    methodName: 'fib',
    returnType: 'int',
    params: [
      { name: 'n', type: 'int', baseType: 'int' }
    ],
    defaultInput: 'n = 4',
    cppStarter: `#include <iostream>
using namespace std;

class Solution {
public:
    int fib(int n) {
        // Return F(n)
        return 0;
    }
};`
  },
  'search-insert-position': {
    slug: 'search-insert-position',
    title: 'Search Insert Position',
    methodName: 'searchInsert',
    returnType: 'int',
    params: [
      { name: 'nums', type: 'vector<int>&', baseType: 'vector<int>' },
      { name: 'target', type: 'int', baseType: 'int' }
    ],
    defaultInput: 'nums = [1,3,5,6], target = 5',
    cppStarter: `#include <iostream>
#include <vector>
using namespace std;

class Solution {
public:
    int searchInsert(vector<int>& nums, int target) {
        // Return index of target or insert position
        return 0;
    }
};`
  },
  'longest-common-prefix': {
    slug: 'longest-common-prefix',
    title: 'Longest Common Prefix',
    methodName: 'longestCommonPrefix',
    returnType: 'string',
    params: [
      { name: 'strs', type: 'vector<string>&', baseType: 'vector<string>' }
    ],
    defaultInput: 'strs = ["flower","flow","flight"]',
    cppStarter: `#include <iostream>
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    string longestCommonPrefix(vector<string>& strs) {
        // Return longest common prefix
        return "";
    }
};`
  },
  'lru-cache': {
    slug: 'lru-cache',
    title: 'LRU Cache',
    methodName: 'LRUCache',
    isCustomClass: true,
    className: 'LRUCache',
    defaultInput: '["LRUCache", "put", "put", "get"], [[2], [1, 1], [2, 2], [1]]',
    cppStarter: `#include <iostream>
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
  }
};

/**
 * Resolves problem signature using explicit problem slug/id or matching method name in source code.
 * @param {string} [problemId]
 * @param {string} [sourceCode]
 * @returns {object|null}
 */
export const resolveProblemSignature = (problemId, sourceCode = '') => {
  if (problemId && typeof problemId === 'string') {
    const clean = problemId.toLowerCase().trim();
    if (PROBLEM_SIGNATURES[clean]) {
      return PROBLEM_SIGNATURES[clean];
    }
    // Search by title or id
    for (const sig of Object.values(PROBLEM_SIGNATURES)) {
      if (sig.slug === clean || sig.title.toLowerCase() === clean) {
        return sig;
      }
    }
  }

  if (sourceCode && typeof sourceCode === 'string') {
    for (const sig of Object.values(PROBLEM_SIGNATURES)) {
      if (sig.isCustomClass) {
        if (new RegExp(`\\bclass\\s+${sig.className}\\b`).test(sourceCode)) {
          return sig;
        }
      } else {
        if (new RegExp(`\\b${sig.methodName}\\s*\\(`).test(sourceCode)) {
          return sig;
        }
      }
    }
  }

  return null;
};

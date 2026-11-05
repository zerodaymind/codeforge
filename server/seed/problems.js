import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Problem from '../models/Problem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env config from server/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const problemsSeedData = [
  {
    slug: 'two-sum',
    id: 'two-sum',
    title: 'Two Sum',
    description: 'Find two numbers in an array that add up to a specific target value and return their indices.',
    language: 'JavaScript',
    difficulty: 'Easy',
    topic: 'Arrays',
    topics: ['Arrays', 'Hashing'],
    constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', 'Only one valid answer exists.'],
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
      }
    ],
    starterCode: {
      javascript: 'function twoSum(nums, target) {\n  // Write your solution here\n}',
      python: 'def two_sum(nums, target):\n    # Write your solution here\n    pass',
      java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}',
      cpp: 'class Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n        return {};\n    }\n};',
      c: 'int* twoSum(int* nums, int numsSize, int target, int* returnSize) {\n    // Write your solution here\n    return NULL;\n}'
    },
    expectedAnswer: '[0,1]',
    explanation: 'Using a hash map allows looking up complementary values in O(1) time, yielding O(n) overall complexity.'
  },
  {
    slug: 'reverse-string',
    id: 'reverse-string',
    title: 'Reverse String',
    description: 'Reverse an array of characters in-place with O(1) extra memory using recursive or two-pointer approach.',
    language: 'Python',
    difficulty: 'Easy',
    topic: 'Strings',
    topics: ['Strings', 'Recursion'],
    constraints: ['1 <= s.length <= 10^5', 's[i] is a printable ASCII character.'],
    examples: [
      {
        input: 's = ["h","e","l","l","o"]',
        output: '["o","l","l","e","h"]',
        explanation: 'The input string is reversed in-place.'
      }
    ],
    starterCode: {
      javascript: 'function reverseString(s) {\n  // Modify s in-place\n}',
      python: 'def reverse_string(s):\n    # Modify s in-place\n    pass',
      java: 'class Solution {\n    public void reverseString(char[] s) {\n        // Modify s in-place\n    }\n}',
      cpp: 'class Solution {\npublic:\n    void reverseString(vector<char>& s) {\n        // Modify s in-place\n    }\n};',
      c: 'void reverseString(char* s, int sSize) {\n    // Modify s in-place\n}'
    },
    expectedAnswer: '["o","l","l","e","h"]',
    explanation: 'Using two pointers moving toward the center, swap opposing characters until the pointers cross.'
  },
  {
    slug: 'valid-parentheses',
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    description: 'Determine if the input string containing brackets "(", ")", "{", "}", "[" and "]" has valid bracket ordering.',
    language: 'Java',
    difficulty: 'Easy',
    topic: 'Strings',
    topics: ['Strings', 'Stack'],
    constraints: ['1 <= s.length <= 10^4', 's consists of parentheses only "()[]{}"'],
    examples: [
      {
        input: 's = "()[]{}"',
        output: 'true',
        explanation: 'All brackets are closed in valid matching order.'
      }
    ],
    starterCode: {
      javascript: 'function isValid(s) {\n  // Return true if parentheses are valid\n}',
      python: 'def is_valid(s):\n    return True',
      java: 'class Solution {\n    public boolean isValid(String s) {\n        return true;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    bool isValid(string s) {\n        return true;\n    }\n};',
      c: 'bool isValid(char* s) {\n    return true;\n}'
    },
    expectedAnswer: 'true',
    explanation: 'Push open brackets onto a LIFO stack and pop them when matching closing brackets are encountered.'
  },
  {
    slug: 'merge-two-sorted-lists',
    id: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    description: 'Merge two sorted linked lists into one consolidated sorted list and return its head node.',
    language: 'C++',
    difficulty: 'Easy',
    topic: 'Linked List',
    topics: ['Linked List', 'Recursion'],
    constraints: ['0 <= list1.length, list2.length <= 50', '-100 <= Node.val <= 100'],
    examples: [
      {
        input: 'list1 = [1,2,4], list2 = [1,3,4]',
        output: '[1,1,2,3,4,4]',
        explanation: 'The linked lists are merged in non-decreasing order.'
      }
    ],
    starterCode: {
      javascript: 'function mergeTwoLists(list1, list2) {\n  // Return head node\n}',
      python: 'def merge_two_lists(list1, list2):\n    pass',
      java: 'class Solution {\n    public ListNode mergeTwoLists(ListNode list1, ListNode list2) {\n        return null;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    ListNode* mergeTwoLists(ListNode* list1, ListNode* list2) {\n        return nullptr;\n    }\n};',
      c: 'struct ListNode* mergeTwoLists(struct ListNode* list1, struct ListNode* list2) {\n    return NULL;\n}'
    },
    expectedAnswer: '[1,1,2,3,4,4]',
    explanation: 'Iterate through both lists comparing head elements, splicing the smaller node into the merged result.'
  },
  {
    slug: 'binary-search',
    id: 'binary-search',
    title: 'Binary Search',
    description: 'Search for a target integer within an ascending sorted array in logarithmic O(log n) runtime.',
    language: 'C',
    difficulty: 'Easy',
    topic: 'Arrays',
    topics: ['Arrays', 'Searching'],
    constraints: ['1 <= nums.length <= 10^4', '-10^4 < nums[i], target < 10^4', 'All integers in nums are unique.'],
    examples: [
      {
        input: 'nums = [-1,0,3,5,9,12], target = 9',
        output: '4',
        explanation: '9 exists in nums and its index is 4.'
      }
    ],
    starterCode: {
      javascript: 'function search(nums, target) {\n  return -1;\n}',
      python: 'def search(nums, target):\n    return -1',
      java: 'class Solution {\n    public int search(int[] nums, int target) {\n        return -1;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    int search(vector<int>& nums, int target) {\n        return -1;\n    }\n};',
      c: 'int search(int* nums, int numsSize, int target) {\n    return -1;\n}'
    },
    expectedAnswer: '4',
    explanation: 'Bisect the search window repeatedly by comparing the target with the middle element.'
  },
  {
    slug: 'longest-substring-without-repeating-characters',
    id: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    description: 'Find the length of the longest contiguous substring containing distinct characters.',
    language: 'JavaScript',
    difficulty: 'Medium',
    topic: 'Strings',
    topics: ['Strings', 'Hashing'],
    constraints: ['0 <= s.length <= 5 * 10^4', 's consists of English letters, digits, symbols, and spaces.'],
    examples: [
      {
        input: 's = "abcabcbb"',
        output: '3',
        explanation: 'The answer is "abc", with length of 3.'
      }
    ],
    starterCode: {
      javascript: 'function lengthOfLongestSubstring(s) {\n  return 0;\n}',
      python: 'def length_of_longest_substring(s):\n    return 0',
      java: 'class Solution {\n    public int lengthOfLongestSubstring(String s) {\n        return 0;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    int lengthOfLongestSubstring(string s) {\n        return 0;\n    }\n};',
      c: 'int lengthOfLongestSubstring(char* s) {\n    return 0;\n}'
    },
    expectedAnswer: '3',
    explanation: 'Maintain a sliding window with a hash set tracking unique characters in the current substring.'
  },
  {
    slug: 'lru-cache',
    id: 'lru-cache',
    title: 'LRU Cache',
    description: 'Design and implement a data structure for a Least Recently Used (LRU) Cache supporting get and put operations.',
    language: 'Java',
    difficulty: 'Medium',
    topic: 'Linked List',
    topics: ['Linked List', 'Hashing', 'Queue'],
    constraints: ['1 <= capacity <= 3000', '0 <= key <= 10^4', '0 <= value <= 10^5'],
    examples: [
      {
        input: '["LRUCache", "put", "put", "get"], [[2], [1, 1], [2, 2], [1]]',
        output: '[null, null, null, 1]',
        explanation: 'Basic LRU eviction operations.'
      }
    ],
    starterCode: {
      javascript: 'class LRUCache {\n  constructor(capacity) {}\n  get(key) {}\n  put(key, value) {}\n}',
      python: 'class LRUCache:\n    def __init__(self, capacity: int):\n        pass\n    def get(self, key: int) -> int:\n        return -1\n    def put(self, key: int, value: int) -> None:\n        pass',
      java: 'class LRUCache {\n    public LRUCache(int capacity) {}\n    public int get(int key) { return -1; }\n    public void put(int key, int value) {}\n}',
      cpp: 'class LRUCache {\npublic:\n    LRUCache(int capacity) {}\n    int get(int key) { return -1; }\n    void put(int key, int value) {}\n};',
      c: 'typedef struct {} LRUCache;\nLRUCache* lRUCacheCreate(int capacity) { return NULL; }'
    },
    expectedAnswer: '[null, null, null, 1]',
    explanation: 'Combine a doubly linked list with a hash map to achieve O(1) get and put time complexity.'
  },
  {
    slug: 'kth-largest-element-in-an-array',
    id: 'kth-largest-element-in-an-array',
    title: 'Kth Largest Element in an Array',
    description: 'Find the kth largest element in an unsorted array without fully sorting the entire collection.',
    language: 'C++',
    difficulty: 'Medium',
    topic: 'Arrays',
    topics: ['Arrays', 'Sorting', 'Queue'],
    constraints: ['1 <= k <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
    examples: [
      {
        input: 'nums = [3,2,1,5,6,4], k = 2',
        output: '5',
        explanation: 'The 2nd largest element is 5.'
      }
    ],
    starterCode: {
      javascript: 'function findKthLargest(nums, k) {\n  return 0;\n}',
      python: 'def find_kth_largest(nums, k):\n    return 0',
      java: 'class Solution {\n    public int findKthLargest(int[] nums, int k) {\n        return 0;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    int findKthLargest(vector<int>& nums, int k) {\n        return 0;\n    }\n};',
      c: 'int findKthLargest(int* nums, int numsSize, int k) {\n    return 0;\n}'
    },
    expectedAnswer: '5',
    explanation: 'A min-heap of size k retains the k largest numbers; the root node contains the kth largest.'
  },
  {
    slug: 'evaluate-reverse-polish-notation',
    id: 'evaluate-reverse-polish-notation',
    title: 'Evaluate Reverse Polish Notation',
    description: 'Evaluate the value of an arithmetic expression in Reverse Polish Notation using a stack data structure.',
    language: 'Python',
    difficulty: 'Medium',
    topic: 'Stack',
    topics: ['Stack', 'Arrays'],
    constraints: ['1 <= tokens.length <= 10^4', 'Each token is either an operator or an integer in range [-200, 200].'],
    examples: [
      {
        input: 'tokens = ["2","1","+","3","*"]',
        output: '9',
        explanation: '((2 + 1) * 3) = 9'
      }
    ],
    starterCode: {
      javascript: 'function evalRPN(tokens) {\n  return 0;\n}',
      python: 'def eval_rpn(tokens):\n    return 0',
      java: 'class Solution {\n    public int evalRPN(String[] tokens) {\n        return 0;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    int evalRPN(vector<string>& tokens) {\n        return 0;\n    }\n};',
      c: 'int evalRPN(char** tokens, int tokensSize) {\n    return 0;\n}'
    },
    expectedAnswer: '9',
    explanation: 'Push numbers onto a stack; when an operator is reached, pop two operands, compute, and push back the result.'
  },
  {
    slug: 'merge-sort-implementation',
    id: 'merge-sort-implementation',
    title: 'Merge Sort Implementation',
    description: 'Implement divide-and-conquer merge sort to sort an array of integers with stable O(n log n) efficiency.',
    language: 'C',
    difficulty: 'Medium',
    topic: 'Arrays',
    topics: ['Arrays', 'Sorting', 'Recursion'],
    constraints: ['1 <= arr.length <= 10^5', '-10^6 <= arr[i] <= 10^6'],
    examples: [
      {
        input: 'arr = [5,2,4,7,1,3,2,6]',
        output: '[1,2,2,3,4,5,6,7]',
        explanation: 'Sorted using merge sort algorithm.'
      }
    ],
    starterCode: {
      javascript: 'function mergeSort(arr) {\n  return arr;\n}',
      python: 'def merge_sort(arr):\n    return arr',
      java: 'class Solution {\n    public int mergeSort(int[] arr) {\n        return arr;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    vector<int> mergeSort(vector<int>& arr) {\n        return arr;\n    }\n};',
      c: 'void mergeSort(int* arr, int l, int r) {\n    // Implement merge sort\n}'
    },
    expectedAnswer: '[1,2,2,3,4,5,6,7]',
    explanation: 'Divide array into two halves, recursively sort both halves, and merge the sorted halves in linear time.'
  },
  {
    slug: 'trapping-rain-water',
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    description: 'Given n non-negative integers representing an elevation map, compute how much water it can trap after raining.',
    language: 'Python',
    difficulty: 'Hard',
    topic: 'Arrays',
    topics: ['Arrays', 'Stack'],
    constraints: ['n == height.length', '1 <= n <= 2 * 10^4', '0 <= height[i] <= 10^5'],
    examples: [
      {
        input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]',
        output: '6',
        explanation: '6 units of rain water are trapped between elevations.'
      }
    ],
    starterCode: {
      javascript: 'function trap(height) {\n  return 0;\n}',
      python: 'def trap(height):\n    return 0',
      java: 'class Solution {\n    public int trap(int[] height) {\n        return 0;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    int trap(vector<int>& height) {\n        return 0;\n    }\n};',
      c: 'int trap(int* height, int heightSize) {\n    return 0;\n}'
    },
    expectedAnswer: '6',
    explanation: 'Use two pointers keeping track of leftMax and rightMax to compute trapped water at each bar in O(n) time.'
  },
  {
    slug: 'median-of-two-sorted-arrays',
    id: 'median-of-two-sorted-arrays',
    title: 'Median of Two Sorted Arrays',
    description: 'Given two sorted arrays nums1 and nums2, return the median of the two sorted arrays with O(log (m+n)) runtime.',
    language: 'C++',
    difficulty: 'Hard',
    topic: 'Arrays',
    topics: ['Arrays', 'Searching'],
    constraints: ['nums1.length == m', 'nums2.length == n', '0 <= m, n <= 1000', '1 <= m + n <= 2000'],
    examples: [
      {
        input: 'nums1 = [1,3], nums2 = [2]',
        output: '2.00000',
        explanation: 'Merged array = [1,2,3] and median is 2.0.'
      }
    ],
    starterCode: {
      javascript: 'function findMedianSortedArrays(nums1, nums2) {\n  return 0.0;\n}',
      python: 'def find_median_sorted_arrays(nums1, nums2):\n    return 0.0',
      java: 'class Solution {\n    public double findMedianSortedArrays(int[] nums1, int[] nums2) {\n        return 0.0;\n    }\n}',
      cpp: 'class Solution {\npublic:\n    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {\n        return 0.0;\n    }\n};',
      c: 'double findMedianSortedArrays(int* nums1, int nums1Size, int* nums2, int nums2Size) {\n    return 0.0;\n}'
    },
    expectedAnswer: '2.00000',
    explanation: 'Binary search the partition of the smaller array so that elements on left are <= elements on right.'
  }
];

export async function seedProblems() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';
  console.log('[Seed Problems] Connecting to MongoDB:', MONGO_URI);

  let ownConnection = false;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
    ownConnection = true;
  }

  let upsertedCount = 0;
  for (const prob of problemsSeedData) {
    await Problem.findOneAndUpdate(
      { $or: [{ slug: prob.slug }, { id: prob.id }] },
      { $set: prob },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    upsertedCount++;
  }

  console.log(`[Seed Problems] Successfully upserted ${upsertedCount} problems.`);

  if (ownConnection) {
    await mongoose.disconnect();
    console.log('[Seed Problems] Database connection closed.');
  }

  return upsertedCount;
}

// Execute if run directly from terminal
if (process.argv[1] && process.argv[1].endsWith('problems.js')) {
  seedProblems()
    .then((count) => {
      console.log(`[Seed Problems] Done! Total problems seeded: ${count}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Problems] Error seeding problems:', err);
      process.exit(1);
    });
}

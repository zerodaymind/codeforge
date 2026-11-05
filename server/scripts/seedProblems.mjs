import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Problem from '../models/Problem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const problemsCatalog = [
  {
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    difficulty: 'Easy',
    topic: 'Arrays',
    tags: ['Arrays', 'Hash Table'],
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
      }
    ],
    testCases: [
      { input: 'nums = [2,7,11,15], target = 9', expectedOutput: '[0,1]', isHidden: false },
      { input: 'nums = [3,2,4], target = 6', expectedOutput: '[1,2]', isHidden: false },
      { input: 'nums = [3,3], target = 6', expectedOutput: '[0,1]', isHidden: true }
    ],
    constraints: ['2 <= nums.length <= 10^4', '-10^9 <= nums[i] <= 10^9', '-10^9 <= target <= 10^9', 'Only one valid answer exists.'],
    starterCode: 'function twoSum(nums, target) {\n  // Write your code here\n}',
    solutionExplanation: 'Use a hash map to store value-to-index mappings as you iterate through the array. For each number, compute target - num and check if that complement already exists in the map.',
    expectedAnswer: '[0,1]'
  },
  {
    title: 'Reverse String',
    slug: 'reverse-string',
    description: 'Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.',
    difficulty: 'Easy',
    topic: 'Strings',
    tags: ['Strings', 'Two Pointers'],
    examples: [
      {
        input: 's = ["h","e","l","l","o"]',
        output: '["o","l","l","e","h"]',
        explanation: 'The input string array is reversed in-place.'
      }
    ],
    testCases: [
      { input: 's = ["h","e","l","l","o"]', expectedOutput: '["o","l","l","e","h"]', isHidden: false },
      { input: 's = ["H","a","n","n","a","h"]', expectedOutput: '["h","a","n","n","a","H"]', isHidden: true }
    ],
    constraints: ['1 <= s.length <= 10^5', 's[i] is a printable ASCII character.'],
    starterCode: 'function reverseString(s) {\n  // Modify s in-place\n}',
    solutionExplanation: 'Use two pointers initialized at the start and end of the array. Swap the characters and move the pointers toward the center until they cross.',
    expectedAnswer: '["o","l","l","e","h"]'
  },
  {
    title: 'Valid Palindrome',
    slug: 'valid-palindrome',
    description: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Given a string s, return true if it is a palindrome, or false otherwise.',
    difficulty: 'Easy',
    topic: 'Strings',
    tags: ['Strings', 'Two Pointers'],
    examples: [
      {
        input: 's = "A man, a plan, a canal: Panama"',
        output: 'true',
        explanation: '"amanaplanacanalpanama" is a palindrome.'
      }
    ],
    testCases: [
      { input: 's = "A man, a plan, a canal: Panama"', expectedOutput: 'true', isHidden: false },
      { input: 's = "race a car"', expectedOutput: 'false', isHidden: true }
    ],
    constraints: ['1 <= s.length <= 2 * 10^5', 's consists only of printable ASCII characters.'],
    starterCode: 'function isPalindrome(s) {\n  // Return true if palindrome, false otherwise\n}',
    solutionExplanation: 'Filter out non-alphanumeric characters, convert all remaining characters to lowercase, and check if the string equals its reverse using two pointers.',
    expectedAnswer: 'true'
  },
  {
    title: 'Binary Search',
    slug: 'binary-search',
    description: 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1. You must write an algorithm with O(log n) runtime complexity.',
    difficulty: 'Easy',
    topic: 'Searching',
    tags: ['Arrays', 'Binary Search'],
    examples: [
      {
        input: 'nums = [-1,0,3,5,9,12], target = 9',
        output: '4',
        explanation: '9 exists in nums and its index is 4.'
      }
    ],
    testCases: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', expectedOutput: '4', isHidden: false },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', expectedOutput: '-1', isHidden: true }
    ],
    constraints: ['1 <= nums.length <= 10^4', '-10^4 < nums[i], target < 10^4', 'All integers in nums are unique.', 'nums is sorted in ascending order.'],
    starterCode: 'function search(nums, target) {\n  // Return index of target or -1\n}',
    solutionExplanation: 'Maintain low and high pointers. Repeatedly calculate the middle element and adjust pointers depending on whether the target is higher or lower.',
    expectedAnswer: '4'
  },
  {
    title: 'Maximum Subarray',
    slug: 'maximum-subarray',
    description: 'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
    difficulty: 'Medium',
    topic: 'Dynamic Programming',
    tags: ['Arrays', 'Divide and Conquer', 'Dynamic Programming'],
    examples: [
      {
        input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
        output: '6',
        explanation: 'The subarray [4,-1,2,1] has the largest sum 6.'
      }
    ],
    testCases: [
      { input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6', isHidden: false },
      { input: 'nums = [5,4,-1,7,8]', expectedOutput: '23', isHidden: true }
    ],
    constraints: ['1 <= nums.length <= 10^5', '-10^4 <= nums[i] <= 10^4'],
    starterCode: 'function maxSubArray(nums) {\n  // Return maximum subarray sum\n}',
    solutionExplanation: "Kadane's algorithm keeps track of the running maximum sum ending at each position. If the current running sum becomes negative, reset it to the current element.",
    expectedAnswer: '6'
  },
  {
    title: 'Merge Two Sorted Lists',
    slug: 'merge-two-sorted-lists',
    description: 'You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists. Return the head of the merged linked list.',
    difficulty: 'Easy',
    topic: 'Linked List',
    tags: ['Linked List', 'Recursion'],
    examples: [
      {
        input: 'list1 = [1,2,4], list2 = [1,3,4]',
        output: '[1,1,2,3,4,4]',
        explanation: 'The linked lists are merged in non-decreasing order.'
      }
    ],
    testCases: [
      { input: 'list1 = [1,2,4], list2 = [1,3,4]', expectedOutput: '[1,1,2,3,4,4]', isHidden: false },
      { input: 'list1 = [], list2 = [0]', expectedOutput: '[0]', isHidden: true }
    ],
    constraints: ['The number of nodes in both lists is in the range [0, 50].', '-100 <= Node.val <= 100', 'Both lists are sorted in non-decreasing order.'],
    starterCode: 'function mergeTwoLists(list1, list2) {\n  // Return head of merged list\n}',
    solutionExplanation: 'Use a dummy head node and iteratively append the smaller of the two list nodes until one is exhausted, then append remaining nodes.',
    expectedAnswer: '[1,1,2,3,4,4]'
  },
  {
    title: 'Valid Parentheses',
    slug: 'valid-parentheses',
    description: 'Given a string s containing just the characters "(", ")", "{", "}", "[" and "]", determine if the input string is valid. Open brackets must be closed by the same type of brackets and in the correct order.',
    difficulty: 'Easy',
    topic: 'Stack',
    tags: ['String', 'Stack'],
    examples: [
      {
        input: 's = "()[]{}"',
        output: 'true',
        explanation: 'All brackets match and close properly.'
      }
    ],
    testCases: [
      { input: 's = "()[]{}"', expectedOutput: 'true', isHidden: false },
      { input: 's = "(]"', expectedOutput: 'false', isHidden: true }
    ],
    constraints: ['1 <= s.length <= 10^4', 's consists of parentheses only "()[]{}"'],
    starterCode: 'function isValid(s) {\n  // Return true if valid\n}',
    solutionExplanation: 'Push opening brackets onto a stack. When a closing bracket appears, check if the popped element from the stack is its matching opening bracket.',
    expectedAnswer: 'true'
  },
  {
    title: 'Best Time to Buy and Sell Stock',
    slug: 'best-time-to-buy-and-sell-stock',
    description: 'You are given an array prices where prices[i] is the price of a given stock on the ith day. You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock. Return the maximum profit you can achieve.',
    difficulty: 'Easy',
    topic: 'Arrays',
    tags: ['Arrays', 'Dynamic Programming'],
    examples: [
      {
        input: 'prices = [7,1,5,3,6,4]',
        output: '5',
        explanation: 'Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6 - 1 = 5.'
      }
    ],
    testCases: [
      { input: 'prices = [7,1,5,3,6,4]', expectedOutput: '5', isHidden: false },
      { input: 'prices = [7,6,4,3,1]', expectedOutput: '0', isHidden: true }
    ],
    constraints: ['1 <= prices.length <= 10^5', '0 <= prices[i] <= 10^4'],
    starterCode: 'function maxProfit(prices) {\n  // Return maximum profit\n}',
    solutionExplanation: 'Maintain the minimum stock price seen so far while iterating through the array. Calculate profit at each day and keep the maximum profit.',
    expectedAnswer: '5'
  },
  {
    title: 'Contains Duplicate',
    slug: 'contains-duplicate',
    description: 'Given an integer array nums, return true if any value appears at least twice in the array, and return false if every element is distinct.',
    difficulty: 'Easy',
    topic: 'Arrays',
    tags: ['Arrays', 'Hash Table', 'Sorting'],
    examples: [
      {
        input: 'nums = [1,2,3,1]',
        output: 'true',
        explanation: '1 appears twice in nums.'
      }
    ],
    testCases: [
      { input: 'nums = [1,2,3,1]', expectedOutput: 'true', isHidden: false },
      { input: 'nums = [1,2,3,4]', expectedOutput: 'false', isHidden: true }
    ],
    constraints: ['1 <= nums.length <= 10^5', '-10^9 <= nums[i] <= 10^9'],
    starterCode: 'function containsDuplicate(nums) {\n  // Return true if duplicate exists\n}',
    solutionExplanation: 'Insert elements into a Hash Set. If an element already exists in the set, a duplicate is found.',
    expectedAnswer: 'true'
  },
  {
    title: 'Fibonacci Number',
    slug: 'fibonacci-number',
    description: 'The Fibonacci numbers form a sequence where each number is the sum of the two preceding ones, starting from 0 and 1: F(0) = 0, F(1) = 1, and F(n) = F(n - 1) + F(n - 2) for n > 1. Given n, calculate F(n).',
    difficulty: 'Easy',
    topic: 'Dynamic Programming',
    tags: ['Math', 'Dynamic Programming', 'Recursion'],
    examples: [
      {
        input: 'n = 4',
        output: '3',
        explanation: 'F(4) = F(3) + F(2) = 2 + 1 = 3.'
      }
    ],
    testCases: [
      { input: 'n = 4', expectedOutput: '3', isHidden: false },
      { input: 'n = 6', expectedOutput: '8', isHidden: true }
    ],
    constraints: ['0 <= n <= 30'],
    starterCode: 'function fib(n) {\n  // Return F(n)\n}',
    solutionExplanation: 'Iteratively compute from 0 up to n using two variables to store previous values, running in O(n) time and O(1) space.',
    expectedAnswer: '3'
  },
  {
    title: 'Search Insert Position',
    slug: 'search-insert-position',
    description: 'Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return the index where it would be if it were inserted in order. You must write an algorithm with O(log n) runtime complexity.',
    difficulty: 'Easy',
    topic: 'Searching',
    tags: ['Arrays', 'Binary Search'],
    examples: [
      {
        input: 'nums = [1,3,5,6], target = 5',
        output: '2',
        explanation: '5 is found at index 2.'
      },
      {
        input: 'nums = [1,3,5,6], target = 2',
        output: '1',
        explanation: '2 would be inserted at index 1.'
      }
    ],
    testCases: [
      { input: 'nums = [1,3,5,6], target = 5', expectedOutput: '2', isHidden: false },
      { input: 'nums = [1,3,5,6], target = 2', expectedOutput: '1', isHidden: true }
    ],
    constraints: ['1 <= nums.length <= 10^4', '-10^4 <= nums[i], target <= 10^4', 'nums contains distinct values sorted in ascending order.'],
    starterCode: 'function searchInsert(nums, target) {\n  // Return index\n}',
    solutionExplanation: 'Standard binary search. When the search loop ends with low > high, the variable low points to the exact insertion index.',
    expectedAnswer: '2'
  },
  {
    title: 'Longest Common Prefix',
    slug: 'longest-common-prefix',
    description: 'Write a function to find the longest common prefix string amongst an array of strings. If there is no common prefix, return an empty string "".',
    difficulty: 'Easy',
    topic: 'Strings',
    tags: ['Strings', 'Trie'],
    examples: [
      {
        input: 'strs = ["flower","flow","flight"]',
        output: '"fl"',
        explanation: '"fl" is the longest common prefix.'
      }
    ],
    testCases: [
      { input: 'strs = ["flower","flow","flight"]', expectedOutput: '"fl"', isHidden: false },
      { input: 'strs = ["dog","racecar","car"]', expectedOutput: '""', isHidden: true }
    ],
    constraints: ['1 <= strs.length <= 200', '0 <= strs[i].length <= 200', 'strs[i] consists of only lowercase English letters.'],
    starterCode: 'function longestCommonPrefix(strs) {\n  // Return longest common prefix\n}',
    solutionExplanation: 'Initialize prefix with the first string. Iterate through subsequent strings and shrink prefix until each string starts with prefix.',
    expectedAnswer: '"fl"'
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

  const coll = mongoose.connection.collection('problems');
  const legacyDocs = await coll.find({ $or: [{ id: null }, { id: { $exists: false } }] }).toArray();
  for (const doc of legacyDocs) {
    if (doc.slug) {
      await coll.updateOne({ _id: doc._id }, { $set: { id: doc.slug } });
    }
  }

  let count = 0;
  for (const prob of problemsCatalog) {
    const dataToSave = {
      ...prob,
      id: prob.slug,
      topics: prob.tags || [prob.topic],
      tags: prob.tags || [prob.topic],
      explanation: prob.solutionExplanation || prob.explanation
    };
    await Problem.findOneAndUpdate(
      { slug: prob.slug },
      { $set: dataToSave },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    count++;
  }

  console.log(`[Seed Problems] Successfully seeded ${count} practice problems into MongoDB.`);

  if (ownConnection) {
    await mongoose.disconnect();
    console.log('[Seed Problems] MongoDB connection safely closed.');
  }

  return count;
}

// Run directly if invoked from command line
if (process.argv[1] && process.argv[1].endsWith('seedProblems.mjs')) {
  seedProblems()
    .then((count) => {
      console.log(`[Seed Problems] Seeding completed: ${count} problems ready.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Problems] Error during seeding:', err);
      process.exit(1);
    });
}

/**
 * Programming Practice Problems Dataset
 * Static demo dataset supporting filtering across Languages, Difficulties, and Topics.
 */

export const problems = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    description: 'Find two numbers in an array that add up to a specific target value and return their indices.',
    language: 'JavaScript',
    difficulty: 'Easy',
    topics: ['Arrays', 'Hashing']
  },
  {
    id: 'reverse-string',
    title: 'Reverse String',
    description: 'Reverse an array of characters in-place with O(1) extra memory using recursive or two-pointer approach.',
    language: 'Python',
    difficulty: 'Easy',
    topics: ['Strings', 'Recursion']
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    description: 'Determine if the input string containing brackets "(", ")", "{", "}", "[" and "]" has valid bracket ordering.',
    language: 'Java',
    difficulty: 'Easy',
    topics: ['Strings', 'Stack']
  },
  {
    id: 'merge-two-sorted-lists',
    title: 'Merge Two Sorted Lists',
    description: 'Merge two sorted linked lists into one consolidated sorted list and return its head node.',
    language: 'C++',
    difficulty: 'Easy',
    topics: ['Linked List', 'Recursion']
  },
  {
    id: 'binary-search',
    title: 'Binary Search',
    description: 'Search for a target integer within an ascending sorted array in logarithmic O(log n) runtime.',
    language: 'C',
    difficulty: 'Easy',
    topics: ['Arrays', 'Searching']
  },
  {
    id: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    description: 'Find the length of the longest contiguous substring containing distinct characters.',
    language: 'JavaScript',
    difficulty: 'Medium',
    topics: ['Strings', 'Hashing']
  },
  {
    id: 'lru-cache',
    title: 'LRU Cache',
    description: 'Design and implement a data structure for a Least Recently Used (LRU) Cache supporting get and put operations.',
    language: 'Java',
    difficulty: 'Medium',
    topics: ['Linked List', 'Hashing', 'Queue']
  },
  {
    id: 'kth-largest-element-in-an-array',
    title: 'Kth Largest Element in an Array',
    description: 'Find the kth largest element in an unsorted array without fully sorting the entire collection.',
    language: 'C++',
    difficulty: 'Medium',
    topics: ['Arrays', 'Sorting', 'Queue']
  },
  {
    id: 'evaluate-reverse-polish-notation',
    title: 'Evaluate Reverse Polish Notation',
    description: 'Evaluate the value of an arithmetic expression in Reverse Polish Notation using a stack data structure.',
    language: 'Python',
    difficulty: 'Medium',
    topics: ['Stack', 'Arrays']
  },
  {
    id: 'merge-sort-implementation',
    title: 'Merge Sort Implementation',
    description: 'Implement divide-and-conquer merge sort to sort an array of integers with stable O(n log n) efficiency.',
    language: 'C',
    difficulty: 'Medium',
    topics: ['Arrays', 'Sorting', 'Recursion']
  },
  {
    id: 'trapping-rain-water',
    title: 'Trapping Rain Water',
    description: 'Given n non-negative integers representing an elevation map, compute how much water it can trap after raining.',
    language: 'Python',
    difficulty: 'Hard',
    topics: ['Arrays', 'Stack']
  },
  {
    id: 'median-of-two-sorted-arrays',
    title: 'Median of Two Sorted Arrays',
    description: 'Given two sorted arrays nums1 and nums2, return the median of the two sorted arrays with O(log (m+n)) runtime.',
    language: 'C++',
    difficulty: 'Hard',
    topics: ['Arrays', 'Searching']
  }
];

export default problems;

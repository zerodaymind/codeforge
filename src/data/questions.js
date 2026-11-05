/**
 * Assessment & Quiz Questions Dataset
 * JavaScript fundamentals questions covering core syllabus topics:
 * Variables, Data types, Functions, Arrays, Objects, Loops, DOM basics, ES6, Promises, Scope.
 */

export const questions = [
  {
    id: 1,
    topic: 'Variables',
    question: 'Which keyword declares a block-scoped variable in JavaScript that can be reassigned?',
    options: ['var', 'let', 'const', 'static'],
    answer: 'let',
    explanation: "'let' declares a block-scoped local variable that can be reassigned, unlike 'const' which is immutable and 'var' which is function-scoped."
  },
  {
    id: 2,
    topic: 'Data Types',
    question: "What is the output of 'typeof null' in JavaScript?",
    options: ["'null'", "'undefined'", "'object'", "'number'"],
    answer: "'object'",
    explanation: "In JavaScript, 'typeof null' returns 'object' due to a historical legacy implementation quirk in the early days of JavaScript."
  },
  {
    id: 3,
    topic: 'Functions',
    question: "Which of the following functions does NOT have its own 'this' context?",
    options: [
      'Function declaration',
      'Anonymous function expression',
      'Arrow function',
      'Generator function'
    ],
    answer: 'Arrow function',
    explanation: "Arrow functions do not define their own 'this'; they lexically capture the 'this' value of the enclosing execution context."
  },
  {
    id: 4,
    topic: 'Arrays',
    question: 'Which array method creates a new array populated with the results of calling a provided callback function on every element?',
    options: ['forEach()', 'map()', 'filter()', 'reduce()'],
    answer: 'map()',
    explanation: "The 'map()' method iterates over every element, executes the provided function, and returns a new array with the transformed elements without mutating the original array."
  },
  {
    id: 5,
    topic: 'Objects',
    question: 'How do you extract properties from an object into distinct variables using ES6 destructuring?',
    options: [
      'const { a, b } = obj;',
      'const [ a, b ] = obj;',
      'const ( a, b ) = obj;',
      'const < a, b > = obj;'
    ],
    answer: 'const { a, b } = obj;',
    explanation: "Object destructuring uses curly braces matching property keys: 'const { a, b } = obj;' extracts the 'a' and 'b' properties into local constants."
  },
  {
    id: 6,
    topic: 'Loops',
    question: 'Which loop construct is specifically designed to iterate over the enumerable property keys of an object?',
    options: ['for...of', 'for...in', 'while', 'do...while'],
    answer: 'for...in',
    explanation: "'for...in' loops over the enumerable string property keys of an object, whereas 'for...of' iterates over iterable collections such as Arrays or Maps."
  },
  {
    id: 7,
    topic: 'DOM Basics',
    question: 'Which method is the modern standard for selecting the first HTML element matching a specified CSS selector?',
    options: [
      'document.getElementById()',
      'document.getElementsByTagName()',
      'document.querySelector()',
      'document.find()'
    ],
    answer: 'document.querySelector()',
    explanation: "'document.querySelector()' returns the first Element within the document that matches the specified selector or group of CSS selectors."
  },
  {
    id: 8,
    topic: 'ES6',
    question: 'What is the primary effect of the spread operator (...) when applied to an array in JavaScript?',
    options: [
      'Combines an array into a single comma-separated string',
      'Expands an iterable array into individual elements',
      'Converts an array into a JSON string representation',
      'Removes all duplicate values from the array'
    ],
    answer: 'Expands an iterable array into individual elements',
    explanation: "The spread syntax (...) expands an array into individual elements where multiple arguments, elements, or variables are expected."
  },
  {
    id: 9,
    topic: 'Promises',
    question: 'Which method handles rejection or errors in a JavaScript Promise chain?',
    options: ['.then()', '.catch()', '.finally()', '.reject()'],
    answer: '.catch()',
    explanation: "The '.catch()' method registers a callback handler specifically invoked when a Promise is rejected or when an exception is thrown in the Promise chain."
  },
  {
    id: 10,
    topic: 'Scope',
    question: 'What is lexical scoping in JavaScript?',
    options: [
      'Scope determined at runtime based on the call stack',
      'Scope determined by the physical nesting of code and functions at author time',
      'Variables accessible exclusively inside asynchronous callbacks',
      'Global variables automatically attached to the window object'
    ],
    answer: 'Scope determined by the physical nesting of code and functions at author time',
    explanation: "Lexical scope means that variable access is determined by the physical structure and location of functions declared within the source code."
  }
];

export default questions;

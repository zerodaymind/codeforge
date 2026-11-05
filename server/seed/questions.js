import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Question from '../models/Question.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env config
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const questionsSeedData = [
  // -------------------------------------------------------------------------
  // JAVASCRIPT FUNDAMENTALS (IDs 1-10)
  // -------------------------------------------------------------------------
  {
    id: 1,
    topic: 'JavaScript',
    question: 'Which keyword declares a block-scoped variable in JavaScript that can be reassigned?',
    options: ['var', 'let', 'const', 'static'],
    answer: 'let',
    explanation: "'let' declares a block-scoped local variable that can be reassigned, unlike 'const' which is immutable and 'var' which is function-scoped.",
    difficulty: 'Easy',
    points: 1,
    tags: ['Variables', 'JavaScript Fundamentals', 'JavaScript', 'syntax']
  },
  {
    id: 2,
    topic: 'JavaScript',
    question: "What is the output of 'typeof null' in JavaScript?",
    options: ["'null'", "'undefined'", "'object'", "'number'"],
    answer: "'object'",
    explanation: "In JavaScript, 'typeof null' returns 'object' due to a historical legacy implementation quirk in the early days of JavaScript.",
    difficulty: 'Easy',
    points: 1,
    tags: ['Data Types', 'JavaScript Fundamentals', 'JavaScript', 'primitives']
  },
  {
    id: 3,
    topic: 'JavaScript',
    question: "Which of the following functions does NOT have its own 'this' context?",
    options: [
      'Function declaration',
      'Anonymous function expression',
      'Arrow function',
      'Generator function'
    ],
    answer: 'Arrow function',
    explanation: "Arrow functions do not define their own 'this'; they lexically capture the 'this' value of the enclosing execution context.",
    difficulty: 'Medium',
    points: 1,
    tags: ['Functions', 'JavaScript Fundamentals', 'JavaScript', 'arrow-functions']
  },
  {
    id: 4,
    topic: 'JavaScript',
    question: 'Which array method creates a new array populated with the results of calling a provided callback function on every element?',
    options: ['forEach()', 'map()', 'filter()', 'reduce()'],
    answer: 'map()',
    explanation: "The 'map()' method iterates over every element, executes the provided function, and returns a new array with the transformed elements without mutating the original array.",
    difficulty: 'Easy',
    points: 1,
    tags: ['Arrays', 'JavaScript Fundamentals', 'JavaScript', 'methods']
  },
  {
    id: 5,
    topic: 'JavaScript',
    question: 'How do you extract properties from an object into distinct variables using ES6 destructuring?',
    options: [
      'const { a, b } = obj;',
      'const [ a, b ] = obj;',
      'const ( a, b ) = obj;',
      'const < a, b > = obj;'
    ],
    answer: 'const { a, b } = obj;',
    explanation: "Object destructuring uses curly braces matching property keys: 'const { a, b } = obj;' extracts the 'a' and 'b' properties into local constants.",
    difficulty: 'Medium',
    points: 1,
    tags: ['Objects', 'JavaScript Fundamentals', 'JavaScript', 'destructuring']
  },
  {
    id: 6,
    topic: 'JavaScript',
    question: 'Which loop construct is specifically designed to iterate over the enumerable property keys of an object?',
    options: ['for...of', 'for...in', 'while', 'do...while'],
    answer: 'for...in',
    explanation: "'for...in' loops over the enumerable string property keys of an object, whereas 'for...of' iterates over iterable collections such as Arrays or Maps.",
    difficulty: 'Easy',
    points: 1,
    tags: ['Loops', 'JavaScript Fundamentals', 'JavaScript', 'control-flow']
  },
  {
    id: 7,
    topic: 'JavaScript',
    question: 'Which method is the modern standard for selecting the first HTML element matching a specified CSS selector?',
    options: [
      'document.getElementById()',
      'document.getElementsByTagName()',
      'document.querySelector()',
      'document.find()'
    ],
    answer: 'document.querySelector()',
    explanation: "'document.querySelector()' returns the first Element within the document that matches the specified selector or group of CSS selectors.",
    difficulty: 'Easy',
    points: 1,
    tags: ['DOM Basics', 'JavaScript Fundamentals', 'JavaScript', 'dom']
  },
  {
    id: 8,
    topic: 'JavaScript',
    question: 'What is the primary effect of the spread operator (...) when applied to an array in JavaScript?',
    options: [
      'Combines an array into a single comma-separated string',
      'Expands an iterable array into individual elements',
      'Converts an array into a JSON string representation',
      'Removes all duplicate values from the array'
    ],
    answer: 'Expands an iterable array into individual elements',
    explanation: "The spread syntax (...) expands an array into individual elements where multiple arguments, elements, or variables are expected.",
    difficulty: 'Medium',
    points: 1,
    tags: ['ES6', 'JavaScript Fundamentals', 'JavaScript', 'spread']
  },
  {
    id: 9,
    topic: 'JavaScript',
    question: 'Which method handles rejection or errors in a JavaScript Promise chain?',
    options: ['.then()', '.catch()', '.finally()', '.reject()'],
    answer: '.catch()',
    explanation: "The '.catch()' method registers a callback handler specifically invoked when a Promise is rejected or when an exception is thrown in the Promise chain.",
    difficulty: 'Medium',
    points: 1,
    tags: ['Promises', 'JavaScript Fundamentals', 'JavaScript', 'async']
  },
  {
    id: 10,
    topic: 'JavaScript',
    question: 'What is lexical scoping in JavaScript?',
    options: [
      'Scope determined at runtime based on the call stack',
      'Scope determined by the physical nesting of code and functions at author time',
      'Variables accessible exclusively inside asynchronous callbacks',
      'Global variables automatically attached to the window object'
    ],
    answer: 'Scope determined by the physical nesting of code and functions at author time',
    explanation: "Lexical scope means that variable access is determined by the physical structure and location of functions declared within the source code.",
    difficulty: 'Hard',
    points: 1,
    tags: ['Scope', 'JavaScript Fundamentals', 'JavaScript', 'closures']
  },

  // -------------------------------------------------------------------------
  // DATA STRUCTURES & ALGORITHMS (IDs 11-18)
  // -------------------------------------------------------------------------
  {
    id: 11,
    topic: 'Data Structures & Algorithms',
    question: 'What is the average time complexity of searching for an element in a balanced Binary Search Tree (BST)?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    answer: 'O(log n)',
    explanation: 'A balanced BST halves the search space at each level, leading to logarithmic search time complexity O(log n).',
    difficulty: 'Medium',
    points: 1,
    tags: ['Searching', 'Trees', 'BST', 'Data Structures & Algorithms', 'DSA', 'complexity']
  },
  {
    id: 12,
    topic: 'Data Structures & Algorithms',
    question: 'Which data structure operates on a Last-In, First-Out (LIFO) order?',
    options: ['Queue', 'Stack', 'Linked List', 'Binary Heap'],
    answer: 'Stack',
    explanation: 'A Stack is a linear data structure that follows the LIFO principle, where elements are inserted and removed from the same top end.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Stack', 'Data Structures & Algorithms', 'DSA', 'linear-structures']
  },
  {
    id: 13,
    topic: 'Data Structures & Algorithms',
    question: 'What is the worst-case time complexity of QuickSort?',
    options: ['O(n)', 'O(n log n)', 'O(n^2)', 'O(2^n)'],
    answer: 'O(n^2)',
    explanation: 'QuickSort degrades to O(n^2) in the worst case when pivot selection repeatedly creates unbalanced partitions (e.g. sorted input with first element as pivot).',
    difficulty: 'Medium',
    points: 1,
    tags: ['Sorting', 'Data Structures & Algorithms', 'DSA', 'QuickSort', 'complexity']
  },
  {
    id: 14,
    topic: 'Data Structures & Algorithms',
    question: 'Which algorithm finds the shortest path between nodes in a weighted graph with non-negative edge weights?',
    options: ['Dijkstra algorithm', 'Depth-First Search', 'Kruskal algorithm', 'Prim algorithm'],
    answer: 'Dijkstra algorithm',
    explanation: "Dijkstra's algorithm efficiently computes single-source shortest paths on graphs with non-negative weights using a priority queue.",
    difficulty: 'Medium',
    points: 1,
    tags: ['Graphs', 'Searching', 'Data Structures & Algorithms', 'DSA', 'Dijkstra', 'shortest-path']
  },
  {
    id: 15,
    topic: 'Data Structures & Algorithms',
    question: 'What is the amortized time complexity of inserting an element into a dynamic array (like std::vector or ArrayList)?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
    answer: 'O(1)',
    explanation: 'Although doubling the backing array requires O(n) work occasionally, the amortized cost averaged over n insertions remains O(1).',
    difficulty: 'Easy',
    points: 1,
    tags: ['Arrays', 'Data Structures & Algorithms', 'DSA', 'amortized-analysis']
  },
  {
    id: 16,
    topic: 'Data Structures & Algorithms',
    question: 'Which technique involves storing results of expensive subproblems to avoid redundant calculations in recursive algorithms?',
    options: ['Greedy approach', 'Divide and conquer', 'Dynamic programming / Memoization', 'Backtracking'],
    answer: 'Dynamic programming / Memoization',
    explanation: 'Memoization caches previously computed overlapping subproblem results so each subproblem is solved only once.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Recursion', 'Dynamic Programming', 'Data Structures & Algorithms', 'DSA', 'memoization']
  },
  {
    id: 17,
    topic: 'Data Structures & Algorithms',
    question: 'How do you detect a cycle in a singly linked list in O(n) time and O(1) extra space?',
    options: [
      "Floyd's Cycle-Finding Algorithm (Tortoise and Hare)",
      'Breadth-First Search with a visited Set',
      'Hash Table storing node addresses',
      'Reversing the entire linked list'
    ],
    answer: "Floyd's Cycle-Finding Algorithm (Tortoise and Hare)",
    explanation: "Floyd's two-pointer algorithm uses a slow pointer advancing one step and a fast pointer advancing two steps to detect cycles in O(1) auxiliary space.",
    difficulty: 'Hard',
    points: 1,
    tags: ['Linked List', 'Data Structures & Algorithms', 'DSA', 'pointers', 'cycle-detection']
  },
  {
    id: 18,
    topic: 'Data Structures & Algorithms',
    question: 'What is the time complexity of building a Binary Heap from an arbitrary array of n elements?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    answer: 'O(n)',
    explanation: 'Building a heap bottom-up using the heapify operation on internal nodes has a linear aggregate cost of O(n).',
    difficulty: 'Hard',
    points: 1,
    tags: ['Queue', 'Heaps', 'Data Structures & Algorithms', 'DSA', 'trees']
  },

  // -------------------------------------------------------------------------
  // OPERATING SYSTEMS (IDs 19-26)
  // -------------------------------------------------------------------------
  {
    id: 19,
    topic: 'Operating Systems',
    question: 'What is the fundamental difference between a process and a thread?',
    options: [
      'Threads have separate address spaces; processes share address space',
      'Processes have independent address spaces; threads within a process share memory',
      'Processes run exclusively in kernel mode; threads run in user mode',
      'Threads cannot be scheduled independently by the OS'
    ],
    answer: 'Processes have independent address spaces; threads within a process share memory',
    explanation: 'A process is an executing program with its own memory address space, while threads are lightweight units of execution within a process that share code and data sections.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Operating Systems', 'Processes', 'Threads', 'concurrency']
  },
  {
    id: 20,
    topic: 'Operating Systems',
    question: 'Which of the following is NOT one of the four necessary conditions for a deadlock to occur?',
    options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption Allowed', 'Circular Wait'],
    answer: 'Preemption Allowed',
    explanation: 'The Coffman conditions require No Preemption (resources cannot be forcibly taken from a holding process) along with Mutual Exclusion, Hold and Wait, and Circular Wait.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Operating Systems', 'Deadlocks', 'synchronization']
  },
  {
    id: 21,
    topic: 'Operating Systems',
    question: 'What is the primary role of the Translation Lookaside Buffer (TLB)?',
    options: [
      'To cache disk blocks in RAM',
      'To cache virtual-to-physical address translations in hardware',
      'To schedule CPU bursts for user processes',
      'To serialize inter-process socket communications'
    ],
    answer: 'To cache virtual-to-physical address translations in hardware',
    explanation: 'The TLB is a high-speed associative hardware cache that speeds up virtual-to-physical address translation by storing recent page table entries.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Operating Systems', 'Memory', 'virtual-memory', 'TLB']
  },
  {
    id: 22,
    topic: 'Operating Systems',
    question: 'Which CPU scheduling algorithm is preemptive and schedules the process with the shortest remaining execution time?',
    options: ['First-Come, First-Served (FCFS)', 'Round Robin (RR)', 'Shortest Remaining Time First (SRTF)', 'Priority Scheduling'],
    answer: 'Shortest Remaining Time First (SRTF)',
    explanation: 'SRTF is the preemptive version of Shortest Job First (SJF), context-switching to a newly arrived process if its CPU burst is shorter than the currently running process.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Operating Systems', 'CPU Scheduling', 'algorithms']
  },
  {
    id: 23,
    topic: 'Operating Systems',
    question: 'What occurs when a process experiences thrashing?',
    options: [
      'It finishes executing ahead of its allotted CPU quantum',
      'The CPU spends excessive time swapping pages in and out rather than executing instructions',
      'A deadlock terminates all running background processes',
      'All physical memory is converted into swap space'
    ],
    answer: 'The CPU spends excessive time swapping pages in and out rather than executing instructions',
    explanation: 'Thrashing occurs when the system lacks sufficient physical memory for the working sets of active processes, causing continuous page faults and disk I/O.',
    difficulty: 'Hard',
    points: 1,
    tags: ['Operating Systems', 'Virtual Memory', 'paging', 'thrashing']
  },
  {
    id: 24,
    topic: 'Operating Systems',
    question: 'What mechanism allows a user-mode application to request services from the operating system kernel?',
    options: ['System Call (Syscall)', 'Segmentation Fault', 'DMA Transfer', 'Page Fault'],
    answer: 'System Call (Syscall)',
    explanation: 'System calls transition execution from unprivileged user mode to privileged kernel mode via software interrupts or trap instructions.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Operating Systems', 'Kernel', 'syscall', 'architecture']
  },
  {
    id: 25,
    topic: 'Operating Systems',
    question: 'Which synchronization primitive provides an atomic counter and signaling mechanism to control access to a finite set of shared resources?',
    options: ['Spinlock', 'Counting Semaphore', 'Condition Variable', 'Atomic Boolean'],
    answer: 'Counting Semaphore',
    explanation: 'A counting semaphore maintains an integer value decremented on wait (P) and incremented on post (V) to regulate concurrent access.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Operating Systems', 'Synchronization', 'semaphores', 'concurrency']
  },
  {
    id: 26,
    topic: 'Operating Systems',
    question: 'What is an orphan process in Unix-like operating systems?',
    options: [
      'A process that has completed execution but still has an entry in the process table',
      'A process whose parent has terminated, causing it to be adopted by init/systemd (PID 1)',
      'A process that has been suspended by a SIGSTOP signal',
      'A process running without an allocated CPU core'
    ],
    answer: 'A process whose parent has terminated, causing it to be adopted by init/systemd (PID 1)',
    explanation: 'When a parent process terminates before its child, the child becomes an orphan and is re-parented to the init process (PID 1).',
    difficulty: 'Easy',
    points: 1,
    tags: ['Operating Systems', 'Unix', 'process-lifecycle']
  },

  // -------------------------------------------------------------------------
  // COMPUTER NETWORKS (IDs 27-34)
  // -------------------------------------------------------------------------
  {
    id: 27,
    topic: 'Computer Networks',
    question: 'At which layer of the OSI model does the Transmission Control Protocol (TCP) operate?',
    options: ['Network Layer (Layer 3)', 'Transport Layer (Layer 4)', 'Session Layer (Layer 5)', 'Data Link Layer (Layer 2)'],
    answer: 'Transport Layer (Layer 4)',
    explanation: 'TCP operates at Layer 4 (Transport Layer), providing reliable, ordered, and error-checked delivery of byte streams between applications.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Computer Networks', 'OSI', 'TCP', 'Transport']
  },
  {
    id: 28,
    topic: 'Computer Networks',
    question: 'How many packets are exchanged in the standard TCP connection establishment handshake?',
    options: ['2 packets (SYN, ACK)', '3 packets (SYN, SYN-ACK, ACK)', '4 packets (SYN, ACK, DATA, FIN)', '1 packet (CONNECT)'],
    answer: '3 packets (SYN, SYN-ACK, ACK)',
    explanation: 'The TCP three-way handshake establishes a reliable connection: Client sends SYN, Server replies with SYN-ACK, Client acknowledges with ACK.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Computer Networks', 'TCP', 'handshake', 'protocols']
  },
  {
    id: 29,
    topic: 'Computer Networks',
    question: 'What is the default port number used by HTTPS (HTTP Secure) for encrypted web traffic?',
    options: ['80', '443', '8080', '22'],
    answer: '443',
    explanation: 'Port 80 is used for unencrypted HTTP, while port 443 is the standard registered port for HTTPS encrypted with TLS/SSL.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Computer Networks', 'HTTPS', 'ports', 'security']
  },
  {
    id: 30,
    topic: 'Computer Networks',
    question: 'Which protocol translates human-readable domain names into numerical IP addresses?',
    options: ['DHCP', 'ARP', 'DNS', 'ICMP'],
    answer: 'DNS',
    explanation: 'Domain Name System (DNS) resolves human-friendly hostnames (e.g. codeforge.dev) into corresponding IP addresses.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Computer Networks', 'DNS', 'IP', 'protocols']
  },
  {
    id: 31,
    topic: 'Computer Networks',
    question: 'Which protocol maps a known IPv4 address to a physical Media Access Control (MAC) address on a local area network?',
    options: ['ARP (Address Resolution Protocol)', 'RARP', 'NAT', 'BGP'],
    answer: 'ARP (Address Resolution Protocol)',
    explanation: 'ARP broadcasts queries on the local subnet to discover the MAC hardware address corresponding to a given IP address.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Computer Networks', 'ARP', 'mac-address', 'ethernet']
  },
  {
    id: 32,
    topic: 'Computer Networks',
    question: 'What is a key difference between TCP and UDP?',
    options: [
      'UDP guarantees packet order; TCP does not',
      'TCP is connection-oriented and reliable; UDP is connectionless and best-effort',
      'UDP performs congestion control and flow control; TCP does not',
      'TCP headers are smaller than UDP headers'
    ],
    answer: 'TCP is connection-oriented and reliable; UDP is connectionless and best-effort',
    explanation: 'TCP provides reliable, sequenced delivery with flow control and retransmissions, whereas UDP minimizes latency with minimal connectionless overhead.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Computer Networks', 'TCP', 'UDP', 'transport']
  },
  {
    id: 33,
    topic: 'Computer Networks',
    question: 'What does the Time to Live (TTL) field in an IPv4 packet header prevent?',
    options: [
      'Data corruption during transmission',
      'Packets from circulating endlessly in routing loops',
      'Man-in-the-middle eavesdropping',
      'TCP buffer overflow on receiving hosts'
    ],
    answer: 'Packets from circulating endlessly in routing loops',
    explanation: 'TTL is decremented by each router along the path; when it reaches 0, the packet is discarded and an ICMP Time Exceeded message is returned.',
    difficulty: 'Hard',
    points: 1,
    tags: ['Computer Networks', 'IPv4', 'TTL', 'routing']
  },
  {
    id: 34,
    topic: 'Computer Networks',
    question: 'Which HTTP response status code indicates that the requested resource cannot be found on the server?',
    options: ['200 OK', '403 Forbidden', '404 Not Found', '500 Internal Server Error'],
    answer: '404 Not Found',
    explanation: 'HTTP 404 indicates that the server cannot locate the requested URI or that the resource does not exist.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Computer Networks', 'HTTP', 'status-codes', 'web']
  },

  // -------------------------------------------------------------------------
  // CYBERSECURITY (IDs 35-42)
  // -------------------------------------------------------------------------
  {
    id: 35,
    topic: 'Cybersecurity',
    question: 'What web application vulnerability occurs when untrusted user input is directly concatenated into a SQL database query?',
    options: ['Cross-Site Scripting (XSS)', 'SQL Injection (SQLi)', 'Cross-Site Request Forgery (CSRF)', 'Server-Side Request Forgery (SSRF)'],
    answer: 'SQL Injection (SQLi)',
    explanation: 'SQL Injection allows attackers to manipulate backend database queries when unsanitized user inputs are executed as SQL commands.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Cybersecurity', 'SQLi', 'web-security', 'owasp']
  },
  {
    id: 36,
    topic: 'Cybersecurity',
    question: 'Which hashing algorithm is considered cryptographically insecure and vulnerable to collision attacks for digital certificates?',
    options: ['SHA-256', 'bcrypt', 'MD5', 'Argon2id'],
    answer: 'MD5',
    explanation: 'MD5 is vulnerable to rapid hash collisions and should never be used for security-critical integrity or password hashing.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Cybersecurity', 'cryptography', 'hashing', 'MD5']
  },
  {
    id: 37,
    topic: 'Cybersecurity',
    question: 'What is the primary function of a salt added during password hashing?',
    options: [
      'To encrypt the password using a symmetric secret key',
      'To prevent precomputed rainbow table attacks by ensuring unique hashes for identical passwords',
      'To compress passwords before database persistence',
      'To enable reversible password recovery by system administrators'
    ],
    answer: 'To prevent precomputed rainbow table attacks by ensuring unique hashes for identical passwords',
    explanation: 'A unique cryptographic salt added to each password ensures that two identical passwords produce completely distinct hashes, defeating rainbow tables.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Cybersecurity', 'passwords', 'salts', 'hashing']
  },
  {
    id: 38,
    topic: 'Cybersecurity',
    question: 'What type of vulnerability allows an attacker to inject client-side scripts into web pages viewed by other users?',
    options: ['Cross-Site Scripting (XSS)', 'SQL Injection', 'Buffer Overflow', 'Denial of Service (DoS)'],
    answer: 'Cross-Site Scripting (XSS)',
    explanation: 'XSS enables attackers to inject malicious JavaScript into web applications, executing within the context of victims browsers.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Cybersecurity', 'XSS', 'web-security', 'client-side']
  },
  {
    id: 39,
    topic: 'Cybersecurity',
    question: 'In asymmetric cryptography (Public Key Infrastructure), which key is used to decrypt a message encrypted with a public key?',
    options: ['The public key', 'The corresponding private key', 'A shared secret session key', 'A digital certificate authority key'],
    answer: 'The corresponding private key',
    explanation: 'Asymmetric encryption uses key pairs: data encrypted with the recipient public key can only be decrypted by the matching private key.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Cybersecurity', 'cryptography', 'asymmetric', 'PKI']
  },
  {
    id: 40,
    topic: 'Cybersecurity',
    question: 'Which HTTP response header helps protect against Cross-Site Scripting (XSS) and data injection attacks by restricting allowed resource origins?',
    options: ['Content-Security-Policy (CSP)', 'Strict-Transport-Security (HSTS)', 'X-Frame-Options', 'Access-Control-Allow-Origin'],
    answer: 'Content-Security-Policy (CSP)',
    explanation: 'CSP is an HTTP header that allows site operators to restrict the resources (such as JavaScript, CSS, Images) that the browser is allowed to load.',
    difficulty: 'Medium',
    points: 1,
    tags: ['Cybersecurity', 'headers', 'CSP', 'XSS']
  },
  {
    id: 41,
    topic: 'Cybersecurity',
    question: 'What is the primary purpose of Multi-Factor Authentication (MFA)?',
    options: [
      'To shorten password length requirements',
      'To verify identity using two or more independent factors: knowledge, possession, or inherence',
      'To encrypt internet traffic using TLS certificates',
      'To automatically reset compromised user credentials'
    ],
    answer: 'To verify identity using two or more independent factors: knowledge, possession, or inherence',
    explanation: 'MFA enhances security by requiring multiple verification categories, ensuring a compromised password alone is insufficient for unauthorized access.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Cybersecurity', 'authentication', 'MFA', 'identity']
  },
  {
    id: 42,
    topic: 'Cybersecurity',
    question: 'Which of the following describes a Denial-of-Service (DoS) attack?',
    options: [
      'Stealing user authentication tokens from local storage',
      'Overwhelming a target system or network with traffic to make services unavailable to legitimate users',
      'Intercepting and modifying unencrypted network packets in transit',
      'Escalating privileges to root or administrator within the operating system'
    ],
    answer: 'Overwhelming a target system or network with traffic to make services unavailable to legitimate users',
    explanation: 'A DoS attack floods servers, systems, or networks with traffic to exhaust resources and bandwidth, rendering them unavailable.',
    difficulty: 'Easy',
    points: 1,
    tags: ['Cybersecurity', 'DoS', 'network-attacks', 'availability']
  }
];

export async function seedQuestions() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codeforge';
  console.log('[Seed Questions] Connecting to MongoDB:', MONGO_URI);

  let ownConnection = false;
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(MONGO_URI);
    ownConnection = true;
  }

  let upsertedCount = 0;
  for (const q of questionsSeedData) {
    await Question.findOneAndUpdate(
      { id: q.id },
      {
        $set: {
          ...q,
          difficulty: q.difficulty || 'Medium',
          status: q.status || 'active',
          points: q.points || 1,
          type: 'multiple-choice'
        }
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    upsertedCount++;
  }

  console.log(`[Seed Questions] Successfully upserted ${upsertedCount} questions.`);

  if (ownConnection) {
    await mongoose.disconnect();
    console.log('[Seed Questions] Database connection closed.');
  }

  return upsertedCount;
}

// Execute if run directly from terminal
if (process.argv[1] && process.argv[1].endsWith('questions.js')) {
  seedQuestions()
    .then((count) => {
      console.log(`[Seed Questions] Done! Total questions seeded: ${count}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Questions] Error seeding questions:', err);
      process.exit(1);
    });
}

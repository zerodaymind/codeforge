# CodeForge — Programming Practice & Technical Assessment Platform

[![Node.js Version](https://img.shields.io/badge/Node.js-v20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React Version](https://img.shields.io/badge/React-v19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-v5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-v7-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Sandboxed-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Vite](https://img.shields.io/badge/Vite-v8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**CodeForge** is an enterprise-grade full-stack programming practice, assessment, and algorithmic evaluation platform. Engineered with a decoupled three-tier architecture, it features microsegmented Docker code sandboxing, authoritative server-side quiz assessment, adaptive learning competency analytics, and role-based access control.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Multi-Language Execution Engine](#multi-language-execution-engine)
- [Security & Defense-in-Depth](#security--defense-in-depth)
- [Screenshots Showcase](#screenshots-showcase)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Database Seeding](#database-seeding)
  - [Administrator Provisioning](#administrator-provisioning)
  - [Running Locally](#running-locally)
- [Docker Compose Orchestration](#docker-compose-orchestration)
- [Verification & Automated Test Suite](#verification--automated-test-suite)
- [Project Directory Structure](#project-directory-structure)
- [Author & Academic Attribution](#author--academic-attribution)
- [License](#license)

---

## Overview

CodeForge bridges the gap between hands-on algorithmic problem solving and structured academic assessment. Learners write and verify solutions across multiple languages in an isolated runtime environment, while administrators build and publish quizzes, manage problem banks, and inspect comprehensive audit trails.

---

## Key Features

- **Microsegmented Code Execution**: Untrusted code executes inside ephemeral Docker containers stripped of Linux kernel capabilities (`--cap-drop ALL`), isolated from the network (`--network none`), with read-only root filesystems and tight CPU, memory (128MB), and PID bounds.
- **Timing-Safe Inter-Service Authentication**: Dedicated internal runner microservice communicates with the backend via canonical HMAC-SHA256 request signing, nonced replay prevention, and bounded timestamp windows (±60s).
- **Interactive Monaco Editor**: Integrated Microsoft Monaco editor with syntax highlighting, indentation guides, theme switching, auto-save drafts, and live stdin/stdout execution consoles.
- **Adaptive Competency Analytics**: Multi-source skill tracking analyzing problem attempts, quiz outcomes, and diagnostic assessments to surface personalized practice pathways.
- **Authoritative Quiz Assessment**: Server-side timed scoring engine with randomized question sets, immutable attempt reviews, and category-level mastery metrics.
- **Role-Based Access Control (RBAC)**: Fine-grained user and administrator privilege separation with real-time privilege revocation upon demotion and bcrypt password hashing.
- **Production Hardening**: Helmet security headers, dynamic CORS allowlists, IP-based brute force protection, NoSQL query injection sanitization, and automated BSON database backup/restore utilities.

---

## System Architecture

CodeForge uses a decoupled, three-tier microsegmented network topology:

```
                                 [ Client Browser ]
                                         │
                                         ▼ HTTPS / 80
                             [ Nginx Reverse Proxy / SPA ]
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                 Static Assets (Vite)            API Gateway (/api)
                                                         │
                                                         ▼
                                            [ Express API Backend ]
                                                         │
                        ┌────────────────────────────────┴────────────────────────────────┐
                        │ (data-net: internal)                                            │ (runner-net: internal)
                        ▼                                                                 ▼
              [ MongoDB Cluster ]                                             [ Runner Microservice ]
              • Replica Set                                                   • HMAC-SHA256 Verified
              • Isolated Storage                                              • Ephemeral Docker Sandbox
                                                                              • --network none
                                                                              • --read-only / tmpfs
                                                                              • --cap-drop ALL
                                                                              • Memory: 128MB | PIDs: 64
```

### Microsegmentation Highlights
1. **`frontend-net`**: Connects the public reverse proxy and client to the API backend.
2. **`data-net`**: Strictly internal bridge (`internal: true`). Only the backend can access MongoDB. Runner and public frontend have zero route to the database.
3. **`runner-net`**: Strictly internal bridge (`internal: true`). Only the backend can send execution jobs to the runner daemon. Outbound internet access is disabled.

---

## Multi-Language Execution Engine

CodeForge executes code across four core programming languages in an isolated execution sandbox:

| Language | Runtime / Compiler | Compilation Command | Execution Command | Memory Limit | Timeout |
|---|---|---|---|---|---|
| **JavaScript** | Node.js v20.x | Interpreted | `node solution.js` | 128 MB | 5000 ms |
| **Python** | Python 3.10.x | Interpreted | `python3 solution.py` | 128 MB | 5000 ms |
| **C++** | GCC / G++ 11.x | `g++ -O2 -std=c++17 solution.cpp` | `./a.out` | 128 MB | 5000 ms |
| **Java** | OpenJDK 17 | `javac Solution.java` | `java -Xmx128m Solution` | 128 MB | 5000 ms |

### Fail-Closed Execution Safety
If Docker is unavailable or degraded, the platform fails closed: requests return `503 Service Unavailable` with `SANDBOX_UNAVAILABLE`. Untrusted user code is **never** executed directly on the host operating system, via `eval()`, or via `new Function()`.

---

## Security & Defense-in-Depth

- **Zero Hardcoded Secrets**: All cryptographic keys, database URIs, and inter-service secrets are configured via environment variables and validated at server boot.
- **Timing-Safe HMAC Verification**: Inter-service runner calls use `crypto.timingSafeEqual` with byte-padding to defeat timing and length-leak attacks.
- **Rate Limiting**:
  - General API: 300 requests per 15-minute window.
  - Authentication (Login/Register): 15 attempts per 15-minute window per IP.
  - Code Execution: 20 executions per minute per IP.
- **NoSQL Injection Defense**: Recursive query sanitization purges `$` operators and dot-notation paths from all request bodies, query strings, and route parameters.
- **Container Isolation**: Untrusted code runs under an unprivileged user (`node`, UID 1000) with `no-new-privileges: true` and all Linux kernel capabilities dropped.

---

## Screenshots Showcase

### Modern Algorithmic Practice Workspace
![Monaco Editor Execution Workspace](screenshots/Screenshot%202026-10-31%20072729.png)

### Intuitive Landing Page & Problem Catalog
![CodeForge Landing Page](screenshots/Screenshot%202026-10-30%20191847.png)

### Interactive Computer Science Assessment Engine
![Cybersecurity Quiz Engine](screenshots/Screenshot%202026-10-31%20074216.png)

### Evidence-Based Competency Analytics
![Competency Snapshot Dashboard](screenshots/Screenshot%202026-10-31%20074417.png)

---

## Getting Started

### Prerequisites

Ensure you have the following installed on your host machine:

- **Node.js**: v18.0.0 or higher (v20 LTS recommended)
- **npm**: v9.0.0 or higher
- **MongoDB**: v6.0 or higher running locally on port 27017 (or MongoDB Atlas connection string)
- **Docker Desktop**: Required for containerized code execution

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/zerodaymind/codeforge.git
   cd codeforge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Copy the example environment configuration files:

```bash
# Root environment configuration (Vite frontend & Docker Compose)
cp .env.example .env

# Server environment configuration (API backend & Runner microservice)
cp server/.env.example server/.env
```

Open `server/.env` and configure your credentials:
- Set `JWT_SECRET` to a cryptographically secure random string (at least 32 characters, e.g. `openssl rand -base64 48`).
- Set `RUNNER_SHARED_SECRET` to a cryptographically secure random string (at least 32 characters, e.g. `openssl rand -base64 32`).
- Verify `MONGO_URI` points to your active MongoDB instance.

### Database Seeding

Populate the database with initial coding problems, questions, and sample quizzes:

```bash
# Seed Algorithmic Practice Problems
npm run seed:problems

# Seed Assessment Question Bank
npm run seed:questions

# Seed Sample Quizzes
npm run seed:quizzes
```

### Administrator Provisioning

CodeForge prohibits default administrator passwords. To provision or promote an administrative account, explicitly supply the credentials via environment variables or CLI arguments:

```bash
# Option A: Using environment variables
ADMIN_EMAIL="admin@yourdomain.com" ADMIN_PASSWORD="YourStrongPassword123!" npm run admin:provision

# Option B: Using CLI arguments
node server/scripts/provisionAdmin.mjs admin@yourdomain.com YourStrongPassword123! "Administrator Name"
```

### Running Locally

Run each service in separate terminal windows:

1. **Start the Code Execution Runner**:
   ```bash
   npm run runner
   ```
   *Runs on `http://127.0.0.1:5050`.*

2. **Start the Express API Backend**:
   ```bash
   npm run server
   ```
   *Runs on `http://localhost:5000`.*

3. **Start the Vite Frontend Client**:
   ```bash
   npm run dev
   ```
   *Runs on `http://localhost:5173`.*

Open `http://localhost:5173` in your browser.

---

## Docker Compose Orchestration

To run the complete production-like stack using Docker Compose:

```bash
# Build and run all services in detached mode
docker compose up -d --build
```

The stack orchestrates:
- `codeforge-frontend`: Nginx reverse proxy serving the built SPA on port 80.
- `codeforge-backend`: Express API server listening internally on port 5000.
- `codeforge-runner`: Isolated runner microservice on `runner-net` managing container execution.
- `codeforge-mongodb`: MongoDB 7.0 database engine on `data-net`.

Check health status:
```bash
curl http://localhost/api/health/ready
```

---

## Verification & Automated Test Suite

CodeForge includes a comprehensive regression test suite covering authentication, sandboxing, rate limiting, and security remediations:

| Test Command | Scope & Verification Target |
|---|---|
| `npm run lint` | Fast static analysis across all files via `oxlint` |
| `npm run build` | Production Vite bundle build with vendor chunk isolation |
| `npm run test:runner` | Verified isolated runner microservice & HMAC authentication |
| `npm run test:rate-limit` | Verifies sliding-window rate limiters across all API tiers |
| `npm run test:multilang` | Automated execution across JavaScript, Python, C++, and Java |
| `npm run test:sandbox` | Docker sandbox security boundary inspection (`--network none`, `--cap-drop`) |
| `npm run test:nginx` | Nginx reverse proxy security header and CSP validation |
| `npm run test:bson-backup`| BSON database backup and point-in-time restore verification |
| `npm run test:audit` | Comprehensive end-to-end security integration audit |

---

## Project Directory Structure

```
CodeForge/
├── .env.example                     # Root environment template
├── .gitignore                       # Repository exclusion rules
├── docker-compose.yml               # Production-like multi-container stack
├── Dockerfile                       # Backend API container definition
├── Dockerfile.frontend              # Nginx frontend container definition
├── Dockerfile.runner                # Dedicated runner daemon container definition
├── Dockerfile.sandbox               # Multi-language execution sandbox image
├── package.json                     # Scripts and project dependencies
├── vite.config.js                   # Vite configuration with chunk splitting
├── screenshots/                     # Platform UI showcase screenshots
├── docs/                            # Architecture and deployment specifications
│   ├── PRODUCTION_READINESS.md      # Production hardening and threat model
│   └── architecture-isolated-runner.md # Microservice runner architecture
├── server/                          # Backend application
│   ├── config/                      # Environment and database configuration
│   ├── controllers/                 # Express route controllers
│   ├── middleware/                  # Security, auth, and observability middleware
│   ├── models/                      # Mongoose schemas and models
│   ├── routes/                      # API endpoint definitions
│   ├── runner/                      # Isolated execution runner microservice
│   │   ├── runnerAuthMiddleware.js  # Timing-safe HMAC-SHA256 authentication
│   │   ├── runnerExecutionService.js# Docker container lifecycle manager
│   │   ├── runnerServer.js          # Dedicated runner HTTP service
│   │   └── runnerSigning.js         # Canonical HMAC request signing
│   ├── scripts/                     # Operational maintenance scripts
│   │   ├── backupDatabase.mjs       # Automated JSON database backup
│   │   ├── provisionAdmin.mjs       # Explicitly authenticated admin provisioner
│   │   ├── restoreDatabase.mjs      # Database restore with confirmation guard
│   │   └── seedProblems.mjs         # Practice problem catalog seeder
│   └── server.js                    # Express application entrypoint
└── src/                             # React 19 Frontend application
    ├── assets/                      # Static branding assets and images
    ├── components/                  # Reusable UI components and Monaco editor
    ├── context/                     # Authentication and theme state contexts
    ├── layouts/                     # Application shell and responsive layouts
    ├── pages/                       # Route views (Editor, Quiz, Dashboard, etc.)
    └── utils/                       # API helpers and client validation
```

---

## Author & Academic Attribution

Developed by **Prajwal BM** ([@zerodaymind](https://github.com/zerodaymind)) as a Capstone Project at **Vellore Institute of Technology (VIT)**, Vellore, Tamil Nadu, India.

### Faculty Guide
- **Prof. KAVITHA B**
- School of Computer Science Engineering and Information Systems (SCORE)
- Vellore Institute of Technology (VIT), Vellore

---

## License

This project is licensed under the [MIT License](LICENSE).

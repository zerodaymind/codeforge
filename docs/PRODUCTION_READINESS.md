# CodeForge — Production Readiness & Deployment Guide

This document defines the production architecture, security controls, environment configuration, observability, deployment workflows, backup/recovery, and threat model for **CodeForge**.

---

## 1. System Architecture

CodeForge uses a decoupled, three-tier architecture:

```
[ Client Browser ]
        │  HTTPS / WSS
        ▼
[ Reverse Proxy / Nginx ]
   ├── Static Frontend Assets (React SPA / Vite Build)
   └── /api/ Reverse Proxy (Load Balanced)
        │
        ▼
[ Node.js + Express Backend ] ─── [ Local Docker Engine API ]
   │                                     │
   │  MongoDB Driver                     ▼ (Isolated Ephemeral Containers)
   ▼                                [ node:20-alpine Sandbox ]
[ MongoDB (Replica Set / Auth) ]       • --network none
                                       • --user node
                                       • --read-only
                                       • --security-opt no-new-privileges:true
                                       • --cap-drop ALL
                                       • memory: 128MB, cpu: 0.5, pids: 64
```

---

## 2. Environment Configuration Reference

### Backend (`server/.env` / Container Environment)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Port for the HTTP server to bind. Must be a valid TCP port (1–65535). |
| `NODE_ENV` | No | `development` | Runtime mode: `development`, `production`, or `test`. Enforces strict JWT length and secret rules in `production`. |
| `MONGO_URI` | **Yes** | — | MongoDB connection string. Must start with `mongodb://` or `mongodb+srv://`. |
| `JWT_SECRET` | **Yes** | — | Cryptographic secret for signing tokens. In `production`, must be $\ge 32$ characters and cannot contain trivial dictionary words. |
| `CORS_ORIGIN` | No | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowlist of permitted origins. |
| `REQUEST_BODY_LIMIT` | No | `100kb` | Maximum size for incoming JSON and urlencoded request payloads. |
| `MAX_CONCURRENT_EXECUTIONS` | No | `5` | Maximum number of simultaneous Docker container executions before applying backpressure. |
| `RUNNER_SERVICE_URL` | No | `http://127.0.0.1:5050` | Microservice URL for the isolated execution runner. |
| `RUNNER_SHARED_SECRET` | **Yes** (in prod) | — | Shared secret for timing-safe HMAC-SHA256 mutual request authentication. |
| `MONGO_MAX_POOL_SIZE` | No | `10` | Maximum socket connections maintained in the Mongoose connection pool. |

### Frontend (`.env` / Build Arguments)

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | No | `http://localhost:5000` (in dev) / `""` (in prod) | Base URL for API requests. Set to `""` when the frontend is served behind a reverse proxy that routes `/api` to the backend. |

---

## 3. Development vs. Production Differences

| Feature | Development Mode (`NODE_ENV=development`) | Production Mode (`NODE_ENV=production`) |
|---|---|---|
| **CORS** | Reflects localhost ports 5173 / 127.0.0.1 | Strictly validates against `CORS_ORIGIN` allowlist |
| **Error Handling** | Detailed error messages and stack traces logged | Masked generic messages for 500 errors; stack traces stripped from client responses |
| **Security Headers** | Basic CSP with inline scripts permitted for HMR | Strict Helmet CSP; HSTS enabled with `maxAge: 31536000` |
| **Logging** | Colorized readable console logs | Structured, NDJSON formatted logs with automated secret redaction |
| **Rate Limiting** | Generous thresholds for local testing (100 req/window) | Strict thresholds (15 login attempts/15 min; 20 code executions/min) |
| **Trust Proxy** | Disabled | Enabled (`trust proxy: 1`) for reverse-proxy correlation |

---

## 4. Authentication and Security Controls

1. **Identity & Claims**:
   - JWT tokens signed with HMAC-SHA256 containing `{ id: user._id }`.
   - Expiration enforced on all tokens (1 hour).
   - Identity is derived exclusively on the backend from verified JWT claims (`req.user.id`).
2. **Role-Based Access Control (RBAC)**:
   - User roles: `user` (learner) and `admin`.
   - Public registration strictly enforces `role: 'user'`, ignoring incoming payloads.
   - Profile updates strictly whitelist fields (`fullName`, `gender`, `experience`, `interests`), preventing role elevation.
   - Administrative middleware (`requireAdmin`) validates the live user document from MongoDB on every request, providing **instant privilege revocation** if an admin is demoted.
3. **NoSQL Operator Sanitization**:
   - Recursively removes object keys beginning with `$` or containing `.` from `req.body`, `req.query`, and `req.params`.
4. **Input Size Limits**:
   - `express.json({ limit: '100kb' })` prevents memory exhaustion attacks from oversized payloads.
5. **Rate Limiting**:
   - General API limiter: 300 requests / 15 minutes.
   - Login limiter: 15 attempts / 15 minutes per IP.
   - Registration limiter: 15 registrations / 15 minutes per IP.
   - Code execution limiter: 20 executions / minute per IP.

---

## 5. Docker Code Execution Sandbox Threat Model

### Threat Vectors & Applied Mitigations

| Threat | Mitigation Applied |
|---|---|
| **Host Network Access / SSRF** | `--network none` disconnects the execution container from all host and bridge networks. |
| **Host Filesystem Tampering** | `--read-only` enforces a read-only root container filesystem. Writable temporary storage is restricted to an isolated `tmpfs` (`/tmp:rw,noexec,nosuid,size=16m`). Solution workspace is mounted read-only (`-v "<tempDir>:/app:ro"`). |
| **Root Privilege Escalation** | `--user node` executes code under the unprivileged `node` UID (1000). `--security-opt no-new-privileges:true` prevents child processes from gaining elevated permissions. `--cap-drop ALL` strips all Linux kernel capabilities. |
| **Fork Bombs / Process Flooding** | `--pids-limit 64` strictly limits maximum process creation. |
| **Memory Exhaustion (OOM)** | `--memory 128m --memory-swap 128m` enforces a hard 128MB RAM limit. |
| **CPU Denial of Service / Infinite Loops** | `--cpus 0.5` restricts container CPU allocation. Wall-clock timeout is enforced at 5000ms (`SIGTERM` / `SIGKILL`). |
| **Output Flooding / Buffer Exhaustion** | Process `maxBuffer` bounded to 512KB. Stdout/stderr truncated at 64KB with notice. |
| **Container Concurrency Spikes** | In-flight execution concurrency bounded by `MAX_CONCURRENT_EXECUTIONS` (default 5). Returns HTTP 429 backpressure if saturated. |
| **Docker Socket Hijacking** | No Docker socket (`/var/run/docker.sock`) is ever mounted into user containers. |
| **Secret Exposure** | Untrusted code receives no environment variables containing `JWT_SECRET`, database credentials, or host secrets. |
| **Fail-Closed Guarantee** | If Docker is offline, the API immediately responds with `503 SANDBOX_UNAVAILABLE`. Untrusted code is **never** executed on the host, via `eval()`, or via `new Function()`. |

---

## 6. Observability & Health Endpoints

### Health Probes

- **Liveness Probe**: `GET /api/health/live`
  - Returns `200 OK` if the Node.js process is active.
  - Payload: `{ status: "ok", uptimeSeconds: <number>, timestamp: "<iso>" }`.
- **Readiness Probe**: `GET /api/health/ready`
  - Probes MongoDB connection (`readyState === 1`) and Docker sandbox engine.
  - Returns `200 OK` when MongoDB is connected.
  - Returns `503 Service Unavailable` if MongoDB is down.
  - Reports Docker sandbox status (`available` / `unavailable`) without failing the overall application readiness.

### Structured Logging

- Logs emitted via `server/utils/logger.js`.
- Automatically redacts sensitive fields matching `/password|passwordHash|token|authorization|secret|apiKey/i`.
- Each request receives or propagates an `X-Request-Id` correlation header.

---

## 7. Database Backup and Recovery Workflow

### Create Backup
```powershell
npm run db:backup
```
Exports all MongoDB collections to timestamped JSON archives in `server/backups/backup-<timestamp>/` with a signed `manifest.json`.

### Restore Backup
```powershell
npm run db:restore server/backups/backup-2026-10-10T17-33-14-643Z --confirm
```
*Note: The `--confirm` flag is strictly required to prevent accidental data overwrites.*

---

## 8. Deployment Workflow

### Method 1: Docker Compose (Recommended for Staging / Single-Host Production)

1. **Configure Environment**:
   ```powershell
   cp .env.example .env
   # Edit .env with a strong JWT_SECRET (openssl rand -base64 48)
   ```
2. **Build and Launch Stack**:
   ```powershell
   docker compose up -d --build
   ```
3. **Verify Deployment**:
   ```powershell
   curl http://localhost/api/health/ready
   ```

### Method 2: Manual / Cloud Hosting (e.g., Render, Railway, AWS ECS)

1. **Backend**:
   - Build command: `npm ci --omit=dev`
   - Start command: `npm run server`
   - Set environment variables (`PORT`, `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`).
2. **Frontend**:
   - Build command: `npm ci && npm run build`
   - Output directory: `dist/`
   - Configure SPA routing fallback: redirect all routes to `index.html`.

---

## 9. Dependency Audit & Security Status

- **Audited Dependencies**: 172 packages.
- **Safe Fixes Applied**: Transitive `source-map-js` vulnerability patched via `npm audit fix`.
- **Known Transitive Risks**:
  - `braces` (via `nodemon` devDependency): Dev-only; not packaged in production runner.
  - `dompurify` (via `@monaco-editor/react` transitive dependency): Monitored upstream for Monaco update.

---

## 10. Residual Risks & Future Hardening Recommendations

1. **Kernel-Level Container Sandboxing**:
   While Docker container isolation (`--network none`, `--user node`, `--read-only`, `--cap-drop ALL`, `pids-limit`) provides defense-in-depth, shared Linux kernel exploits remain a theoretical concern in multi-tenant environments. For large-scale multi-tenant production, integrate **gVisor (`runsc`)** or **Kata Containers** as the Docker runtime engine (`--runtime=runsc`).
2. **Dedicated Execution Worker Service**:
   In enterprise environments, decouple code execution into a dedicated worker pool communicating over an internal message queue (e.g. BullMQ / Redis) rather than running directly on the primary API server.

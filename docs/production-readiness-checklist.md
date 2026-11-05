# CodeForge — Production Readiness Checklist

This checklist defines the operational, architectural, and security prerequisites that must be satisfied before launching **CodeForge** into a public production environment.

---

## 1. Environment & Configuration Prerequisites

### 1.1 Environment Variables (Reference by Name Only)

All variables must be configured in production environment secrets (never committed to version control):

| Variable Name | Required | Purpose / Security Constraint |
|---|---|---|
| `NODE_ENV` | **Yes** | Set to `production`. Enables strict security middleware, error masking, and disables dev bypasses. |
| `PORT` | **Yes** | Standard port binding (e.g. `5000`). |
| `MONGO_URI` | **Yes** | Production MongoDB connection string. Must use TLS/SSL (`mongodb+srv://` or `ssl=true`) with strong authentication. |
| `JWT_SECRET` | **Yes** | Cryptographically random secret ($\ge 32$ characters, recommended $\ge 64$ characters). Must fail startup if weak or trivial. |
| `CORS_ORIGIN` | **Yes** | Explicit comma-separated list of trusted production origins (e.g. `https://codeforge.dev`). Never use wildcards (`*`) in production. |
| `REQUEST_BODY_LIMIT`| No | Maximum allowable request body size (default: `100kb`). |
| `MAX_CONCURRENT_EXECUTIONS` | No | Bounded container concurrency ceiling (default: `5`). |
| `MONGO_MAX_POOL_SIZE` | No | Mongoose connection pool ceiling (default: `10`). |
| `AI_PROVIDER` | No | Set to `gemini`, `openai`, or `mock` (default: `mock`). |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Conditional | Server-side only key for live AI tutoring. Must never be exposed to client. |
| `VITE_API_BASE_URL` | **Yes** | Frontend build-time variable. Set to `""` when behind reverse proxy routing `/api/` to backend. |

---

## 2. Infrastructure, Network & Runner Isolation

### 2.1 Untrusted Code Execution Runner Isolation (P0 Launch Gate)
- [x] **NO Docker Socket in API Container**: Confirm `/var/run/docker.sock` is NOT mounted into the public API container.
- [x] **Dedicated Execution Service**: Deploy a separate, isolated runner service (`server/runner/runnerServer.js`) on dedicated internal network (`runner-net` with `internal: true`).
- [x] **3-Tier Network Microsegmentation**: `frontend-net`, `data-net` (internal), and `runner-net` (internal). Zero routing between frontend and runner or MongoDB.
- [x] **Replay-Proof Mutual Authentication**: Canonical HMAC-SHA256 request signing with nonce replay rejection and timestamp freshness ($\pm 60$s).
- [x] **Production Credential Hardening**: Reject missing, short (< 32 chars), or weak default `RUNNER_SHARED_SECRET` in production.
- [x] **Stdin Streaming Execution Transport**: Code and test harness streamed into container stdin (`-i node:20-alpine node -`); zero host bind-mounts and zero DooD path resolution errors.
- [x] **Active Container Lifecycle Watchdogs**: Deterministic container naming (`--name cf-job-<uuid>`), zombie reaping (`--init`), bounded stop timeouts (`--stop-timeout 2`), and active `docker rm -f` watchdog on timeout or buffer overrun.
- [x] **Multi-Host Architecture Specified**: `docker-compose.prod.app.yml` (zero socket), `docker-compose.prod.runner.yml` (gVisor `runsc`), and `docs/architecture-isolated-runner.md` specified and verified.
- [ ] **Physical Multi-Host Infrastructure Provisioning**: Deploy application tier and dedicated runner VM on separate VPC subnets with firewalled security groups.
- [ ] **Live Container Execution Verification**: Live verification on active Docker daemon (BLOCKED: Docker Desktop offline on host).

### 2.2 Network & Transport Security
- [ ] **HTTPS / TLS 1.3**: All external traffic terminated with valid TLS certificates (Let's Encrypt / Cloudflare / AWS ACM).
- [ ] **HSTS**: `Strict-Transport-Security` header enabled with `max-age=31536000; includeSubDomains`.
- [ ] **Internal Network Isolation**: Database and internal runners must NOT be accessible from the public internet. MongoDB port 27017 must only listen on internal bridge/VPC.
- [ ] **Reverse Proxy Security Headers**: Nginx enforces `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Content-Security-Policy`.
- [ ] **Asset Caching**: Static hashed chunks in `/assets/` served with `Cache-Control: public, max-age=31536000, immutable` with explicit security header preservation.

---

## 3. Data Protection, Backup & Disaster Recovery

### 3.1 MongoDB Data Integrity
- [ ] **Replica Set**: Production MongoDB deployed as a multi-node replica set with automated failover.
- [ ] **BSON-Safe Extended JSON Backup**: Automated cron job executing `npm run db:backup` exporting collections with Extended JSON (EJSON) formatVersion 2.
- [ ] **Tested Restoration Drill**: Validate that backups can be restored into an isolated staging database (`npm run db:restore <backup-dir> --confirm --target-uri=<uri>`) verifying BSON ObjectIds, Dates, and unique indexes.
- [ ] **Encrypted Offsite Storage**: Backup archives encrypted and stored in durable, offsite object storage (e.g. AWS S3 with KMS).
- [ ] **Retention Policy**: Daily backups retained for 30 days; weekly backups retained for 90 days.

---

## 4. Application Security Controls

### 4.1 Authentication & Authorization
- [ ] **JWT Verification**: Tokens verified using HMAC-SHA256 with 1-hour expiration.
- [ ] **Strict Identity Derivation**: User identity derived exclusively from server-verified JWT claims (`req.user.id`).
- [ ] **Immediate Admin Demotion**: `requireAdmin` middleware checks live MongoDB role on every administrative request.
- [ ] **Tenant Isolation**: Object-level authorization enforced on all reads, mutations, and deletions.
- [ ] **Password Security**: Passwords hashed with bcryptjs (salt rounds $\ge 10$) with 72-byte max boundary check.

### 4.2 API Protection & Input Hardening
- [ ] **NoSQL Injection Defense**: Recursive sanitization of `$` and `.` operators on `req.body`, `req.query`, and `req.params`.
- [ ] **Rate Limiting**:
  - General API: 300 requests / 15 min per IP.
  - Login: 15 attempts / 15 min per IP.
  - Registration: 15 attempts / 15 min per IP.
  - Code Execution: 20 executions / min per IP.
- [ ] **Payload Size Limit**: Hard ceiling at 100KB for request bodies (`express.json({ limit: '100kb' })`).
- [ ] **Error Masking**: 500 error responses return generic masked messages without stack traces or internal paths.

### 4.3 AI Learning Assistant Boundaries
- [ ] **Progressive Hint Gating**: Levels 1–4 progressive clues; Level 5 full solution strictly gated behind explicit user request.
- [ ] **Confidentiality**: Hidden test cases (`isHidden: true`) and solution keys strictly excluded from prompt context.
- [ ] **Prompt-Injection Containment**: Inputs delimited with `<user_query>` and `<student_code>` XML tags.
- [ ] **PII Redaction**: Automatic scrubbing of JWTs, Bearer tokens, and email addresses.
- [ ] **Catalog Grounding**: Recommended activities verified against genuine problem and quiz collections.

---

## 5. Observability, Logging & Incident Response

### 5.1 Monitoring & Health Probes
- [ ] **Liveness Probe**: `GET /api/health/live` polled every 10–30 seconds.
- [ ] **Readiness Probe**: `GET /api/health/ready` verifies MongoDB connectivity and runner status.
- [ ] **Alerting**: Automated alerts configured for error rates ($> 1\%$), latency spikes ($> 2000\text{ms}$), memory usage ($> 85\%$), and container crashes.

### 5.2 Logging & Audit Trail
- [ ] **Structured Logging**: NDJSON logs with correlation ID `X-Request-Id`.
- [ ] **Automated Secret Redaction**: Logger automatically masks fields matching `/password|token|secret|apiKey/i`.
- [ ] **Admin Audit Trail**: Sensitive admin actions (question edits, quiz publishing/archiving) logged in `AuditLog` collection.

### 5.3 Incident Response & Rollback Plan
- [ ] **Rollback Strategy**: Container images tagged with immutable commit SHAs. Rollback automated via `docker compose` or orchestration deployment rollout rollback.
- [ ] **Playbooks**: Documented incident procedures for credential compromise, database recovery, and runner exhaustion.

---

## 6. Pre-Launch Verification Run

Execute and verify all checks immediately prior to release:

```powershell
npm run lint
npm run build
npm run test:signup
npm run test:auth-url
npm run test:bson-backup
npm run test:m13
npm run test:m14
npm run test:m15a
npm run test:m15b
npm run test:m15c
npm run test:m15d
npm run test:m16a
npm run test:m16b
npm run test:m16c
npm run test:m16d
npm run test:runner
npm run test:audit
```

**Launch Gate Criterion:** All tests must exit with code `0`. Zero security warnings, zero unverified assumptions. Public multi-tenant launch remains **NO-GO** until physical multi-host deployment and live container sandbox execution pass verification.

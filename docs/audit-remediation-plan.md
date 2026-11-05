# CodeForge — Audit Remediation Plan

This document outlines the concrete technical remediation plan for all findings identified during the **Final Security & Integration Audit**, detailing the unresolved P0 architectural blocker, recently resolved issues, next engineering actions, dependencies, acceptance criteria, and verification tests.

---

## 1. Resolved P0 Architectural Issue: Decoupling Docker Code Execution

### Issue Summary
- **Identifier:** REM-P0-01
- **Severity:** P0 — Critical Production Launch Gate Blocker
- **Affected Files:** `docker-compose.yml`, `Dockerfile`, `Dockerfile.runner`, `server/runner/*`, `server/services/codeExecutionService.js`, `test_isolated_runner_remediation.mjs`
- **Previous State:**
  The backend container mounted the host Docker socket (`/var/run/docker.sock`), and the `node` user was added to the `docker` group. This granted the web application container root-equivalent control over the host Docker daemon.
- **Root Cause:**
  Code execution was initially built directly inside the Express server process using `execFile('docker', ...)` for convenience during local development.
- **Resolution Implemented:**
  Untrusted code execution has been completely decoupled from the API backend into a dedicated, internal, non-public runner microservice:
  1. Removed `/var/run/docker.sock` volume mount and Docker CLI privileges from public backend container (`Dockerfile` and `docker-compose.yml`). Backend runs as unprivileged non-root `node` user with zero Docker socket access.
  2. Created dedicated runner microservice (`server/runner/runnerServer.js`) listening on internal port 5050 on `internal-net` with zero published host ports.
  3. Implemented timing-safe mutual service authentication (`runnerAuthMiddleware.js`) using `crypto.timingSafeEqual` over SHA-256 HMAC digests.
  4. Enforced strict job payload bounds in runner: max 64KB code, allowlisted runtimes, forbidden client container overrides.
  5. Runner executes code inside ephemeral, air-gapped sandboxes (`--network none`, `--cap-drop ALL`, `--read-only`, `--user node`, `--pids-limit 64`, `--tmpfs`, memory 128MB, CPU 0.5, 5000ms wall-clock timeout).
  6. Backend `codeExecutionService.js` dispatches execution jobs to runner via HTTP and fails closed with 503 `SANDBOX_UNAVAILABLE` when the runner or container engine is offline. Zero untrusted code is ever evaluated on the host.
- **Status:** **PARTIALLY VERIFIED — LIVE ISOLATION STILL BLOCKED (NO-GO FOR PUBLIC MULTI-TENANT LAUNCH)**
  Backend decoupled, 3-tier microsegmentation active, stdin transport running, HMAC replay defense armed, and fail-closed handling verified via automated suites (`npm run test:runner` 36 passed / 2 blocked, `npm run test:sandbox` 29 passed / 1 blocked, `npm run test:audit` 63 passed / 1 blocked). However, runner container mounts `/var/run/docker.sock` and live execution remains blocked by offline Docker daemon.

```
[ Public Frontend (codeforge-frontend) ] (Port 80:80)
      │
      ▼  frontend-net (Bridge)
[ Public Web API Container (codeforge-backend) ] (USER node, no docker.sock, no docker-cli)
      ├─── data-net (Bridge, internal: true) ──────────► [ MongoDB (codeforge-mongo) ]
      │
      └─── runner-net (Bridge, internal: true)
           • Canonical HMAC-SHA256 Signed Requests (Nonce + Freshness + Body Hash)
           ▼
[ Dedicated Runner Microservice (codeforge-runner) ] (Port 5050, internal-net only, no published ports)
      │
      ▼  Stdin Streaming Execution Transport (node:20-alpine node -)
[ Isolated Ephemeral Sandboxes ]
      • --network none
      • --user node
      • --read-only
      • --cap-drop ALL
      • --security-opt no-new-privileges:true
      • --tmpfs /tmp:rw,noexec,nosuid,size=16m
      • --name cf-job-<uuid> (tracked in activeJobs with rm -f watchdog)
      • 128MB RAM / 0.5 CPU / 64 PIDs / 5000ms timeout
```

### Acceptance Criteria
- [x] Backend container does not mount `/var/run/docker.sock`.
- [x] Backend container does not have `docker-cli` installed.
- [x] 3-tier network microsegmentation enforces `frontend-net`, `data-net` (`internal: true`), and `runner-net` (`internal: true`).
- [x] Production environment strictly rejects missing or weak `RUNNER_SHARED_SECRET` (< 32 chars or default substrings).
- [x] Mutual service authentication uses canonical HMAC-SHA256 request signing with nonce replay rejection and timestamp freshness.
- [x] Runner uses stdin streaming execution transport, completely eliminating host file mounts and DooD path mismatches.
- [x] Deterministic container naming (`--name cf-job-<uuid>`) and active kill watchdog (`docker rm -f`) enforce container cleanup.
- [x] Multi-host production architecture manifests (`docker-compose.prod.app.yml`, `docker-compose.prod.runner.yml`, `docs/architecture-isolated-runner.md`) specified and verified.
- [x] Atomic nonce store and distributed/multi-replica replay defense (`SharedNonceStore`) implemented.
- [x] Mandatory production HMAC signatures enforced; plain static secret headers rejected in production.
- [ ] Physical provisioning of multi-host VPC infrastructure (Host 1 App Tier vs Host 2 Dedicated Execution VM with gVisor).
- [ ] Live container sandboxing verified on active Docker daemon (BLOCKED: daemon offline on host).

### Verification Test
```powershell
# 1. Dedicated REM-P0-03 runner remediation verification suite
npm run test:runner   # 65 passed, 0 failed, 2 blocked

# 2. Hardened container sandbox configuration suite
npm run test:sandbox  # 29 passed, 0 failed, 1 blocked

# 3. Final security & integration audit suite
npm run test:audit    # 63 passed, 0 failed, 1 blocked
```

---

## 2. Recently Resolved Issues (Verified in Audit)

### REM-P1-01: DOMPurify In-Place Sanitizer DOM XSS (CVE-2024-45801)
- **Severity:** P1 (High)
- **Resolution:** Added `"overrides": { "dompurify": "^3.4.17" }` to `package.json` and executed `npm install`. Upgraded installed version from `3.4.15` to `3.4.17`.
- **Acceptance Criteria Met:** `npm audit` confirms 0 vulnerabilities in DOMPurify. Frontend production build compiled cleanly without errors.
- **Verification Test:** `npm audit` and `npm run build`.

---

### REM-P1-02: High-Concurrency Identifier Collision Risk
- **Severity:** P1 (High)
- **Affected Files:** `server/services/practiceBundleService.js`, `server/services/retentionSessionService.js`
- **Resolution:** Replaced timestamp-only identifiers with cryptographically random hex suffixes:
  - `bundleId`: `bundle-${slugify(topic)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  - `sessionId`: `ret-session-${slugify(topic)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
  - `recId`: `rec-ret-${slugify(topic)}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
- **Acceptance Criteria Met:** 60 concurrent generations produced 100% unique IDs with zero collisions.
- **Verification Test:** `npm run test:audit` (Part 3.1).

---

### REM-P2-01: API Rate Limiter Lockout During Local Regression Testing
- **Severity:** P2 (Medium)
- **Affected Files:** `server/middleware/securityMiddleware.js`
- **Resolution:** Updated `apiRateLimiter` to enforce `300` in `production` while allowing `5000` in `development` and `test`.
- **Acceptance Criteria Met:** All 18 automated regression test suites execute sequentially without tripping false 429 lockouts on `127.0.0.1`.
- **Verification Test:** Consecutive execution of `npm run test:m15d`, `npm run test:m16a`, `npm run test:audit`.

---

## 3. Operational Hardening Roadmap (Post-Launch Preparation)

| Action Item | Priority | Target Timeline | Dependencies | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| **Decouple Runner Service (REM-P0-01)** | **P0** | Pre-Public Launch | Docker Compose / Runner Dockerfile | Zero socket access in web API container | **RESOLVED & VERIFIED** |
| **Integrate Live AI Provider Canaries** | P2 | Post-Launch (Week 1) | Gemini / OpenAI API Keys | Automated canary test verifying token streaming & timeouts | Planned |
| **Automated Offsite Backup Synchronization** | P2 | Post-Launch (Week 2) | AWS S3 / Cloudflare R2 | Daily encrypted sync of `server/backups/` archives | Planned |
| **gVisor (`runsc`) Sandboxing** | P3 | Milestone 17 | Linux Host / gVisor install | Runner executes containers via `--runtime=runsc` | Planned |
| **Monaco Editor Upstream Dependency Monitoring** | P3 | Quarterly | Monaco Editor Releases | Update `@monaco-editor/react` when upstream updates bundled peer deps | Ongoing |

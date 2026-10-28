# Architecture — CodeSentinel

This document explains **how CodeSentinel works end to end** and **why each technology is in the stack**. Read it top to bottom to understand the life of a single review, then the pieces that support it.

---

## 1. Big picture

CodeSentinel is a two-process, local-first application:

| Process | Technology | Port | Responsibility |
|---|---|---|---|
| Client | React 19 + Vite dev server | `5173` | UI, Monaco editor, routing, charts |
| Server | Node.js 20+ + Express 4 | `5000` | Validation, analysis, LLM, persistence |

They talk over plain HTTP/JSON. The browser never talks to Ollama or MongoDB directly — **all model and database access happens on the server**, so credentials and the model endpoint stay private.

```
┌────────────────────────── Browser ──────────────────────────┐
│  React 19  ·  React Router  ·  Monaco  ·  Recharts  ·  CSS  │
└───────────────┬─────────────────────────────────────────────┘
                │ fetch  (JSON, CORS-restricted to Vite origin)
┌───────────────▼──────────────── Express app ────────────────┐
│ routes → Zod validation → rate limit → controllers          │
│                     │                                       │
│             reviewPipeline.runReview()                      │
│        ┌────────────┼────────────────┐                      │
│   languageDetector  chunker      analyzers                  │
│                          \\        /                         │
│                        llmReviewer  ←── Ollama (local)      │
│                            │                                │
│                         merger                             │
│                            │                                │
│              Review model ←┘   ←── MongoDB                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. The life of one review

A user presses **Review code** (`Ctrl+Enter`), and the following happens in order.

### Step 1 — Client sends the payload

`useReview.run()` builds `{ code, language?, filename? }` and calls `POST /api/review` with an `AbortController` so the user can cancel a long local-model run. The request goes through [services/api.js](client/src/services/api.js), which normalises network failures into a readable message.

### Step 2 — Middleware validates and gates

[routes/review.js](server/src/routes/review.js) runs three things **before** the controller:

1. **Rate limit** — `express-rate-limit`, 20 requests/minute/IP (draft-7 `RateLimit` headers).
2. **Zod parse** — `reviewRequestSchema` rejects empty code, code over 200 KB, unknown languages, and filenames over 255 characters. Failures come back as `400 VALIDATION_ERROR`.
3. **Database gate** — reviews are *persisted by design* (caching and history are features), so if MongoDB is disconnected the request fails fast with `503 DATABASE_UNAVAILABLE` instead of pretending success.

### Step 3 — Cache lookup

[reviewController.createReview](server/src/controllers/reviewController.js) computes a **cache key** = SHA hash of `(code, language, model, verify, minConfidence)` via `server/src/utils/hash.js`. A hit returns the saved report instantly with `cached: true` — this is why identical snippets appear to respond instantly on second run. A duplicate-key race (`11000`) is caught and re-read as a cache hit.

### Step 4 — Language detection

[services/languageDetector.js](server/src/services/languageDetector.js) resolves the language with a strict precedence:

1. **Explicit request override** — an invalid value never reaches here (Zod already rejected it).
2. **Filename extension** — `.js/.jsx/.mjs/.cjs`, `.java`, `.py`, `.c`, `.cpp/.cc/.cxx/.hpp/.hh/.hxx`, `.html/.htm`, `.css`, `.sql`.
3. **Ambiguous `.h`** — contents are inspected to decide C vs C++.
4. **Content heuristics** — conservative keyword clues; the result carries `method: 'content-heuristic'` and a `confidence`, and the pipeline adds a **visible warning** so the user never mistakes a guess for a certainty.

### Step 5 — Syntax-aware chunking

[services/chunker.js](server/src/services/chunker.js) splits the source so each model call sees a coherent unit, in four escalating tiers:

1. **Tree-sitter** (`web-tree-sitter` + `tree-sitter-wasms`) parses the code and collects top-level structures — functions, methods, classes — for JavaScript, Python, Java, C and C++. If the parse tree has errors, or the WASM grammar is unavailable, chunking degrades instead of failing.
2. **Lexical scanning** — a brace/indent-aware fallback that finds units by pattern matching (handles Python by indentation, others by balanced `{}` while ignoring quoted strings).
3. **Structural separators** — for HTML (closing tags), CSS (`}`) and SQL (`;`).
4. **Whole file** — if nothing else applies, or the file is small enough, one chunk.

Each chunk records `startLine` / `endLine`, its name, and the file's **imports/includes**, and nothing exceeds `MAX_CHUNK_CHARS` (12 000 by default; oversized units are block-split). **Original line numbers are preserved on every chunk** — that is what makes line-accurate findings possible later.

### Step 6 — Static analysis (optional tools)

[services/analyzers/index.js](server/src/services/analyzers/index.js) maps a language to its tool definitions (ESLint, Pylint, Bandit, PMD, Cppcheck, Flawfinder, HTMLHint, Stylelint, SQLFluff). For each tool:

- [utils/processRunner.js](server/src/utils/processRunner.js) resolves the executable (configured path → `PATH` → workspace `node_modules/.bin`), and on Windows launches `.cmd`/`.bat` shims through `cmd.exe` with proper quoting.
- The source is written to a **random temp directory** and passed as a file argument — the app never pipes user code through a shell and never executes it.
- The tool's output (JSON, line-delimited JSON, CSV) is parsed and pushed through a Zod `findingSchema`, producing normalized `{ line, severity, category, message, sourceTool }`.
- A missing binary, timeout, oversized output or unparseable output becomes a **warning string** in the report, never a silent pass.

JavaScript gets extra treatment: ESLint is a workspace dev dependency and is always invoked with CodeSentinel's own flat config ([analyzers/eslint.config.mjs](server/src/services/analyzers/eslint.config.mjs)), so pasted snippets are checked against a fixed rule set instead of whatever config happens to be on disk.

### Step 7 — LLM review

[services/llmReviewer.js](server/src/services/llmReviewer.js) is called for **each chunk**, bounded by `p-limit` to `LLM_CONCURRENCY` (3) parallel calls:

1. A language-specific checklist is loaded from [server/src/prompts/](server/src/prompts) (one `.md` per language).
2. A system prompt asks for **strict JSON** — `{ "issues": [{ line, severity, category, explanation, suggestedFix, confidence }] }` — with instructions to report only real defects.
3. `POST {OLLAMA_BASE_URL}/api/chat` with `format: "json"`, `stream: false`, an 8 192-token context, a `num_predict` cap, and `OLLAMA_TIMEOUT_MS` as an `AbortSignal.timeout`.
4. The response is parsed and validated with `llmResponseSchema`. On invalid JSON the model is **asked once more inside the same call** (repair prompt), up to three attempts.
5. Reported lines are clamped into the chunk's real `[startLine, endLine]` range.

`MOCK_LLM=true` replaces all of this with deterministic output — used only by tests and for explicit offline development.

### Step 8 — Optional verification pass

When `VERIFY=true`, every candidate from step 7 is sent back in **one** second call asking for a verdict per candidate (`confirmed` / `rejected` + reason). Rejected candidates are dropped; confirmed ones get `verificationStatus: 'confirmed'` and the reason shown in the UI. If verification itself fails, the whole review fails with `503` — **a finding is never labelled "verified" without a verdict**.

### Step 9 — Merge and rank

[services/merger.js](server/src/services/merger.js) combines static and model findings:

- Both streams are validated against `findingSchema`.
- Model findings below `MIN_CONFIDENCE` (0.65) or marked `rejected` are discarded.
- Candidates are sorted by line, then severity.
- Two findings **within one line of each other** with the same normalized category and overlapping meaningful wording merge into one, keeping **both sources** (`["ESLint", "LLM"]`), the strongest severity, the highest confidence and any verification state.
- The final list is re-sorted by severity (high → medium → low), then line, and validated by `reportSchema` before it is returned.

The result is `{ language, summary, issues, warnings, metadata }`.

### Step 10 — Persist and respond

The report is saved in MongoDB with the source (hidden from normal queries via `select: false`), the cache key, language, filename and the model/verification configuration. The response adds `reviewId` and `cached: false`. History and statistics then read from those documents.

### Step 11 — Client renders

`ResultsPanel` shows the summary bar (language, cached state, severity counts), analyzer warnings, and `IssueCard`s. Each issue carries `sources` (ESLint / LLM / both), a severity badge, the explanation, a copyable suggested fix and the verification state. `CodeEditor` converts issues into **Monaco markers** — squiggles and gutter decorations on the exact source line — and clicking a card jumps the cursor to that line.

---

## 3. Persistence model

One Mongoose collection, `reviews` ([server/src/models/Review.js](server/src/models/Review.js)):

| Field | Purpose |
|---|---|
| `code` | Original source (`select: false` — excluded unless explicitly requested) |
| `cacheKey` | **Unique index** — the deduplication guarantee |
| `language`, `filename` | Indexed for filtering (`{ language, createdAt }`) |
| `report` | Full merged report (Mixed — validated before write) |
| `configuration` | Model + verification flag used, for reproducibility |
| `createdAt` | Drives history ordering and the 30-day activity chart |

`GET /api/stats` uses **five parallel aggregations** (`$unwind` on issues for categories, `$group` for severity, languages, and per-day activity with `$dateToString`) so the Insights page is one round trip.

---

## 4. Frontend architecture

| Layer | File(s) | Role |
|---|---|---|
| Routing | [App.jsx](client/src/App.jsx) | `/`, `/review/:id`, `/history`, `/stats`; unknown paths redirect home |
| Shell | [AppLayout.jsx](client/src/components/layout/AppLayout.jsx) | Sidebar, theme toggle, outlet |
| State | [useReview.js](client/src/hooks/useReview.js) | `report / loading / error` + `run / cancel / retry / reset`, single in-flight request with abort |
| Theme | [useTheme.js](client/src/hooks/useTheme.js) | `dark`/`light`, persisted in `localStorage`, applied via `data-theme` |
| Data | [api.js](client/src/services/api.js) | Every fetch in one place; friendly error mapping |
| Editor | [CodeEditor.jsx](client/src/components/editor/CodeEditor.jsx) | Monaco wrapper: markers, theme sync, `Ctrl+Enter`, line navigation |
| Styles | [client/src/styles/](client/src/styles) | `tokens.css` (design tokens) → `global` → `layout` → page-specific |

Design decisions worth knowing:

- **Monaco is bundled locally** ([utils/monaco.js](client/src/utils/monaco.js)) and fed Vite-built web workers instead of the CDN default from `@monaco-editor/react`. The workspace works offline and no source ever leaves the machine just to load an editor.
- **No UI framework** — plain CSS with custom properties keeps the bundle small and the dark/light themes a single token swap.
- **Vendor chunks are split** (Monaco / charts / React) in [vite.config.js](client/vite.config.js) so the app shell renders first.
- Clicking a finding updates `selectedLine`, which scrolls the editor to the line and focuses it — the two panes stay in sync.

---

## 5. Technology reference — what and why

### Backend

| Technology | Version | Why it is here |
|---|---|---|
| **Node.js** | 20+ | Async I/O fits fan-out to analyzers + a local model; native `fetch`, `AbortSignal.timeout` and `AbortController` are built in, so no HTTP client library is needed. |
| **Express 4** | `^4.21` | Small, well-understood HTTP layer: routers per endpoint, middleware for rate limiting/CORS/body limits, one terminal error handler. |
| **ES modules** | `"type": "module"` | Top-level `await`, explicit `.js` import paths, no transpile step for the server. |
| **Zod 4** | `^4.6` | One schema = runtime validation *and* the error messages users see. Used for env config, request bodies, pagination, LLM responses, analyzer output and the final report — the same contract at every boundary. |
| **dotenv** | `^16` | Loads `server/.env` before the Zod env schema validates it. |
| **Mongoose 8** | `^8.10` | Schema, indexes (`cacheKey` unique, `{language, createdAt}`), `select: false` on source code, and the aggregation pipeline used by `/api/stats`. |
| **Ollama** | HTTP API | Local LLM inference (`/api/chat` with `format: "json"`). Kept as a plain `fetch` call — no SDK — so timeouts, retries and error codes stay explicit and testable. |
| **web-tree-sitter** + **tree-sitter-wasms** | `^0.25` / `^0.1` | Real grammar-based chunking for JS/Python/Java/C/C++. WASM grammars run in-process with no native build step, which matters on Windows. Every failure path degrades to lexical chunking. |
| **p-limit 6** | `^6.2` | Caps concurrent model calls (`LLM_CONCURRENCY`), protecting a shared local GPU/CPU and the 8k model context from burst load. |
| **express-rate-limit 7** | `^7.5` | 20 reviews/minute/IP with draft-7 headers; a cheap guard for a service meant to stay local. |
| **cors 2** | `^2.8` | Restricts the API to the configured Vite origin. |
| **ESLint 9** (dev) | `^9.39` | The JavaScript analyzer. Ships with the workspace so real static findings work with zero global installs; always run with the bundled flat config. |
| **Vitest 5** (dev) | `^5.0` | Unit + integration tests in one runner, native ESM, `it.skipIf` for environment-dependent analyzer tests. |
| **Supertest 7** (dev) | `^7` | Drives the real Express `app` in integration tests without binding a port. |
| **mongodb-memory-server 10** (dev) | `^10` | Spins up a real `mongod` for integration tests, so tests need no external database. |
| **nodemon 3** (dev) | `^3.1` | Restart-on-change during development. |

### Frontend

| Technology | Version | Why it is here |
|---|---|---|
| **React 19** | `^19` | Component model for a two-pane workspace; concurrent rendering keeps the editor responsive during long reviews. |
| **Vite 6** | `^6.1` | Instant dev server, native ESM, `?worker` imports for Monaco's workers, and a production build with vendor chunk splitting. |
| **React Router 7** | `^7.1` | `/history` and `/stats` are real URLs; `/review/:id` deep-links a saved review. |
| **Monaco + @monaco-editor/react** | `0.57` / `^4.7` | A real IDE editor: syntax highlighting for all eight languages, and **`setModelMarkers`** to draw findings directly on the offending lines. Loaded from the local bundle, not a CDN. |
| **Recharts 2** | `^2.15` | Declarative SVG charts for the Insights page (category bars, severity risk, 30-day activity, language mix) — no canvas plugin or theme plumbing. |
| **Lucide React** | `^0.468` | Lightweight, consistent line icons. |
| **Plain CSS + custom properties** | — | `tokens.css` defines colour/spacing/typography variables; dark and light themes are one variable swap, and the bundle stays tiny. |

### Environment & tooling

| Piece | Role |
|---|---|
| **npm workspaces** | One lock file, one `npm install`, hoisted dependencies, `npm --workspace server run …` scripts. |
| **concurrently** | `npm run dev` starts both processes with prefixed, colour-coded logs and `-k` so stopping one stops both. |
| **scripts/doctor.js** | Probes Ollama (server **and** configured model), MongoDB, and every analyzer executable — reusing `processRunner` so the check matches reality. |
| **scripts/setup.ps1** | Windows bootstrap: installs deps and creates `server/.env` from the template. |

---

## 6. Configuration

All configuration is validated once at startup by [server/src/config/env.js](server/src/config/env.js). Booleans accept `true/1/yes` and `false/0/no`, numbers are coerced and range-checked, URLs must parse, and **invalid values fail startup with the offending field named**. Analyzer `*_PATH` values default to bare command names, resolved at run time.

See the [README](README.md#environment) for the full table.

---

## 7. Error handling contract

Every failure exits through [middleware/errorHandler.js](server/src/middleware/errorHandler.js) as `{ error: { message, code } }`:

| Condition | Status | Code |
|---|---|---|
| Zod / Mongoose validation | 400 | `VALIDATION_ERROR` |
| Body over 200 KB | 413 | `PAYLOAD_TOO_LARGE` |
| Rate limited | 429 | `RATE_LIMITED` |
| Ollama down / model missing / bad context | 503 | `OLLAMA_*` |
| MongoDB disconnected | 503 | `DATABASE_UNAVAILABLE` |
| Unknown route | 404 | `NOT_FOUND` |
| Anything else | 500 | `INTERNAL_ERROR` (message hidden in production, logged server-side) |

`asyncHandler` wraps every controller so rejected promises reach that handler instead of crashing the process.

---

## 8. Testing strategy

```
server/tests/
├── unit/        hash, languageDetector, chunker, merger, llmReviewer (mock mode),
│                processRunner (cmd quoting), analyzers (real ESLint)
├── integration/ api.test.js — full Express app + mongodb-memory-server
└── fixtures/    buggy-samples.json
```

- **45 tests**, all offline: the LLM is exercised in mock mode, analyzers are skipped (`it.skipIf`) rather than faked when their binaries are absent, and the database is an ephemeral `mongod`.
- Integration tests assert the real contract: validation errors, cache hits, health output, and persisted history.

---

## 9. Security posture

- **Code is never executed.** It is written to a random temp directory and passed to analyzers as an argument array, then deleted in `finally`.
- **Shell safety**: `execFile` by default; Windows shims go through `cmd.exe` with a dedicated quoting helper that is unit-tested.
- **Size limits** at three layers: JSON body 200 KB, Zod `code` max, `MAX_SOURCE_BYTES` in the pipeline.
- **CORS** limited to one origin; **rate limit** on the review route; no stack traces or secrets in responses.
- **Secrets stay out of the repo**: `.env` is git-ignored, and only non-secret readiness labels reach the client.
- **Known gaps**: no auth or multi-user isolation — keep it on localhost. Analyzers you install are trusted local programs. Ollama prompts include the source you submit; keep that endpoint local.

Static analysis and LLM reviews can both miss defects or report false positives. **Nothing here guarantees bug-free code.**

---

## 10. Where to look next

| I want to… | Open |
|---|---|
| Change what the model is asked | [server/src/prompts/*.md](server/src/prompts), [llmReviewer.js](server/src/services/llmReviewer.js) |
| Add an analyzer | [analyzers/index.js](server/src/services/analyzers/index.js), [baseAnalyzer.js](server/src/services/analyzers/baseAnalyzer.js) |
| Support a new language | [languageConfig.js](server/src/utils/languageConfig.js), [languageDetector.js](server/src/services/languageDetector.js), [chunker.js](server/src/services/chunker.js), a prompt file, [samples.js](client/src/utils/samples.js) |
| Change merging/ranking rules | [merger.js](server/src/services/merger.js) |
| Adjust chunk boundaries | [chunker.js](server/src/services/chunker.js) |
| Restyle the app | [client/src/styles/tokens.css](client/src/styles/tokens.css) |

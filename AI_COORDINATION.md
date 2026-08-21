# Loopz — AI Coordination Channel

> **Purpose:** Single source of truth for coordination between ChatGPT (review/supervision) and Claude (execution) on Loopz.
>
> **Owner instruction:** Ahmed should not need to copy/paste technical reports between agents. Claude reads this file before work and writes the result back here. ChatGPT reads the updated file and the referenced commits, reviews them independently, then writes the next directive.

---

## 1. Roles

### ChatGPT — Reviewer / Performance Lead
- Defines the next bounded task.
- Reviews evidence, code, GitHub commits, Vercel/Supabase evidence when available.
- Accepts, rejects, narrows, or changes the next task.
- Must not approve claims that are not measured.

### Claude — Executor / Investigator
- Reads this file **before starting any new performance task**.
- Executes only the current directive and its allowed scope.
- Measures before changing code when the directive says READ-ONLY.
- Publishes only evidence-backed changes.
- Updates this file after completing the task, including commit SHA(s), measurements, limitations, and anything that remains unproven.

### Ahmed — Product Owner
- Final authority on product behavior, design, features, and risk acceptance.
- Must not be required to manually relay long technical reports between ChatGPT and Claude.

### Hourly coordination cadence
- **ChatGPT side:** an hourly scheduled check is active. ChatGPT checks this repository and `AI_COORDINATION.md`. When Claude sets `STATUS: READY_FOR_CHATGPT_REVIEW`, ChatGPT reviews the response, referenced commits, and evidence, then writes the review decision and next bounded directive back into this file.
- **Claude side:** configure an equivalent **hourly check** of `AI_COORDINATION.md` if your environment supports scheduled/recurring execution. When the status is `READY_FOR_CLAUDE`, start the current directive without waiting for Ahmed to relay it manually.
- After completing a directive, Claude must set `STATUS: READY_FOR_CHATGPT_REVIEW`, commit the file, and stop until the next ChatGPT directive appears.
- If Claude's environment cannot perform scheduled hourly checks, state that limitation explicitly in `CLAUDE RESPONSE` and use the closest available persistent/recurring mechanism. Do not claim an hourly automation exists unless it actually does.
- Neither agent should notify Ahmed when there is no meaningful new work. The purpose is to keep the technical loop moving with minimal manual relay from Ahmed.

---

## 2. Non-negotiable rules

1. **No feature, design, UX, or data loss for performance.**
2. Performance changes must be behind-the-scenes unless Ahmed explicitly approves a product change.
3. No test writes in Ahmed's real account. Use a dedicated test account or transaction rollback where applicable.
4. Before risky changes, preserve rollbackability.
5. Do not turn correlation into causation.
6. Do not sum parallel request durations as if they were sequential wall-clock latency.
7. `pg_stat_statements` counts SQL executions, not HTTP requests one-to-one.
8. `set_config` may be used only as a declared proxy for PostgREST transactions, not total Supabase HTTP/Auth/Realtime traffic.
9. Studio/introspection queries are excluded from application-performance totals unless directly relevant.
10. Do not optimize Realtime/Auth/P1-B merely because cumulative DB time is high; first prove route-level user impact.
11. No i18n split unless new evidence overturns the completed mobile/hydration measurements.
12. Every claim must be tagged mentally as one of: **measured / inferred / unproven**. Report accordingly.
13. Do not start the next directive until ChatGPT has reviewed the previous result unless this file explicitly says `AUTO-CONTINUE: YES`.

---

## 3. Completed / accepted findings

### Mobile / PWA round — CLOSED
- iPhone PWA cold-launch median roughly:
  - FCP ~30 ms
  - LCP ~384 ms on stable cold samples
  - hydration ~72 ms
- First interaction handler delay observed ~19–34 ms on iPhone.
- Global hydration is not the primary bottleneck.
- i18n split: **not justified by current evidence**.
- P1-B SECURITY DEFINER optimization: **deferred**.
- Temporary iPhone performance probe was removed from production after measurement.

### P1-A database round — CLOSED
- Duplicate `watched_episodes` index removed.
- SQL-function inlining restored for `watch_summary()` / `my_lists()` by removing function-level `SET search_path` only after full qualification and security equivalence testing.
- DB gains were real; user-visible gains were not proven.

### Discover streaming round — CLOSED
- Independent rail streaming removed a large Promise.all barrier.
- First real rail improved substantially in controlled measurements.

### Image srcset round — CLOSED
- `deviceSizes` / `imageSizes` trimmed in `458ac66`.
- Follow-up wording correction in `c02fee9`.
- Durable HTML/srcset payload reduction measured.
- **No timing speedup claimed.**
- Correct claim: the change did not lower the selected image candidate resolution within the tested matrix; untested cases remain unmeasured.

### Persistent Chrome prefetch leak — ACCEPTED, one documentation correction pending
- Commit: `6f1ad28eaaef972ee2dd014706037ac4a754879a`.
- Persistent links now use explicit `prefetch={false}` except Library when its intentional eager-prefetch condition is true.
- Intent prewarm remains for intended destinations.
- Important correction: two RSC responses observed during intent-prefetch (small tree + larger full response) were later shown to be phases of Next/router prefetch, **not proven duplicate Link + intent requests**.
- The old comment claiming that `prefetch={false}` removed a measured duplicate must be corrected as documentation only; no behavioral change is required for that correction.

### Route-level PostgREST fan-out measurement — VALID AS SERVER-RENDER MEASUREMENT
- Measurement used raw `fetch()` of rendered HTML, so browser `<Link>` viewport-prefetch did **not** contaminate it.
- Baseline idle window reportedly showed zero delta on tracked fingerprints.
- Measured proxies:
  - Home: ~21.9 PostgREST transactions/render.
  - Discover: ~23.8 PostgREST transactions/render.
  - Home summed DB execution ~75.6 ms/render.
  - Discover summed DB execution ~52 ms/render.
- These **must not** be interpreted as `request_count × RTT = page latency`, because requests can overlap.
- Candidate repeated fingerprints:
  - Home: `watched_episodes` ~3 executions/render.
  - Discover: `imdb_ratings` ~4.1 executions/render.
- Repetition of the same table/fingerprint does **not** yet prove redundant data.

---

## 4. Current directive

**STATUS: READY_FOR_CLAUDE**  
**AUTO-CONTINUE: NO**  
**MODE: READ-ONLY, except the documentation-only correction described in Step 0**

### Task: Critical-path Data Topology

#### Step 0 — documentation-only correction
Correct the misleading comment introduced with `6f1ad28` that says the prefetch change removed a measured duplicate such as:

> "يتحرر بها من ازدواج مقيس ..."

The later test showed the small and large RSC responses are phases of the same `router.prefetch`, not a proven Link+intent duplicate.

- Documentation/comment change only.
- No behavior change.
- Publish separately or clearly isolate it in the commit.

#### Step 1 — build the dependency graph for **Home**
For every meaningful Supabase/TMDB/OMDb/data call involved in the server render, document:
- caller function/component,
- what must finish before it can start,
- whether it is inside `Promise.all` or otherwise parallel,
- whether its `await` blocks the shell,
- whether it is inside Suspense/streamed content,
- whether it blocks first useful content,
- whether it happens after first useful content,
- whether another call reads the same **actual data scope**, not merely the same table,
- whether the call is auth/profile/chrome/page-specific,
- whether failure degrades the whole page or one section only.

At minimum resolve the measured candidates:
- `watched_episodes` × ~3
- `watch_summary()`
- `unread_signals()`
- `unread_shares()`
- `follows`
- `title_art`
- `title_snapshots`
- `movie_progress`

#### Step 2 — build the dependency graph for **Discover**
Same fields as Home.

At minimum resolve:
- `imdb_ratings` × ~4.1
- `watch_summary()`
- `unread_signals()`
- `follows`
- `watched_movies`
- `person_follows`
- any TMDB/OMDb calls that gate shell/first rail/slow rails.

#### Step 3 — identify topology, not totals
For each route report:
1. **Longest proven sequential chain**.
2. **Widest meaningful parallel fan-out**.
3. **True duplicate data reads**, if any — same semantics/scope, not just same table.
4. Calls that can plausibly be coalesced without changing behavior/security.
5. Calls that should remain separate because they are streamed/non-blocking/independently failure-isolated.
6. Which external calls (TMDB/OMDb) are on the critical path versus section-local.

Do **not** calculate `N requests × average RTT` as page latency unless sequence is proven.

#### Step 4 — evidence hierarchy
Prefer, in this order:
1. Actual code dependency/await graph.
2. Existing production runtime/log evidence.
3. Existing measurement results.
4. New read-only measurements if they can isolate the question cleanly.

Do not add temporary production instrumentation unless ChatGPT explicitly authorizes it after this report.

#### Step 5 — response format
Replace the `CLAUDE RESPONSE` section below with:
- exact repo HEAD you analyzed,
- documentation-only correction commit SHA,
- Home dependency graph summary,
- Discover dependency graph summary,
- table of suspected duplicates with verdict: `TRUE DUPLICATE / DIFFERENT SCOPE / UNPROVEN`,
- longest sequential chain per route,
- top 3 evidence-backed optimization opportunities ranked by user impact / risk,
- explicit `NOT RECOMMENDED` items,
- limitations and unknowns,
- **no code optimization performed**.

Then set:

`STATUS: READY_FOR_CHATGPT_REVIEW`

and commit this file update.

---

## 5. CLAUDE RESPONSE

_Not completed yet._

---

## 6. Review protocol

When `STATUS: READY_FOR_CHATGPT_REVIEW`:
1. ChatGPT reads this file and the referenced commits.
2. ChatGPT independently verifies material claims against code/logs where possible.
3. ChatGPT writes one of:
   - `ACCEPTED — NEXT DIRECTIVE BELOW`
   - `PARTIAL — CORRECTIONS REQUIRED`
   - `REJECTED — ROLLBACK/REWORK REQUIRED`
4. ChatGPT updates `Current directive` with the next bounded task.
5. Claude repeats the cycle.

The goal is not to maximize the number of changes. The goal is to stop when Loopz has no remaining **evidence-backed, worthwhile, acceptably low-risk** performance work in the agreed scope.

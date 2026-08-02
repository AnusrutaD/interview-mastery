# Architecture

## Layering

Dependencies point **inward**. `core` knows nothing about React, Next.js or Prisma.

```
src/
├── core/          Pure domain. No framework imports. Fully unit-tested.
│   ├── domain/    mastery, difficulty, review, timer, progress
│   └── time/      ist (single source of IST truth), format
│
├── server/        Server-only. Never imported by client components.
│   ├── db/        Prisma singleton
│   ├── auth/      session resolution (cookie or x-api-key)
│   ├── http/      withAuth wrapper, ApiError, CORS, body parsing
│   ├── services/  all Prisma access lives here
│   └── validation/ zod schemas
│
├── features/      Client feature modules (hooks + components)
│   ├── progress/  api client, useProgress, useProblemSession, useLiveSync
│   ├── timer/     useSolveTimer, SolveTimer
│   ├── problems/  ProblemTable, ProblemFilters, MasterySelector
│   ├── notes/     MarkdownNote
│   ├── activity/  period maths
│   └── dashboard/ Dashboard, StatsBar, TopicGrid
│
├── components/    Cross-feature: ui primitives, layout, providers
├── data/          Static catalogue (problems, category icons + hints)
├── lib/           http client (dedup), cn
└── app/           Next.js routes — thin, delegate to features/services
```

**Rule:** a page should read as a composition of hooks and components. If a page
contains business logic, that logic belongs in `core` or a feature hook.

## Load-bearing decisions

### `lastMasteryAt` drives scheduling, not `updatedAt`
Prisma's `@updatedAt` is bumped by *any* write, including notes. Keying spaced
repetition off it meant editing a note silently reset the review schedule.
`lastMasteryAt` is stamped only on deliberate practice. See `core/domain/review.ts`.

### Calendar days, not elapsed hours
A problem solved at 22:00 is one day old at 09:00 the next morning, even though
only 11 hours passed. All date maths goes through `core/time/ist.ts`; no other
module may define an IST offset.

### The timer is a value, not React state
`core/domain/timer.ts` models the timer as an immutable value with explicit
transitions. Elapsed time is always derived from wall-clock, never accumulated
by a tick, so background-tab throttling cannot cause drift and callbacks cannot
capture a stale count. Sessions under `MIN_MEANINGFUL_SESSION_SECONDS` are
discarded — a recorded "0:00 solve" is worse than no data.

### Two submission paths, one code path
A problem can be completed in-app *or* on LeetCode via the Chrome extension.
`useProblemSession` watches `lastMasteryAt` for values newer than the one it
knows about to detect the external case, guarded by page mount time so it never
claims to have timed an attempt it did not observe.

### Field semantics in `upsertProgress`
- `mastery` present → practice: bump `repeatCount`, stamp `lastMasteryAt`
- `mastery` absent → notes or time flush: must not touch either
- `timeSeconds` → always additive, independent of the above

This is what lets the timer record elapsed time after an externally-recorded
submission without double-counting the attempt.

## Testing

`npm test` runs Vitest over `src/core`. The domain layer is pure, so the logic
that actually broke in production is covered without a DOM or a database.

## Adding a feature

1. Model the rules in `core/domain` and unit-test them.
2. Add persistence in `server/services`, validation in `server/validation`.
3. Expose a route in `app/api` using `withAuth` — it should be ~5 lines.
4. Add a client method in the feature's `api/` module.
5. Build the hook, then the component. Keep the page thin.

## System Design track

A second study track lives alongside DSA, sharing the domain layer but not the
persistence layer.

### Content

Markdown with YAML frontmatter under `content/system-design/{concepts,exercises}/`.
Add a file, it appears in the roadmap — there is no registry to update.

Frontmatter carries `title`, `pattern`, `level`, `order`, `minutes`, `summary`,
plus `quiz` (concepts) or `rubric` (exercises). A `## Reference Solution`
heading splits the body; everything after it is withheld behind a disclosure and
a warning until the exercise has been attempted.

`src/server/content/frontmatter.ts` is a deliberately minimal YAML subset
parser. If the format ever needs anchors or multi-line folding, that is the
signal to adopt `gray-matter` rather than extend it.

### Why rubrics

Nobody grades their own open-ended design honestly. "I think that went okay" is
not a signal. A weighted checklist of what a strong answer covers turns a vague
feeling into a score, and the unchecked boxes are literally the study list for
the next attempt. `suggestMastery` maps the band to a mastery level, with
"needs work" mapping to `unsolved` — attempted, did not hold up.

Weights exist because omissions are not equal: not estimating QPS is a bigger
miss than not naming a specific database product.

### Why a separate table

`StudyProgress` is not a polymorphic extension of `Progress`. They are different
aggregates: `Progress` is keyed on the numeric NeetCode catalogue and written by
an external client (the Chrome extension via API key); study items are
slug-keyed and carry quiz and rubric state meaningless for a coding problem.
Merging them would leave half the columns permanently null.

The shared *domain* logic — mastery levels, review scheduling, the solve timer —
is reused unchanged. Only persistence differs.

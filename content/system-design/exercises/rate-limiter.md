---
title: Design a Distributed Rate Limiter
pattern: Rate Limiting
level: Intermediate
order: 21
minutes: 40
summary: Token bucket vs sliding window, distributed counter state, and failing open vs closed.
rubric:
  - title: Requirements
    criteria:
      - id: rl-req-1
        label: Clarified what is being limited and at what granularity
        weight: 2
        hint: Per user, per IP, per API key, per endpoint? Different limits usually coexist and must compose.
      - id: rl-req-2
        label: Decided where the limiter runs
        hint: Edge/gateway, a middleware in each service, or a sidecar. Each has different accuracy and blast radius.
      - id: rl-req-3
        label: Stated the accuracy requirement
        weight: 2
        hint: Must it be exact, or is 5% overshoot acceptable? This single answer determines whether you need coordination.
      - id: rl-req-4
        label: Specified the response for a limited request
        hint: 429 with Retry-After, plus X-RateLimit-Remaining headers so clients can self-regulate.
  - title: Algorithm
    criteria:
      - id: rl-algo-1
        label: Chose an algorithm and justified it against alternatives
        weight: 2
        hint: Fixed window, sliding log, sliding window counter, token bucket, leaky bucket - each trades memory, accuracy and burst behaviour.
      - id: rl-algo-2
        label: Identified the fixed-window boundary problem
        weight: 2
        hint: A fixed window allows 2x the limit across a boundary - full quota at 0:59 and again at 1:00.
      - id: rl-algo-3
        label: Addressed whether bursts should be allowed
        hint: Token bucket permits bursts up to bucket size; leaky bucket smooths output completely. This is a product decision.
      - id: rl-algo-4
        label: Analysed memory cost per tracked key
        hint: A sliding log stores every timestamp - unusable at scale. A counter stores a few bytes.
  - title: Distributed state
    criteria:
      - id: rl-dist-1
        label: Explained how counters are shared across many limiter instances
        weight: 2
        hint: Per-instance counters mean N instances allow N times the limit. Centralised store, or divide the quota.
      - id: rl-dist-2
        label: Made the check-and-increment atomic
        weight: 2
        hint: Read-then-write races under concurrency. Use a Redis Lua script or INCR with expiry.
      - id: rl-dist-3
        label: Addressed the latency added to every request
        hint: The limiter is on the critical path. A network hop per request needs a co-located store or local approximation.
      - id: rl-dist-4
        label: Handled a hot key
        hint: One very active tenant concentrates all traffic on one Redis node.
  - title: Failure handling
    criteria:
      - id: rl-fail-1
        label: Chose fail-open or fail-closed and justified it
        weight: 2
        hint: If Redis is down - allow everything (risking overload) or reject everything (guaranteed outage)? Usually fail open, with a local fallback.
      - id: rl-fail-2
        label: Described degraded-mode behaviour
        hint: Fall back to a local in-process limit so there is still some protection.
      - id: rl-fail-3
        label: Named what to monitor
        hint: Rejection rate by key, limiter latency, store availability, top limited callers.
---

Design a rate limiter that protects a service receiving traffic across many application servers.

**Write your design in the notes below before scoring yourself.**

## The prompt

An API must enforce limits like *1,000 requests per user per hour* and *100 requests per IP per minute*. The API runs on many instances behind a load balancer, so any instance may see any request.

## Scope

**In scope**

- Multiple rules at different granularities (user, IP, API key, endpoint)
- Correct behaviour across a fleet of servers
- Clear rejection responses
- Sensible behaviour when the limiter's own dependencies fail

**Out of scope**

- Billing and quota purchase
- DDoS protection at the network layer
- Authentication

## Numbers to design against

- **50K QPS** across the fleet
- **10M** distinct users
- **200** API server instances
- Added latency budget: **under 5ms p99**

## What to cover

1. **Where the limiter runs** and why
2. **Which algorithm**, and what it costs in memory and accuracy
3. **How counters are shared** across 200 instances
4. **Atomicity** — the check and the increment must not race
5. **Failure behaviour** — the limiter itself will have outages
6. **API contract** — headers and status codes

## Hints if you are stuck

- Start by asking how exact the limit has to be. The answer changes the whole design.
- Consider what happens with a fixed one-minute window at 0:59 and 1:00.
- 200 instances each keeping their own counter is the trap. What does that actually enforce?

## Reference Solution

### Requirements first

The decisive question is **accuracy**. "Approximately 1,000, occasionally 1,050" permits cheap local approximations. "Never 1,001" forces coordination on every request. Most production limiters accept small overshoot, and saying so explicitly is the mark of someone who has built one.

Response contract:

```
429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1735689600
```

Returning remaining quota lets well-behaved clients self-regulate, which reduces load more than rejection ever does.

### Algorithms

| Algorithm | Memory/key | Accuracy | Bursts |
|---|---|---|---|
| **Fixed window** | 1 counter | Poor at boundaries | Allowed |
| **Sliding log** | Every timestamp | Exact | Controlled |
| **Sliding window counter** | 2 counters | Very good | Smoothed |
| **Token bucket** | Count + timestamp | Good | Allowed, bounded |
| **Leaky bucket** | Queue | Good | Smoothed out |

**The fixed-window boundary problem** is the thing to name: with a limit of 100/minute, a client can send 100 at 0:59 and 100 at 1:00 — **200 requests in two seconds** while never violating the stated rule.

**Sliding window counter** fixes this cheaply. Keep the current and previous window counts and interpolate:

```
estimate = current + previous × (fraction of previous window still in view)
```

At 30 seconds into a minute window: `current + previous × 0.5`. Two integers per key, no boundary exploit, small bounded error.

**Token bucket** is the other strong choice. Tokens refill at a fixed rate; each request takes one; an empty bucket means rejection. Bucket size caps burst, refill rate caps sustained throughput — and the two being tunable separately is genuinely useful. Most public APIs work this way.

Sliding log is exact and stores every timestamp — at 10M users it is not viable.

### Distributed state

Here is the trap: 200 instances each enforcing "1,000/hour" locally enforces **200,000/hour**.

**Centralised counter in Redis** is the standard answer. Atomicity is mandatory, because read-then-write races:

```lua
-- Atomic check-and-increment; returns remaining, or -1 if limited
local current = redis.call('GET', KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return -1
end
local new = redis.call('INCR', KEYS[1])
if new == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return tonumber(ARGV[1]) - new
```

A Lua script runs atomically in Redis, so the check and increment cannot interleave. `INCR` plus `EXPIRE` alone has a subtle bug: if the process dies between them, the key never expires.

**Latency.** A network hop on every one of 50K QPS is real cost. Mitigations: co-locate Redis in the same AZ, pipeline where possible, and for high-volume keys use a **local token bucket topped up from Redis in batches** — claim 50 tokens at a time and spend them locally. Small overshoot, ~50x fewer round trips.

**Hot keys.** One very active tenant sends all their traffic to one Redis node. Shard the key (`user:123:shard:0-9`) with the quota divided across shards.

### Failure handling

Redis will be unavailable at some point. The choice:

- **Fail open** — allow requests. The service stays up and risks overload.
- **Fail closed** — reject everything. The limiter's outage becomes a total outage.

**Fail open is almost always correct.** A rate limiter is protective infrastructure; it should not be able to take down the thing it protects. But fail open to a *local* in-process limit rather than to no limit at all — degraded protection beats none.

For a limiter guarding something genuinely dangerous (payment initiation, password reset), fail closed is defensible. State which one you chose and why.

### Architecture

```
Client → API Gateway (coarse IP limits, cheap rejection at the edge)
       → Service instance
           → local token bucket (fast path, batched)
           → Redis cluster (source of truth)
```

Two tiers: cheap approximate limiting at the edge to shed obvious abuse before it costs anything, precise limiting closer to the service for correctness.

### Monitoring

Rejection rate by rule and by key, limiter p99 latency, Redis availability and hit rate, and a leaderboard of the most-limited callers — which is usually how you discover a broken client retrying in a tight loop.

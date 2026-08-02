---
title: Design a URL Shortener
pattern: High Read Traffic
level: Fundamental
order: 20
minutes: 40
summary: TinyURL-style service. Key generation, an extremely read-heavy access pattern, and caching.
rubric:
  - title: Requirements and estimation
    criteria:
      - id: url-req-1
        label: Separated functional requirements from non-functional ones
        hint: Shorten, redirect, optional custom alias and expiry. Then availability, latency, and the read/write ratio.
      - id: url-req-2
        label: Estimated read/write ratio and QPS
        weight: 2
        hint: Roughly 100:1 read-heavy. 100M writes/day is about 1.2K write QPS and 120K read QPS at peak.
      - id: url-req-3
        label: Estimated storage and checked it against one machine
        hint: ~500 bytes per record, 100M/day, 5 years is about 90TB. Enough to justify partitioning.
      - id: url-req-4
        label: Stated the redirect latency target
        hint: This is on the critical path of a page load. Tens of milliseconds, not hundreds.
  - title: Key generation
    criteria:
      - id: url-key-1
        label: Chose a key length and justified it from the numbers
        weight: 2
        hint: Base62 with 7 characters gives 3.5 trillion keys. Show the arithmetic against projected volume.
      - id: url-key-2
        label: Picked a generation strategy and named its failure mode
        weight: 2
        hint: Hash-and-truncate collides; random needs an existence check; a counter with base62 encoding is collision-free but leaks volume and is sequential.
      - id: url-key-3
        label: Explained how collisions are detected or avoided
        hint: A conditional insert that fails on duplicate is better than read-then-write, which races.
      - id: url-key-4
        label: Handled custom aliases
        hint: Different write path - uniqueness must be enforced, and reserved words blocked.
  - title: Storage and access
    criteria:
      - id: url-store-1
        label: Chose a datastore and justified it from the access pattern
        weight: 2
        hint: Access is a single key lookup with no joins. A KV store fits naturally; so does an indexed relational table.
      - id: url-store-2
        label: Chose a partition key
        hint: Shard on the short code itself - every read is by that key.
      - id: url-store-3
        label: Designed the cache layer and stated a TTL
        weight: 2
        hint: Extremely read-heavy with a strong long tail. Cache hot codes; state the eviction policy and TTL.
      - id: url-store-4
        label: Addressed hot keys
        hint: One viral link can saturate a single cache node. Replicate the key, or add a short-TTL local cache.
  - title: API and correctness
    criteria:
      - id: url-api-1
        label: Specified the redirect status code and why
        hint: 301 is cached by browsers and kills your analytics; 302 keeps every hit visible. This is a real trade.
      - id: url-api-2
        label: Handled expiry and missing codes
        hint: 404 for unknown, 410 for expired. How are expired rows reclaimed?
      - id: url-api-3
        label: Addressed abuse
        hint: Rate limiting on creation, plus malicious URL scanning - shorteners are a phishing vector.
  - title: Scale and operations
    criteria:
      - id: url-ops-1
        label: Explained how the system stays available if the database is degraded
        hint: Reads can be served from cache. Can creation fail independently of redirects?
      - id: url-ops-2
        label: Discussed analytics without slowing the redirect path
        weight: 2
        hint: Do not write to the database synchronously on redirect. Emit an event to a queue and aggregate offline.
      - id: url-ops-3
        label: Named what you would monitor
        hint: Redirect p99, cache hit rate, key generation failures, 404 rate.
---

Design a URL shortening service like TinyURL or bit.ly.

**Write your design in the notes below before scoring yourself.** Sketch the API, the data model, and the request flow for both operations.

## The prompt

Users submit a long URL and receive a short one. Anyone visiting the short URL is redirected to the original.

## Scope

**In scope**

- Shorten a URL, returning a short code
- Redirect a short code to its original URL
- Optional custom aliases
- Optional expiry
- Basic click analytics

**Out of scope**

- User accounts and authentication
- Editing an existing link's destination
- A web UI

## Numbers to design against

- **100M** new URLs per day
- **100:1** read-to-write ratio
- Links are readable for **5 years**
- Redirect latency: **p99 under 100ms**
- Availability: redirects must stay up even during partial degradation

## What to cover

1. **Estimate** — QPS for both paths, storage over five years
2. **API** — the two endpoints, request and response shapes, status codes
3. **Key generation** — this is the core of the problem
4. **Data model and datastore** — with the partition key
5. **Caching** — this system is dominated by reads
6. **Analytics** — without slowing the redirect
7. **Failure modes** — what happens when the cache or database is unhealthy

## Hints if you are stuck

- Work out the key length first; the arithmetic constrains everything else.
- There are three families of key generation. Each has a distinct failure mode. Naming the trade matters more than picking the "right" one.
- Ask yourself what happens the moment a link goes viral.

## Reference Solution

### Estimation

- Writes: 100M/day ÷ 86,400 ≈ **1.2K QPS**, peak ~3K
- Reads: 100:1 → **120K QPS**, peak ~300K
- Storage: ~500 bytes/record × 100M × 365 × 5 ≈ **90 TB**

The read number rules out hitting the database on every redirect. The storage number rules out a single node.

### API

```
POST /api/v1/urls
  { "url": "https://...", "alias": "optional", "expiresAt": "optional" }
  → 201 { "shortUrl": "https://sho.rt/aB3xY9z", "code": "aB3xY9z" }

GET /{code}
  → 302 Location: https://original...
  → 404 unknown   410 expired
```

**301 vs 302.** A 301 is cached by the browser, so subsequent visits never reach you — excellent for latency and cost, fatal for analytics and for ever changing the destination. A 302 keeps every hit visible. Most shorteners choose 302 deliberately, trading load for control.

### Key generation

Length first: base62 (`a-zA-Z0-9`) at 7 characters gives 62⁷ ≈ **3.5 trillion** keys. Against 100M/day for 5 years (~180B), that is comfortable headroom.

Three approaches:

| Approach | Mechanism | Failure mode |
|---|---|---|
| **Hash + truncate** | MD5 the URL, take 7 chars | Collisions are certain; needs check-and-retry |
| **Random** | Generate 7 random chars | Must check existence; collisions rise as space fills |
| **Counter + encode** | Global counter, base62 it | No collisions; sequential and enumerable, leaks volume |

The pragmatic answer is a **counter with a distributed range allocator**: each application server claims a block of 10,000 ids from a coordination service, then hands them out locally. No coordination per request, no collisions. Encode the id and optionally XOR with a fixed secret so the output does not look sequential.

Custom aliases take a different path — a conditional insert that fails on conflict, plus a reserved-word blocklist (`api`, `admin`, `login`).

Critically, use **conditional insert**, not read-then-write. The latter races: two requests both read "not found" and both insert.

### Storage

The access pattern is a single-key lookup with no joins and no range scans. That points at a key-value store, though an indexed relational table is defensible at this size.

```
code (PK) | long_url | created_at | expires_at | creator_ip
```

Partition on `code` — every read is by that key, so every read is single-shard. Consistent hashing keeps resharding tractable.

### Caching

At 120K read QPS with a strong long tail, the cache is the system.

- Redis in front of the datastore, **cache-aside**
- Key `code`, value the long URL
- TTL ~24h with LRU eviction; the working set is heavily skewed toward recent and viral links
- Realistic hit rate above 90%, which reduces database load to a few thousand QPS

**Hot keys matter here.** A single viral link routes to one cache node and can saturate it — adding cache nodes does not help. Replicate the value under `code:v1..v10` and pick at random, or put a short-TTL in-process cache in front of Redis.

Entries are immutable (the destination never changes), so invalidation is a non-issue. That is a genuine simplification worth stating.

### Analytics

Never write to the database on the redirect path. Emit an event to Kafka and return immediately:

```
GET /{code} → cache lookup → 302 → async: emit {code, ts, ip, ua}
```

Consumers aggregate into a separate analytics store. Counts are eventually consistent, which is entirely acceptable for click statistics.

### Failure modes

- **Database degraded** — redirects still serve from cache. Creation fails; redirects do not. Splitting these paths is the key availability insight.
- **Cache cold or down** — full traffic hits the database. Requires either enough provisioned capacity or aggressive rate limiting during recovery.
- **Abuse** — rate limit creation per IP and per account; scan submitted URLs against a malware list, since shorteners are a favoured phishing tool.

### What to monitor

Redirect p99, cache hit rate, 404 rate (a spike suggests scanning), key allocation failures, and analytics consumer lag.

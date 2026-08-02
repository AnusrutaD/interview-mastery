---
title: Caching
pattern: Caching
level: Fundamental
order: 2
minutes: 11
summary: Cache-aside vs write-through, eviction, TTLs, and the failure modes that take systems down.
quiz:
  - id: cache-1
    q: In a cache-aside (lazy loading) setup, who writes to the cache?
    options:
      - The database, via a trigger
      - The application, after a cache miss
      - The cache, by polling the database
      - The load balancer
    answer: 1
    explain: Cache-aside puts the application in control - on a miss it reads the database, then populates the cache. Simple and resilient (a cache outage degrades to slow, not broken), but the first request for any key always pays full latency.
  - id: cache-2
    q: A celebrity with 50M followers posts. Every request for their profile hits the same cache key on one node, saturating it. What is this called and what actually fixes it?
    options:
      - Cache stampede - fix with a longer TTL
      - Hot key - fix by replicating the key across nodes or caching locally in the app
      - Cache pollution - fix with LRU eviction
      - Thundering herd - fix by sharding the database
    answer: 1
    explain: This is a hot key. Consistent hashing sends one key to exactly one node, so more cache nodes does not help. Fixes replicate the value under several suffixed keys (celeb:123:v1..v10) or add a short-TTL in-process cache in front of the shared one.
  - id: cache-3
    q: A popular key expires and 10,000 concurrent requests all miss and hit the database simultaneously. What is the standard mitigation?
    options:
      - Increase the cache size
      - Never expire keys
      - A lock or single-flight so one request refills while others wait or serve stale
      - Switch from LRU to LFU
    answer: 2
    explain: This is a cache stampede (thundering herd). The fix is to ensure only one request recomputes: a distributed lock, request coalescing, or probabilistic early expiry that refreshes slightly before the TTL under low contention.
  - id: cache-4
    q: Write-through caching guarantees the cache is never stale. What does it cost?
    options:
      - Higher write latency, and it caches data that may never be read
      - Weaker read consistency
      - It cannot be used with Redis
      - Unbounded memory growth
    answer: 0
    explain: Write-through writes to cache and database synchronously, so every write pays both latencies, and you populate the cache with data nobody may request. It trades write cost for read freshness.
  - id: cache-5
    q: What is the most important question to ask before adding a cache?
    options:
      - Redis or Memcached?
      - How much staleness can this data tolerate?
      - What eviction policy should we use?
      - How many nodes do we need?
    answer: 1
    explain: A cache is a deliberate trade of freshness for speed. If the answer is "none" the cache must be invalidated on every write, which often costs more than it saves. Staleness tolerance drives every other decision, including whether to cache at all.
---

Caching is the highest-leverage move in most systems, because most systems are read-heavy and most reads are for the same small subset of data. It is also where a surprising number of outages originate.

The framing that matters: **a cache is a deliberate trade of freshness for speed.** Every design decision follows from how much staleness the data can tolerate.

## Cache-aside (lazy loading)

The default, and the one to reach for unless you have a reason not to.

```
read(key):
    value = cache.get(key)
    if value is not None:
        return value                  # hit
    value = db.query(key)             # miss
    cache.set(key, value, ttl=300)
    return value
```

**Good:** only requested data is cached. A cache outage degrades performance rather than correctness — reads still work, just slowly.

**Bad:** every key pays one slow request. Data goes stale until the TTL expires, since writes go straight to the database and the cache never hears about them.

## Write-through

Writes go to cache and database together, synchronously.

**Good:** the cache is never stale.

**Bad:** every write pays both latencies, and you cache data that may never be read. Pairs best with a TTL so unread entries eventually fall out.

## Write-behind

Write to the cache, acknowledge immediately, flush to the database asynchronously.

Very fast writes, and a genuine durability risk: acknowledged writes live only in memory until the flush. Reasonable for view counts and metrics; not for payments.

## Eviction

Memory is finite, so something must go.

| Policy | Evicts | Fits |
|---|---|---|
| **LRU** | Least recently used | General purpose — the sane default |
| **LFU** | Least frequently used | Stable popularity distributions |
| **TTL** | Whatever expired | Data with a natural freshness window |
| **FIFO** | Oldest inserted | Rarely the right answer |

Most production caches combine LRU with a TTL: bound memory *and* bound staleness.

**TTL choice is a real design decision.** Too long and users see stale data. Too short and you lose the hit rate that justified the cache. State it explicitly — "5 minutes, because pricing can lag that long without harm" is a much better answer than "we'll cache it."

## The failure modes

This is what separates a working cache from an outage.

**Cache stampede (thundering herd).** A hot key expires. Ten thousand concurrent requests miss simultaneously and stampede the database, which falls over. Fix by ensuring only one request recomputes: a lock, single-flight coalescing, or probabilistic early refresh before expiry.

**Hot keys.** Consistent hashing maps a key to exactly one node. If one key is disproportionately popular — a celebrity profile, a viral post — that single node saturates while the rest idle. Adding cache nodes does not help at all, which is what makes this counter-intuitive under pressure. Fix by replicating the value under several suffixed keys and picking at random, or by adding a short-TTL in-process cache in front of the shared one.

**Cold start.** A cache restart means 0% hit rate and full traffic on the database, which may not survive it. Warm critical keys before taking traffic.

**Cache penetration.** Requests for keys that do not exist always miss and always reach the database — a cheap attack vector. Cache the negative result, or put a Bloom filter in front.

## Invalidation

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

Three approaches, in increasing order of cost and correctness:

1. **TTL only** — simplest, guarantees bounded staleness, guarantees *some* staleness.
2. **Explicit invalidation on write** — fresher, but every writer must know every affected key. Easy to miss one.
3. **Change data capture** — subscribe to the database's replication stream and invalidate from there. Correct and decoupled; significant infrastructure.

In an interview, saying "TTL of 60 seconds, plus explicit invalidation on the write path for the fields users notice immediately" shows you understand the trade rather than picking a side.

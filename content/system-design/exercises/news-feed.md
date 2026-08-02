---
title: Design a News Feed
pattern: Fanout
level: Advanced
order: 22
minutes: 45
summary: Fanout-on-write vs on-read, the celebrity problem, and ranking a timeline at scale.
rubric:
  - title: Requirements
    criteria:
      - id: nf-req-1
        label: Established the read/write ratio and feed size
        weight: 2
        hint: Feed views vastly outnumber posts. That asymmetry is the whole basis for choosing fanout strategy.
      - id: nf-req-2
        label: Asked whether the feed is chronological or ranked
        hint: Ranking changes everything - a precomputed chronological list cannot be reordered cheaply.
      - id: nf-req-3
        label: Stated the acceptable delay before a post appears
        weight: 2
        hint: Seconds of delay unlock async fanout. Instant visibility forces read-time work.
      - id: nf-req-4
        label: Noted the follower distribution is extremely skewed
        hint: Median user has hundreds of followers; the top has tens of millions. Averages are useless here.
  - title: Fanout strategy
    criteria:
      - id: nf-fan-1
        label: Explained fanout-on-write and its cost
        weight: 2
        hint: Push the post into every follower's precomputed feed. Reads become a single lookup; writes become O(followers).
      - id: nf-fan-2
        label: Explained fanout-on-read and its cost
        hint: Build the feed at request time by querying followed users. Cheap writes, expensive and repeated reads.
      - id: nf-fan-3
        label: Identified the celebrity problem
        weight: 2
        hint: A post from someone with 50M followers means 50M writes. That cannot be synchronous, and may not be viable at all.
      - id: nf-fan-4
        label: Proposed a hybrid and defined the threshold
        weight: 2
        hint: Push for normal users, pull for celebrities, merge at read time. State roughly where the cutoff sits and why.
  - title: Storage and serving
    criteria:
      - id: nf-store-1
        label: Designed the feed store and bounded its size
        weight: 2
        hint: Feeds are capped lists, not full history. Store post ids, not post bodies.
      - id: nf-store-2
        label: Separated feed ids from post content
        hint: Storing the full post per follower multiplies storage by follower count. Store ids and hydrate from a cache.
      - id: nf-store-3
        label: Chose a partition key for the feed store
        hint: Shard by user_id - a feed read is always for one user.
      - id: nf-store-4
        label: Designed pagination that survives insertions
        hint: Offset pagination breaks when new posts arrive mid-scroll. Use a cursor.
  - title: Scale and correctness
    criteria:
      - id: nf-scale-1
        label: Made fanout asynchronous with a queue
        hint: The post request must return immediately; fanout happens in workers.
      - id: nf-scale-2
        label: Handled inactive users
        hint: Fanning out to accounts that have not logged in for a year is wasted work and storage.
      - id: nf-scale-3
        label: Addressed deletes and privacy changes
        hint: A deleted post must vanish from millions of precomputed feeds, or be filtered at read time.
      - id: nf-scale-4
        label: Named what to monitor
        hint: Fanout lag, feed read p99, cache hit rate, queue depth.
---

Design the news feed for a social network — the timeline of posts from accounts a user follows.

**Write your design in the notes below before scoring yourself.**

## The prompt

Users follow other users. Opening the app shows a feed of recent posts from those accounts, newest-first or ranked.

## Scope

**In scope**

- Post creation
- Feed retrieval with pagination
- Follow and unfollow
- Handling wildly uneven follower counts

**Out of scope**

- Comments and reactions
- Direct messages
- Media transcoding
- The ranking model itself (assume a scoring function exists)

## Numbers to design against

- **500M** daily active users
- **50M** posts per day
- Average user follows **300** accounts
- Median followers: **~200**. Maximum: **50M**
- Feed reads: **~10 per user per day** → several hundred thousand QPS
- Feed load p99: **under 200ms**

## What to cover

1. **Read/write asymmetry** — establish it before choosing anything
2. **Fanout strategy** — the central decision
3. **The celebrity problem** — the reason the naive answer fails
4. **Feed storage** — what is stored per user, and how much
5. **Pagination** — that does not break as new posts arrive
6. **Deletes and privacy** — after fanout has already happened

## Hints if you are stuck

- Compute the write amplification for a user with 50M followers before committing to a strategy.
- Ask whether the feed must be strictly chronological. It changes the answer.
- Should a user with 200 followers and a user with 50M be handled by the same code path?

## Reference Solution

### The asymmetry

- Posts: 50M/day ≈ **600 QPS**
- Feed reads: 500M × 10 ÷ 86,400 ≈ **58K QPS**, peak ~150K

Reads outnumber writes ~100:1. That argues strongly for doing work at write time so reads are cheap — which is fanout-on-write. But the follower distribution complicates it.

### Fanout on write (push)

When a user posts, insert the post id into every follower's precomputed feed.

- **Read**: one lookup of an already-assembled list. Very fast.
- **Write**: O(followers). For the median user with 200 followers, trivial.

Total fanout writes: 50M posts × 200 median ≈ **10B/day** ≈ 115K writes/sec. Substantial but tractable, and it must be asynchronous — the post API returns as soon as the post is durable, and workers do the fanout.

### Fanout on read (pull)

Build the feed at request time: query the 300 followed accounts for recent posts and merge.

- **Write**: one insert.
- **Read**: 300 queries plus a merge, repeated on every refresh, per user.

At 150K peak QPS this is not viable as the primary path.

### The celebrity problem

Fanout-on-write breaks on the tail of the distribution. An account with 50M followers generates **50M writes for one post**. At even modest posting rates that dwarfs all other traffic, and the last follower receives the post minutes after the first.

Averages hide this completely. The distribution is power-law, and the tail is the design constraint.

### The hybrid

Push for ordinary users, pull for celebrities, merge at read time.

```
post():
  if author.followers < THRESHOLD:        # ~10K–100K
      enqueue fanout to followers' feeds
  else:
      write to author's own timeline only

getFeed(user):
  pushed  = feedStore.range(user, cursor, limit)   # precomputed
  celebs  = user.followedCelebrities                # small list
  pulled  = timelines.recentFor(celebs)             # cached, shared
  return merge(pushed, pulled).sorted().take(limit)
```

The insight that makes this work: a celebrity's recent posts are read by millions of users, so that single query result is **shared and cached with a very high hit rate**. The expensive path is expensive once, not per follower.

The threshold is a tuning parameter. State that it is empirical rather than pretending there is a correct value.

### Feed storage

Store **post ids, not post bodies**. Storing full posts per follower multiplies storage by follower count — the same post duplicated 200 times.

```
feed:{user_id} → [post_id, post_id, ...]   capped at ~800
```

Redis sorted sets work well, scored by timestamp or rank. Cap the list: nobody scrolls past a few hundred items, and unbounded feeds grow without limit. Deep history comes from a slower path.

Hydration: fetch post bodies for the ~20 ids on screen from a post cache. One multi-get, high hit rate since popular posts are shared across many feeds.

Shard the feed store by `user_id` — a feed read is always for exactly one user, so it is single-shard.

### Pagination

Offset pagination breaks visibly: new posts arrive while a user scrolls, shifting everything down, and page 2 repeats items from page 1.

Use a **cursor** — the score or id of the last item seen. Stable under insertion, and it maps directly onto a sorted-set range query.

### Inactive users

Fanning out to accounts dormant for a year wastes writes and storage. Skip fanout for users inactive beyond some window and rebuild their feed on next login. Cuts fanout volume substantially, since dormant accounts are a large fraction of any mature network.

### Deletes and privacy

A deleted post is already sitting in millions of precomputed feeds. Two options:

1. **Filter at read time** — check post existence and visibility during hydration. Simple; the id lingers as a tombstone.
2. **Fan out the delete** — expensive and slow, mirroring the original fanout cost.

Filtering at read time is standard, since hydration already fetches the post and can drop missing or now-private ones. Going from public to private is the same problem with the same answer.

### Ranking

If the feed is ranked rather than chronological, the precomputed list becomes a **candidate set** rather than the final answer. Fetch a few hundred candidates, score them at read time with recency, affinity and engagement signals, then take the top 20. This keeps fanout cheap while allowing personalised ordering.

### Monitoring

Fanout lag (time from post to appearing in feeds), feed read p99, post cache hit rate, fanout queue depth, and the celebrity threshold's effect on both paths.

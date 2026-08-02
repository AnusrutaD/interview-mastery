---
title: Replication and Consistency
pattern: Replication
level: Intermediate
order: 4
minutes: 12
summary: Sync vs async replication, CAP and PACELC, quorums, and what read-your-writes actually requires.
quiz:
  - id: repl-1
    q: A user updates their profile, is redirected, and sees the old value. The write succeeded. What happened?
    options:
      - The write was lost
      - The read hit an async replica that had not yet received the change
      - The cache was not invalidated
      - The transaction was rolled back
    answer: 1
    explain: Classic replication lag. The write went to the primary, the subsequent read was load balanced to a replica still catching up. The standard fix is read-your-writes - route a user's reads to the primary for a short window after they write.
  - id: repl-2
    q: CAP says you choose between consistency and availability. When does that choice actually apply?
    options:
      - Always
      - Only during a network partition
      - Only for NoSQL databases
      - Only when using synchronous replication
    answer: 1
    explain: CAP is a statement about partition behaviour specifically. With a healthy network you can have both. PACELC extends it usefully - Else (no partition), you still trade Latency against Consistency, which is the trade you live with day to day.
  - id: repl-3
    q: With N=3 replicas, W=2 and R=2, what is guaranteed?
    options:
      - Nothing - quorums do not guarantee consistency
      - Reads always see the latest write, because W+R>N forces an overlap
      - Writes never fail
      - Replicas never diverge
    answer: 1
    explain: W + R > N means the write set and read set must share at least one replica, so a read is guaranteed to touch a node holding the newest value. This is the arithmetic behind tunable consistency in Dynamo-style stores.
  - id: repl-4
    q: What is the main cost of synchronous replication?
    options:
      - Replicas can serve stale reads
      - Write latency includes the slowest replica, and a replica failure can block writes
      - It requires more storage
      - It only works within one datacenter
    answer: 1
    explain: Synchronous means acknowledging only after replicas confirm, so every write pays the slowest replica's latency - brutal across regions - and an unreachable replica can stall writes entirely unless you degrade to async.
  - id: repl-5
    q: Which workload genuinely requires strong consistency?
    options:
      - A follower count on a social profile
      - Deducting from an account balance
      - A product recommendation feed
      - A view counter on a video
    answer: 1
    explain: Money must not be double-spent, so balance operations need strong consistency (or careful compensation). Counts and feeds tolerate seconds of staleness, and pretending otherwise costs latency and availability for no user-visible benefit.
---

Replication keeps copies of the same data on multiple machines. It buys three things — surviving node failure, serving reads from more than one place, and putting data near users — and it charges one price: **the copies disagree.**

Everything below is about managing that disagreement.

## Leader–follower

One node accepts writes. Followers replicate from it and serve reads.

The interesting choice is *when* the leader acknowledges a write.

**Asynchronous** — acknowledge immediately, replicate in the background. Fast writes, high availability. Two consequences: reads from followers can be stale (**replication lag**), and a leader that dies before shipping its last writes loses them.

**Synchronous** — acknowledge only after followers confirm. No data loss, no stale reads from confirmed followers. Every write now pays the slowest follower's latency, which is punishing across regions, and an unreachable follower can block writes entirely.

**Semi-synchronous** is the usual compromise: one synchronous follower for durability, the rest async. You survive a leader failure without losing acknowledged writes, and you do not wait for every replica.

## Replication lag is a product problem

Lag is usually milliseconds. Under load it can be seconds, and users notice in specific ways:

**Read-your-writes.** You edit your profile, the page reloads from a lagging replica, and your change is gone. Alarming, and it looks like a bug. Fix by routing a user's reads to the leader for a short window after they write, or by tracking a per-user log position and only using replicas that have caught up.

**Monotonic reads.** Two consecutive reads hit different replicas with different lag, and time appears to run backwards — a comment appears, then vanishes. Fix by pinning a session to one replica.

**Consistent prefix.** Replicas apply writes out of order, so an answer shows up before the question. Mostly a sharded-system problem; ordering guarantees are typically per-partition.

Notice that all three are fixed by *routing*, not by changing the database.

## Multi-leader and leaderless

**Multi-leader** — several nodes accept writes, typically one per region. Local write latency, survives losing a region. The cost is write conflicts: two regions edit the same row simultaneously and someone must decide who wins. Last-write-wins is simple and silently loses data; CRDTs converge correctly but constrain your data model.

**Leaderless (Dynamo-style)** — any replica takes a write, and the client talks to several. Consistency is tuned with quorums.

## Quorums

With `N` replicas, `W` acknowledgements required for a write, and `R` responses required for a read:

> **W + R > N** guarantees the read set and write set overlap on at least one replica, so a read is guaranteed to see the latest write.

- `N=3, W=2, R=2` — the balanced default. Survives one node down for both reads and writes.
- `N=3, W=3, R=1` — fast reads, writes fail if any replica is down.
- `N=3, W=1, R=1` — fastest, no consistency guarantee at all.

Being able to reason about this arithmetic out loud is worth more in an interview than naming a specific database.

## CAP, and the part people skip

During a **network partition**, you must choose:

- **CP** — refuse requests on the minority side rather than serve possibly-stale data.
- **AP** — keep serving everywhere, accept divergence, reconcile later.

The part that gets skipped: **CAP only applies during a partition**, which is rare. **PACELC** completes the picture — *else*, when the network is healthy, you still trade **L**atency against **C**onsistency. That is the trade you actually make every day.

## Choosing, honestly

Strong consistency is not a virtue. It is a cost you pay where correctness demands it.

| Data | Needs |
|---|---|
| Account balance, inventory | Strong — money and stock must not be double-spent |
| Auth and permissions | Strong — stale permissions are a security bug |
| Profile, settings | Read-your-writes for the owner; eventual for everyone else |
| Feeds, counts, recommendations | Eventual — seconds of staleness is invisible |

A strong answer sounds like: *"Balances are strongly consistent. Follower counts are eventual — a few seconds of lag there is invisible to users and lets me serve them from a cache."* That reasoning is what is being assessed, not the technology you name.

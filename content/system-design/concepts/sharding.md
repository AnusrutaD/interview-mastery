---
title: Sharding and Partitioning
pattern: Sharding
level: Intermediate
order: 3
minutes: 12
summary: Choosing a partition key, consistent hashing, and why cross-shard queries hurt.
quiz:
  - id: shard-1
    q: You shard users across 8 nodes with hash(user_id) % 8. You add a ninth node. What happens?
    options:
      - Only 1/9 of keys move
      - Almost every key maps to a different node and must be moved
      - Nothing - existing keys keep their assignment
      - Only keys on the new node are affected
    answer: 1
    explain: Changing the modulus changes the result for nearly every key - roughly 8/9 of all data must move. This is precisely the problem consistent hashing solves, reducing movement to about K/n keys.
  - id: shard-2
    q: A chat app shards messages by message_id. What goes wrong?
    options:
      - Message ids are not unique
      - Loading one conversation requires querying every shard
      - Writes become the bottleneck
      - Messages cannot be ordered
    answer: 1
    explain: The access pattern is "all messages in conversation X", but sharding by message_id scatters a conversation across every shard. Shard by conversation_id so one conversation lives on one node and the common read is a single-shard query.
  - id: shard-3
    q: What is the main advantage of range-based sharding over hash-based?
    options:
      - It never produces hotspots
      - Range queries stay efficient because adjacent keys live together
      - It requires no partition key
      - It scales writes better
    answer: 1
    explain: Range sharding keeps ordering, so "all events between March and April" hits few shards. The cost is hotspots - sharding by timestamp sends all of today's writes to one node.
  - id: shard-4
    q: In consistent hashing, what problem do virtual nodes solve?
    options:
      - They eliminate the need for replication
      - They even out uneven key distribution when there are few physical nodes
      - They make range queries possible
      - They remove the need for a partition key
    answer: 1
    explain: With few physical nodes placed on the ring, some get much larger arcs and therefore more data. Each physical node is instead mapped to many points on the ring, which smooths the distribution and makes rebalancing more even.
  - id: shard-5
    q: When should you shard?
    options:
      - As soon as you have more than one server
      - When a single primary can no longer hold the data or absorb the write throughput
      - Whenever reads are slow
      - Before launch, to avoid migrating later
    answer: 1
    explain: Sharding is the most expensive step in the scaling ladder - it costs cross-shard queries, distributed transactions and rebalancing. Read pressure is answered by caching and replicas. Shard only when size or write volume genuinely exceeds one node.
---

Sharding splits one logical dataset across multiple machines so that no single node has to hold all the data or absorb all the writes.

It is the last step on the scaling ladder for a reason: it is the one that changes how you write queries. Caching and replicas are largely transparent to application code. Sharding is not.

## The partition key decides everything

Pick the key from your **dominant access pattern**, not from what feels natural in the schema.

Get it right and the common query touches one shard. Get it wrong and every query fans out to all of them, which is slower than the unsharded system you started with — you now pay network round trips *and* wait for the slowest node.

| System | Dominant read | Shard on |
|---|---|---|
| Chat | "messages in this conversation" | `conversation_id` |
| E-commerce | "this user's orders" | `user_id` |
| Metrics | "this service, this hour" | `(service_id, hour)` |
| Multi-tenant SaaS | "everything for this tenant" | `tenant_id` |

The failure is easy to spot once you name it: sharding chat messages by `message_id` distributes writes beautifully and makes the only query anyone runs — *load this conversation* — hit every node.

## Hash-based sharding

`shard = hash(key) % N`

Even distribution, no hotspots, trivially simple. Two costs: range queries are impossible (adjacent keys are deliberately scattered), and **resharding is brutal**.

Going from 8 nodes to 9 changes the modulus, so roughly 8/9 of all keys map somewhere new. That is a full data migration to add one machine.

## Consistent hashing

Consistent hashing fixes exactly that.

Picture a ring of hash values, `0` to `2³²−1`. Each node is placed at a point on the ring. A key hashes to a point, then walks clockwise to the first node it meets.

Add a node and it lands between two existing nodes, taking over only the arc behind it. Roughly **K/n keys move** instead of nearly all of them.

**Virtual nodes** are the necessary refinement. With eight physical nodes placed once each, arcs are uneven — some nodes get much more data by chance. Map each physical node to ~150 points on the ring instead, and the distribution smooths out. Rebalancing also spreads across all remaining nodes rather than dumping onto one neighbour.

## Range-based sharding

Assign contiguous key ranges: `A–F → shard 1`, `G–M → shard 2`.

Ordering survives, so range scans stay efficient. The cost is hotspots — sharding by timestamp means every write today lands on one node while the rest sit idle. Sharding by name means `S` gets far more than `Q`.

A common compromise is a **composite key**: `(tenant_id, timestamp)`. Hash on tenant for distribution, range within it for time queries.

## What sharding costs

**Cross-shard queries.** Anything not filtered by the partition key fans out. `SELECT ... ORDER BY created_at LIMIT 10` across 16 shards means querying all 16, each returning 10, then merging 160 rows to find the real top 10.

**No cross-shard transactions.** Databases give you ACID within a node. Across nodes you are choosing between two-phase commit (slow, and blocks on coordinator failure) and sagas with compensating actions (fast, eventually consistent, more application code). Most systems pick sagas and design so that operations needing atomicity share a shard.

**Broken joins and uniqueness.** A `UNIQUE` constraint on email is enforced per node. Global uniqueness needs a separate lookup table or a service that owns it.

**Rebalancing.** Adding capacity means moving live data without downtime — usually dual-write, backfill, verify, cut over. Rehearse it before you need it.

## Do not shard early

Ask in order:

1. Can a cache absorb the reads? → cache
2. Can read replicas absorb them? → replicas
3. Is the *data* too large for one node, or are *writes* saturating the primary? → now shard

Reaching for sharding to fix slow reads is the classic tell that someone is reciting an architecture rather than diagnosing a bottleneck.

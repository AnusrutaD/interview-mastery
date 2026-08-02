---
title: Scaling Fundamentals
pattern: Fundamentals
level: Fundamental
order: 1
minutes: 9
summary: Vertical vs horizontal scaling, statelessness, and why load estimation comes first.
quiz:
  - id: scaling-1
    q: Your API server keeps user sessions in a local HashMap. What breaks first when you add a second server behind a round-robin load balancer?
    options:
      - Database connections are exhausted
      - Users are randomly logged out as requests hit the server without their session
      - CPU usage doubles
      - TLS handshakes fail
    answer: 1
    explain: Local in-memory state makes a server non-interchangeable. Round-robin sends a user's next request to the other machine, which has never seen that session. This is why "make it stateless" precedes "add more boxes" — move sessions to Redis or use signed tokens.
  - id: scaling-2
    q: A service handles 100M requests/day with a fairly even distribution. Roughly what average QPS should you design for?
    options:
      - ~120 QPS
      - ~1,200 QPS
      - ~12,000 QPS
      - ~120,000 QPS
    answer: 1
    explain: 100M / 86,400s ≈ 1,157, so ~1.2K QPS average. Interviewers care that you can do this quickly and then apply a peak multiplier — typically 2-3x average, so plan for ~3K QPS.
  - id: scaling-3
    q: When is vertical scaling the *better* engineering decision?
    options:
      - Never — horizontal scaling is always correct
      - When you need more capacity soon and the added complexity of distribution is not yet justified
      - Only for stateless services
      - When you need to survive a datacenter outage
    answer: 1
    explain: Vertical scaling is often the right first move. It costs no architectural complexity, and modern single machines are enormous. The real arguments for horizontal are the ceiling on machine size and fault tolerance — one big box is one failure away from full downtime.
  - id: scaling-4
    q: What does it mean that a system is "read-heavy at a 100:1 ratio"?
    options:
      - Reads are 100x slower than writes
      - There are roughly 100 read requests for every write request
      - The read replica lags 100ms behind
      - 100% of reads are cached
    answer: 1
    explain: It describes traffic mix, and it is the single most useful number to establish early. A 100:1 ratio immediately justifies caching and read replicas, and tells you write throughput is unlikely to be the bottleneck.
---

Almost every system design conversation opens the same way: *"how would you scale this?"* The answer is never a technology. It is a sequence of decisions, and the order matters more than the specific choices.

## Estimate before you architect

Before naming a single component, get to a number. Interviewers are watching whether you design for the load that exists rather than the load you imagine.

Three quantities carry most of the weight:

- **QPS** — requests per second. Divide daily requests by 86,400. Then multiply by 2–3x for peak; traffic is never flat.
- **Read/write ratio** — a 100:1 read-heavy system and a write-heavy ingestion pipeline are different systems even if they store the same data.
- **Data volume and growth** — bytes per record × records per day × retention. This decides whether one Postgres instance is fine for three years or you need partitioning on day one.

> A useful shortcut: 1 million requests/day ≈ 12 QPS. Keep that anchor and you can do most estimates in your head.

If your storage estimate lands at 50 GB, stop. Buy a bigger machine. The interesting problems start when the numbers say a single node cannot hold the data or serve the traffic.

## Vertical scaling

Vertical scaling means a bigger machine — more cores, more RAM, faster disks.

It is genuinely underrated. It requires no code changes, introduces no distributed-systems failure modes, and a modern server can hold terabytes of RAM. Plenty of companies serve real traffic from a single well-provisioned database.

It fails for two reasons, and only two:

1. **There is a ceiling.** Eventually no machine is big enough.
2. **One machine is one failure.** No amount of RAM survives a power supply dying.

That second reason is usually what actually forces the change. Availability, not throughput, is the honest driver behind most horizontal architectures.

## Horizontal scaling

Horizontal scaling means more machines. It removes the ceiling and lets you survive individual failures — and it introduces every hard problem in this course: consistency, partitioning, coordination, partial failure.

The prerequisite is **statelessness**.

A stateless server keeps no request-specific data locally. Any instance can serve any request, so the load balancer is free to route however it likes and a dying node takes nothing with it.

The classic violation is storing sessions in process memory:

```
User logs in    → Server A stores session in local map
Next request    → Load balancer routes to Server B
Server B        → "Who are you?" → user is logged out
```

Fixes, in rough order of preference:

- **Externalise the state** — sessions in Redis. Servers stay interchangeable.
- **Put state in the token** — a signed JWT carries the identity; no server-side lookup at all.
- **Sticky sessions** — pin a user to one server. This works, and it is a trap: you have made your servers non-interchangeable again, so deploys and failures now log people out.

## What actually stays stateful

Application servers are the easy part. The genuinely hard state is the database, and that is where the rest of this course lives — caching to absorb reads, replication for availability, sharding to break the size ceiling.

The progression is almost always the same:

1. One server, one database
2. Split app and database onto separate machines
3. Add a cache (most systems are read-heavy)
4. Add read replicas
5. Shard when one primary can no longer take the writes

Each step buys an order of magnitude and costs complexity. **Do not skip ahead.** Proposing sharding for a system doing 50 QPS signals that you are pattern-matching rather than reasoning.

---
title: Load Balancing
pattern: High Read Traffic
level: Fundamental
order: 5
minutes: 9
summary: L4 vs L7, algorithms, health checks, and why the balancer must not become the outage.
quiz:
  - id: lb-1
    q: What can an L7 load balancer do that an L4 cannot?
    options:
      - Distribute traffic across servers
      - Route on URL path or header, terminate TLS, and cache responses
      - Perform health checks
      - Handle more connections per second
    answer: 1
    explain: L4 balances on IP and port without inspecting payload, so it is fast but blind. L7 parses the request, enabling path-based routing (/api to one pool, /static to another), TLS termination, header rewriting and response caching - at higher CPU cost per request.
  - id: lb-2
    q: Your backends have very different request durations - some 5ms, some 2s. Which algorithm handles this best?
    options:
      - Round robin
      - Least connections
      - IP hash
      - Random
    answer: 1
    explain: Round robin assumes uniform cost, so a server stuck on slow requests keeps receiving new ones. Least connections routes to whoever is least busy right now, which naturally adapts to variable request cost.
  - id: lb-3
    q: A health check pings /health, which returns 200 whenever the process is up. The database is down so every real request fails. What is wrong?
    options:
      - The check interval is too long
      - The check is shallow - it proves the process is alive, not that it can serve traffic
      - Health checks should use TCP, not HTTP
      - Nothing - the server is genuinely healthy
    answer: 1
    explain: A shallow check keeps a useless instance in rotation. A deep check verifies critical dependencies. The tension is that a deep check tied to a shared database can mark every instance unhealthy at once and take down the whole pool - so keep it dependency-aware but tolerant.
  - id: lb-4
    q: Why is a single load balancer a problem?
    options:
      - It cannot handle enough throughput
      - It is a single point of failure - the thing meant to provide availability becomes the outage
      - It cannot perform TLS termination
      - It requires sticky sessions
    answer: 1
    explain: Availability infrastructure that is itself a SPOF defeats the purpose. Standard fix is an active-passive pair sharing a floating IP, or several balancers behind DNS round robin, often with anycast at the edge.
---

A load balancer sits in front of a pool of servers and decides who handles each request. It is what makes horizontal scaling usable, and it is also a component people under-specify in interviews.

## Layer 4 vs Layer 7

**L4 (transport)** balances on IP and port. It forwards packets without looking inside, which makes it very fast and protocol-agnostic — and completely blind to what the request is.

**L7 (application)** parses the HTTP request. That unlocks:

- Path routing — `/api/*` to one pool, `/static/*` to another
- TLS termination, so backends speak plain HTTP internally
- Header-based routing, which is how canary and A/B deploys work
- Response caching and compression

The cost is CPU per request. In practice large systems use both: L4 at the edge for raw throughput, L7 behind it for routing.

## Algorithms

| Algorithm | Behaviour | Use when |
|---|---|---|
| **Round robin** | Each server in turn | Requests cost roughly the same |
| **Weighted round robin** | Proportional to capacity | Heterogeneous hardware |
| **Least connections** | Fewest in-flight requests | Request durations vary widely |
| **Least response time** | Fastest recent responses | Latency matters most |
| **IP / consistent hash** | Same client → same server | You need session affinity or cache locality |

Round robin is the default and is fine until request cost varies. Once some requests take 5ms and others 2 seconds, round robin keeps feeding new work to a server already stuck — **least connections** is the correct answer there.

Hash-based routing is worth understanding for a second reason: it gives **cache locality**. Sending the same key to the same backend means that backend's local cache actually gets hits.

## Health checks

A balancer must stop sending traffic to instances that cannot serve it. How it decides matters more than it looks.

**Shallow check** — `/health` returns 200 if the process is running. Cheap, and it will happily keep a completely broken instance in rotation when its database connection is dead.

**Deep check** — verifies critical dependencies before reporting healthy. Honest, with a real hazard: if every instance checks the same database and that database blips, **every instance is marked unhealthy simultaneously** and the entire pool leaves rotation. You have converted a degradation into an outage.

The usual compromise: check dependencies, but treat "dependency slow" differently from "dependency gone", and never let more than a fraction of the pool drop out at once.

Key parameters to state explicitly:

- **Interval** — how often (typically 5–30s)
- **Timeout** — how long before the check counts as failed
- **Unhealthy threshold** — consecutive failures before removal (>1, so one blip does not eject a good server)
- **Healthy threshold** — consecutive successes before returning

## The balancer must not be the outage

A single load balancer is a single point of failure — and it is specifically the component you added to *improve* availability. Standard answers:

- **Active–passive pair** sharing a floating IP; the standby takes over on failure
- **Multiple balancers behind DNS round robin** — cheap, but DNS caching makes failover slow
- **Anycast** — the same IP announced from many locations; the network routes to the nearest healthy one

Mentioning this unprompted is a strong signal. Plenty of candidates draw one box labelled "LB" and never ask what happens when it dies.

## Related patterns worth naming

**Connection draining.** On deploy, stop sending *new* requests to an instance but let in-flight ones finish. Without it, every deploy drops requests.

**Circuit breaking.** If a backend is failing, stop sending it traffic for a cooldown rather than timing out on every request. Prevents one sick service from consuming all the caller's threads.

**Rate limiting at the edge.** Cheaper to reject abuse at the balancer than to let it reach application servers.

---
title: Message Queues and Async Processing
pattern: High Write Traffic
level: Intermediate
order: 6
minutes: 11
summary: Decoupling with queues and logs, delivery guarantees, idempotency, and backpressure.
quiz:
  - id: mq-1
    q: What is the practical difference between a queue (SQS) and a log (Kafka)?
    options:
      - Logs are faster
      - A queue deletes a message once consumed; a log retains it so multiple independent consumers can read at their own offsets
      - Queues cannot guarantee ordering
      - Logs do not support multiple producers
    answer: 1
    explain: A queue distributes work - one consumer gets each message and it is then gone. A log is a durable ordered record that many consumer groups read independently, each tracking its own offset, and can replay from the beginning.
  - id: mq-2
    q: Most brokers offer at-least-once delivery. What must consumers therefore be?
    options:
      - Single-threaded
      - Idempotent - processing the same message twice must have the same effect as once
      - Stateless
      - Ordered
    answer: 1
    explain: At-least-once means duplicates will happen - an ack can be lost after the work is done, so the broker redelivers. Consumers must dedupe on a message id or make the operation naturally idempotent, such as an upsert rather than an increment.
  - id: mq-3
    q: True exactly-once delivery across a network is impossible. What do systems do instead?
    options:
      - Accept message loss
      - At-least-once delivery plus idempotent processing, giving exactly-once *effects*
      - Use synchronous calls
      - Retry until the broker confirms
    answer: 1
    explain: The Two Generals problem rules out exactly-once delivery. The practical answer is at-least-once delivery combined with deduplication or idempotent operations, which produces exactly-once semantics from the application's point of view.
  - id: mq-4
    q: Producers are outpacing consumers and the queue is growing without bound. What is the right response?
    options:
      - Increase the queue's retention period
      - Apply backpressure or shed load, and alert on queue depth
      - Add more producers
      - Switch to synchronous processing
    answer: 1
    explain: An unbounded queue converts a throughput problem into a latency problem and eventually into an outage. Scale consumers, apply backpressure to producers, or shed low-priority work - and monitor queue depth and consumer lag as primary signals.
  - id: mq-5
    q: What is a dead letter queue for?
    options:
      - Messages that have not been consumed yet
      - Messages that repeatedly fail processing, moved aside so they stop blocking the queue
      - Low-priority messages
      - Messages that exceeded the size limit
    answer: 1
    explain: A poison message that always fails would otherwise be retried forever, blocking progress. After N attempts it is moved to a DLQ for inspection, keeping the main queue flowing while preserving the failure for debugging.
---

A queue between two services turns a synchronous call into an asynchronous one. That single change buys a lot.

**Decoupling.** The producer does not need the consumer to be up. Deploy or restart the consumer and messages simply wait.

**Load smoothing.** A traffic spike fills the queue instead of overwhelming the database. Consumers drain at whatever rate they can sustain — the queue absorbs the burst.

**Responsiveness.** Return to the user as soon as the work is *accepted*, not when it is *finished*. Uploading a video should not block on transcoding it.

**Retries in one place.** Transient failures are handled by the broker's redelivery rather than bespoke retry code in every caller.

## Queues vs logs

These are different tools and the distinction matters.

**Queue** (SQS, RabbitMQ) — a message is delivered to one consumer and then deleted. This is *work distribution*: add consumers to process faster. Once consumed, the message is gone.

**Log** (Kafka, Kinesis) — an append-only ordered record. Messages are retained for a configured window and multiple independent consumer groups each read at their own offset. This is *event distribution*: the same event can drive search indexing, analytics and notifications simultaneously, and a new consumer can replay history from the beginning.

Rough guide: use a **queue** for "do this task", a **log** for "this happened".

## Delivery guarantees

**At-most-once** — fire and forget. Fast, and messages can be lost. Fine for metrics.

**At-least-once** — retry until acknowledged. Nothing is lost, and duplicates *will* occur: if the consumer finishes the work but its ack is lost, the broker redelivers. This is the default nearly everywhere.

**Exactly-once** — impossible as a *delivery* guarantee across a network (this is the Two Generals problem). What systems actually provide is at-least-once delivery plus idempotent processing, which yields exactly-once **effects**.

## Idempotency

Since duplicates are guaranteed, consumers must tolerate them.

```
❌ balance = balance + 100        # runs twice → wrong balance
✅ INSERT ... ON CONFLICT DO NOTHING  using message_id as the key
```

Two standard approaches:

1. **Deduplicate on a message id** — record processed ids and skip repeats. Needs a store with a TTL.
2. **Make the operation naturally idempotent** — upserts and absolute assignments (`set status = 'paid'`) are safe to repeat; increments are not.

Idempotency keys are worth naming explicitly in an interview. A payments answer that does not mention them is incomplete.

## Ordering

Most brokers guarantee ordering only within a **partition**, not globally — because global ordering would mean a single consumer and no parallelism.

The pattern: partition by the entity whose ordering matters. Keying by `user_id` guarantees one user's events are processed in order while different users proceed in parallel. If ordering genuinely does not matter, say so and take the throughput.

## Backpressure

When producers outpace consumers, the queue grows. An unbounded queue turns a throughput problem into a latency problem, and eventually into an outage — messages arrive hours late, and memory or disk fills.

Options:

- **Scale consumers** — the obvious one, if the downstream dependency can take it
- **Backpressure** — slow producers down, rejecting or throttling at the edge
- **Load shedding** — drop low-priority work to protect the critical path

**Queue depth and consumer lag are primary alerting signals.** Rising lag is the earliest warning that something downstream is unhealthy, usually well before error rates move.

## Dead letter queues

A message that always fails — malformed payload, referenced row deleted — would be retried forever, blocking everything behind it. After N attempts, move it to a **dead letter queue**.

The main queue keeps flowing, and the failure is preserved for inspection rather than silently dropped. A DLQ that nobody monitors is just a slower way to lose data, so alert on its depth.

## When not to use a queue

Async is not free. It costs a component to operate, eventual consistency in the user's view of the world, and much harder debugging — a request now spans several services with no single stack trace.

If the caller needs the result immediately and the work is fast, call the service directly.

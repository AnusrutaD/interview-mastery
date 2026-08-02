---
title: Design a Chat System
pattern: Realtime Updates
level: Advanced
order: 23
minutes: 45
summary: WebSockets vs polling, message ordering and delivery, presence, and offline delivery.
rubric:
  - title: Requirements
    criteria:
      - id: chat-req-1
        label: Separated 1:1 from group chat and stated group size limits
        hint: A 10-person group and a 100,000-person channel are different systems.
      - id: chat-req-2
        label: Specified delivery guarantees and receipts
        weight: 2
        hint: Sent, delivered, read. Each is a distinct state requiring its own acknowledgement.
      - id: chat-req-3
        label: Stated latency target and expected concurrency
        hint: Sub-second delivery, and how many simultaneous connections the fleet must hold.
      - id: chat-req-4
        label: Decided whether history is permanent
        hint: Retention drives storage volume and whether messages are archived to cold storage.
  - title: Connection layer
    criteria:
      - id: chat-conn-1
        label: Chose a transport and justified it against alternatives
        weight: 2
        hint: WebSocket vs long polling vs SSE. Chat is bidirectional, which points one way.
      - id: chat-conn-2
        label: Explained how to route a message to the server holding the recipient's connection
        weight: 2
        hint: Connections are stateful and pinned to one gateway. You need a registry mapping user to server.
      - id: chat-conn-3
        label: Handled connection loss and reconnection
        hint: Mobile networks drop constantly. Resume from the last received message id, not from scratch.
      - id: chat-conn-4
        label: Addressed scaling the connection fleet
        hint: Connections are memory-bound, not CPU-bound. Capacity is measured in sockets per node.
  - title: Storage and ordering
    criteria:
      - id: chat-store-1
        label: Chose a partition key for messages
        weight: 2
        hint: Shard by conversation_id - the dominant read is "messages in this conversation".
      - id: chat-store-2
        label: Designed message ids that sort correctly
        weight: 2
        hint: Client timestamps cannot be trusted and clocks skew. A per-conversation sequence or Snowflake id gives stable ordering.
      - id: chat-store-3
        label: Handled ordering when messages arrive out of order
        hint: Order within a conversation is what users perceive; global ordering is unnecessary.
      - id: chat-store-4
        label: Designed history pagination
        hint: Cursor-based, walking backwards from the newest message.
  - title: Delivery and offline
    criteria:
      - id: chat-del-1
        label: Handled delivery to offline recipients
        weight: 2
        hint: Persist first, then attempt delivery. An offline user syncs on reconnect and gets a push notification.
      - id: chat-del-2
        label: Made delivery idempotent
        hint: Retries and reconnects cause duplicates. A client-generated message id lets both sides dedupe.
      - id: chat-del-3
        label: Addressed multi-device sync
        hint: One user, several devices, all needing the same messages and read state.
      - id: chat-del-4
        label: Designed presence and acknowledged its cost
        hint: Presence is high-churn, low-value data. Heartbeats with TTL, and do not broadcast to everyone.
---

Design a real-time chat system supporting one-to-one and group conversations.

**Write your design in the notes below before scoring yourself.**

## The prompt

Users exchange messages in real time. Messages must arrive quickly, survive the recipient being offline, and appear in a consistent order on every device.

## Scope

**In scope**

- 1:1 and group messaging (up to ~500 members)
- Real-time delivery to online users
- Offline delivery and history sync
- Sent / delivered / read receipts
- Online presence

**Out of scope**

- Voice and video calls
- End-to-end encryption
- File transfer beyond a stored URL

## Numbers to design against

- **50M** daily active users
- **10M** concurrent connections at peak
- **40** messages per user per day → ~**23K** messages/sec average
- Delivery latency: **p99 under 500ms** for online recipients
- History retained **indefinitely**

## What to cover

1. **Transport** — how the server pushes to a client
2. **Connection routing** — finding the server holding a given user's socket
3. **Message model** — ids, ordering, partitioning
4. **Offline delivery** — the case that actually defines the design
5. **Receipts and multi-device sync**
6. **Presence** — and why it is more expensive than it looks

## Hints if you are stuck

- Connections are stateful. What does that imply when 10M of them are spread over thousands of servers?
- Do not trust client clocks for ordering.
- Design the offline path first — the online path is the easy case.

## Reference Solution

### Transport

| Option | Fit |
|---|---|
| **Short polling** | Wasteful; latency bounded by the interval |
| **Long polling** | Workable fallback, one request per message |
| **SSE** | Server→client only; chat needs both directions |
| **WebSocket** | Full duplex, one persistent connection — the right answer |

WebSocket, with long polling as a fallback for restrictive networks. Assume the fallback rather than promising it works everywhere.

### Connection routing

This is the structural problem. A WebSocket is **pinned to one gateway server**. When A sends to B, A's gateway must find B's.

```
Connection registry (Redis):  user_id → {gateway_id, connection_id, connected_at}
```

Flow:

1. A's gateway receives the message and persists it
2. Looks up B in the registry
3. B online → forward to B's gateway over an internal channel (pub/sub or direct RPC)
4. B offline → skip delivery; B will sync on reconnect

The registry is hot and small. Redis fits, with TTL-backed entries refreshed by heartbeat so crashed gateways do not leave stale routes.

**Gateways are memory-bound, not CPU-bound.** Capacity is sockets per node — roughly 100K per well-tuned server, so 10M concurrent needs ~100+ gateways plus headroom. Say this explicitly; it is the sizing insight for the connection tier.

### Message identity and ordering

**Never trust client timestamps.** Clocks skew, and clients lie.

Options:

- **Per-conversation sequence number** — a monotonic counter per conversation. Perfect ordering where it matters, requires a counter per conversation.
- **Snowflake id** — timestamp + node + sequence. Roughly time-sortable, no coordination, ids sortable globally.

Either works. The key realisation: **ordering only needs to be consistent within a conversation.** Global ordering across all conversations is something no user can observe, and demanding it would be enormously expensive.

Separately, the client generates a **client message id** (UUID) on send. This is what makes delivery idempotent — retries carry the same id, so the server and other clients can dedupe.

### Storage

Shard by `conversation_id`. The dominant read is "recent messages in this conversation", so this makes it single-shard.

```
PK: conversation_id
SK: message_id (sortable)
    sender_id, content, created_at, attachments
```

A wide-column store (Cassandra, DynamoDB) fits: high write throughput, ordered range scans within a partition, no joins needed.

At 23K msg/sec and ~500 bytes each that is roughly **1 TB/day**. Indefinite retention means tiering — recent messages hot, older archived to object storage.

History pagination is cursor-based, walking backwards from the newest `message_id`.

### The offline path

**Persist before delivering.** The message is durable the moment it is acknowledged to the sender; delivery is a separate concern.

For an offline recipient:

1. Message is stored in the conversation
2. Recipient's "last synced message id" stays where it was
3. Push notification via APNs/FCM
4. On reconnect, client sends its last known id per conversation and receives everything after it

This same mechanism handles flaky mobile networks — a reconnect is just a very short offline period. Building it this way means there is no separate code path for "dropped connection", which is the common case rather than the exception.

### Receipts

Three distinct states, each its own acknowledgement:

- **Sent** — server has persisted it
- **Delivered** — recipient's device has received it
- **Read** — recipient has viewed it

Receipts are themselves messages and multiply traffic. Batch them: one "read up to message X" per conversation rather than one per message, which collapses a burst of reads into a single update.

### Multi-device

One user, several devices. Model the recipient as a **set of connections**, not one. The registry maps `user_id → [connections]`, and delivery fans out to all of them.

Read state lives per user, not per device: reading on a phone must clear the badge on a laptop. That means read receipts sync back to the user's other devices too.

### Presence

Presence looks trivial and is the most expensive feature here.

- Client heartbeats every ~30s; Redis key with a ~60s TTL
- Absence of the key means offline

The cost is fanout: broadcasting every status change to every contact is O(contacts) per change, with very high churn as mobile users constantly connect and disconnect.

Mitigations: only track presence for conversations currently open on screen, debounce transitions (do not report offline until the TTL genuinely lapses), and consider showing "last seen" rather than live status — far cheaper and nearly as useful.

Being willing to push back on presence as a requirement is a good signal. It is frequently more expensive than the messaging itself.

### Monitoring

Delivery p99, connections per gateway, registry lookup latency, undelivered message backlog, reconnect rate, and push notification failure rate.

# Redis Key Design — Smart Music Streaming Platform

> **Last updated:** 2026-05-01
> **Maintainer:** hoanhnghiep2704@gmail.com

---

## Table of Contents

1. [Overview](#overview)
2. [Naming Convention](#naming-convention)
3. [Keys by Service](#keys-by-service)
   - [Auth Service](#auth-service)
   - [API Gateway](#api-gateway)
   - [User Service](#user-service)
   - [Recommendation Service](#recommendation-service)
   - [Analytics Service](#analytics-service)
   - [Listening Party Service](#listening-party-service)
   - [Search Service](#search-service)
   - [Streaming Service](#streaming-service)
4. [Shared / Cross-Service Keys](#shared--cross-service-keys)
5. [TTL Design Summary](#ttl-design-summary)
6. [Key Collision Prevention](#key-collision-prevention)
7. [Operational Guidelines](#operational-guidelines)
8. [Anti-patterns to Avoid](#anti-patterns-to-avoid)

---

## Overview

Redis is used as a **shared, ephemeral data layer** across multiple microservices in the Smart Music Streaming Platform. Each service has its own logical namespace enforced by a mandatory service prefix. Redis is **not** the system of record for any entity — it is always a cache, a rate-limit counter, a deduplication token, or a short-lived session store. The authoritative source of truth lives in each service's primary database (PostgreSQL or MongoDB).

### Design philosophy

- **Prefix-first**: Every key starts with the owning service's short name. This makes it trivially easy to identify ownership and to flush a single service's data without touching others.
- **TTL mandatory**: Every key must carry an explicit TTL. Keys without a TTL are a memory leak waiting to happen. The only exception is a Sorted Set whose membership is managed by explicit application logic (e.g., `rec:trending:global`), and even then a TTL is strongly encouraged.
- **No PII in key names**: User-identifiable information (email, username, phone) must never appear in a key name. Use UUIDs or opaque identifiers only.
- **Fail-open on cache miss**: Every consumer must handle a Redis miss gracefully by falling back to the primary database or recomputing the value.
- **Single writer per key**: Each key has exactly one service that writes (and owns) it. Other services may read it, but they must not write it. Cross-service write access must be documented explicitly.

---

## Naming Convention

### Pattern

```
{service}:{entity}:{identifier}[:{sub-key}]
```

| Segment | Description | Example |
|---|---|---|
| `{service}` | Short, lowercase service name | `auth`, `gateway`, `user`, `rec`, `analytics`, `party`, `search`, `stream` |
| `{entity}` | The logical object or concern | `refresh`, `blacklist`, `profile`, `weights`, `cache`, `ratelimit` |
| `{identifier}` | Opaque unique ID (UUID, hash, IP) — never PII | `a3f9...`, `192.168.1.1`, `sha256(query)` |
| `{sub-key}` | Optional additional discriminator | `morning`, `evening`, `global` |

### Rationale

- **Collision avoidance**: Two services can both have a "cache" entity (`user:cache:…` vs `rec:cache:…`) without any risk of collision.
- **Operational clarity**: `SCAN 0 MATCH auth:* COUNT 1000` instantly scopes all Auth Service keys for inspection or bulk deletion.
- **Monitoring**: Prefix-based dashboards in Redis Insight / Datadog are trivial to configure.
- **Pattern flushing**: To evict all recommendation caches: `SCAN 0 MATCH rec:cache:* COUNT 100` + `DEL`. No need to know individual key names.

### Short service name registry

| Service | Prefix |
|---|---|
| API Gateway | `gateway` |
| Auth Service | `auth` |
| User Service | `user` |
| Recommendation Service | `rec` |
| Analytics Service | `analytics` |
| Listening Party Service | `party` |
| Search Service | `search` |
| Streaming Service | `stream` |

---

## Keys by Service

### Auth Service

The Auth Service owns all authentication-related ephemeral state: token lifecycle management, brute-force protection, and the JWT public key cache used by the Gateway for offline signature verification.

| Key Pattern | Redis Type | TTL | TTL Rationale | Example Key | Example Value | Owner Service | Shared With |
|---|---|---|---|---|---|---|---|
| `auth:refresh:{userId}` | String | 30 days | Matches the refresh token expiry configured in Auth Service. On re-issue the key is overwritten; on logout it is deleted. | `auth:refresh:550e8400-e29b-41d4-a716-446655440000` | `$argon2id$v=19$...` (hashed token) | Auth Service | — |
| `auth:blacklist:{jti}` | String | Remaining token lifetime | The key must expire at the same moment the JWT itself would have expired, so a blacklisted-but-expired token is not stored forever. TTL is set to `(token_exp - now)` seconds at write time. | `auth:blacklist:7a3f9c1d-0012-4b2a-bb31-8f1234567890` | `1` | Auth Service | API Gateway (reads to reject requests) |
| `auth:failcount:{email_hash}` | String | 15 minutes | Rolling 15-minute window. Counter is incremented with `INCR`; TTL is reset on each increment (`EXPIRE`). After the window closes the counter disappears and the user gets a fresh attempt budget. | `auth:failcount:a665a459...` (SHA-256 of email) | `4` | Auth Service | — |
| `auth:lockout:{email_hash}` | String | 15 minutes (configurable) | Key presence = account locked. TTL controls lockout duration. When TTL expires the account is automatically unlocked without any cleanup job. | `auth:lockout:a665a459...` | `locked` | Auth Service | — |
| `auth:pubkey:cache` | String | 1 hour | The JWT public key rarely changes. Caching it for 1 hour lets the API Gateway verify tokens without calling Auth Service on every request. Short enough to pick up a key rotation within an hour. | `auth:pubkey:cache` | `-----BEGIN PUBLIC KEY-----\nMIIBIjAN...` (PEM) | Auth Service | API Gateway (reads for offline JWT verification) |

**Notes:**
- `auth:failcount` and `auth:lockout` use a SHA-256 hash of the email address as the identifier, not the raw email, to avoid storing PII in key names.
- On successful login, the Auth Service must delete `auth:failcount:{email_hash}` and `auth:lockout:{email_hash}`.
- `auth:refresh:{userId}` stores a **hash** of the token (Argon2id or SHA-256), never the raw token value. The raw token is returned to the client only and is never persisted in Redis.

---

### API Gateway

The Gateway owns rate limiting. It uses simple atomic counters (`INCR` + `EXPIRE`) in a fixed-window pattern. Two separate keys allow different limits for anonymous (IP-based) and authenticated (token-based) requests.

| Key Pattern | Redis Type | TTL | TTL Rationale | Example Key | Example Value | Owner Service | Shared With |
|---|---|---|---|---|---|---|---|
| `gateway:ratelimit:ip:{ip}` | String (counter) | 60 seconds | 60-second fixed window. The key is created with `SET … EX 60` on first request in a window, then incremented with `INCR`. When TTL expires the window resets automatically. | `gateway:ratelimit:ip:203.0.113.42` | `47` | API Gateway | — |
| `gateway:ratelimit:token:{userId}` | String (counter) | 60 seconds | Same fixed-window strategy as IP-based, but scoped per authenticated user. Allows a higher threshold than the IP limit and ties throttling to the user identity. | `gateway:ratelimit:token:550e8400-e29b-41d4-a716-446655440000` | `12` | API Gateway | — |

**Notes:**
- Both keys use the pattern: `SET key 1 EX 60 NX` on the first request, then `INCR key` on subsequent requests within the window. Do not use `INCR` alone — the `NX` guard ensures the TTL is set exactly once per window.
- Thresholds (e.g., 100 req/min for IP, 300 req/min for token) are configuration values, not embedded in keys.
- For burst protection, consider augmenting with a Token Bucket or Sliding Window algorithm backed by a Lua script, which would reuse the same key pattern with a Hash type instead.

---

### User Service

The User Service caches profile data to avoid repeated reads from PostgreSQL on every request. The cache is write-through invalidated: whenever a profile is updated, the corresponding Redis key is deleted immediately.

| Key Pattern | Redis Type | TTL | TTL Rationale | Example Key | Example Value | Owner Service | Shared With |
|---|---|---|---|---|---|---|---|
| `user:profile:{userId}` | String (JSON) | 15 minutes | Short TTL balances read performance against staleness risk. Profile data (display name, avatar URL, preferences) changes infrequently but must not be stale for long. The service also deletes this key synchronously on any write operation. | `user:profile:550e8400-e29b-41d4-a716-446655440000` | `{"userId":"550e8400…","displayName":"Nghiep","avatarUrl":"https://cdn…","createdAt":"2025-01-15T10:00:00Z"}` | User Service | Recommendation Service (reads displayName for party UI), Listening Party Service (reads displayName for member list) |

**Notes:**
- The value is a serialized JSON blob, not a Redis Hash. This simplifies atomic reads and avoids partial-update race conditions.
- The User Service is the **sole writer**. Other services that read this key must never write to it.
- If the Recommendation or Listening Party service cannot find the key, they must call the User Service REST API, not read PostgreSQL directly.

---

### Recommendation Service

The Recommendation Service is the heaviest Redis consumer. It stores user-specific preference weights, time-of-day recommendation caches, a global trending sorted set, onboarding fallback data, and idempotency tokens for feedback events.

| Key Pattern | Redis Type | TTL | TTL Rationale | Example Key | Example Value | Owner Service | Shared With |
|---|---|---|---|---|---|---|---|
| `rec:weights:{userId}` | Hash | 7 days | Genre preference weights are derived from listening history. They change gradually. A 7-day TTL is long enough that the weights survive a user's weekly listening session, but short enough that stale weights eventually expire if a user becomes inactive. Refreshed on every feedback event. | `rec:weights:550e8400-e29b-41d4-a716-446655440000` | `{"pop":"0.72","jazz":"0.45","electronic":"0.31","rock":"0.18"}` (Hash fields) | Recommendation Service | — |
| `rec:cache:{userId}:{context}` | String (JSON) | 1 hour | Recommendation results are expensive to compute (ML inference + DB queries). 1 hour is short enough to stay relevant (a user's taste doesn't change within an hour) but long enough to absorb repeated page loads. Context (time-of-day slot) ensures morning and evening recommendations are cached independently. | `rec:cache:550e8400-e29b-41d4-a716-446655440000:morning` | `{"songs":["songId-1","songId-2","songId-3"],"generatedAt":"2026-05-01T07:00:00Z"}` | Recommendation Service | — |
| `rec:trending:global` | Sorted Set | 1 hour | The trending set is rebuilt every hour by a background job that counts plays in the last 24 hours. TTL ensures the set auto-expires if the job fails, preventing a stale trending list from persisting indefinitely. | `rec:trending:global` | Members: `songId-A` (score: `15420`), `songId-B` (score: `12300`), … | Recommendation Service | Search Service (reads top-N for "trending" results), Listening Party Service (reads for song suggestions), API Gateway (reads for homepage trending widget) |
| `rec:idempotency:{eventId}` | String | 24 hours | Feedback POST requests (like, skip, thumbs-up) must be processed exactly once. The eventId is a client-generated UUID sent in the request body. 24 hours covers any realistic retry window. After 24 hours idempotency tokens are expired and a duplicate would be treated as a new event (acceptable). | `rec:idempotency:7b3c9a2e-1234-4f5a-b678-9d0e12345678` | `1` | Recommendation Service | — |
| `rec:onboarding:{userId}` | String (JSON) | 7 days | During onboarding, a user selects seed genres. This selection is cached as a fallback for new users who have not accumulated enough listening history for the ML model. Expires after 7 days by which time the user should have real listening data. | `rec:onboarding:550e8400-e29b-41d4-a716-446655440000` | `{"genres":["pop","jazz","electronic"]}` | Recommendation Service | — |

**Context values for `rec:cache:{userId}:{context}`:**

| Context token | Local time range |
|---|---|
| `morning` | 05:00 – 11:59 |
| `afternoon` | 12:00 – 16:59 |
| `evening` | 17:00 – 20:59 |
| `night` | 21:00 – 04:59 |

**Notes:**
- `rec:weights:{userId}` uses a Redis Hash so individual genre scores can be updated atomically with `HSET` without rewriting the entire object.
- When `rec:weights:{userId}` is updated, the corresponding `rec:cache:{userId}:*` keys should be deleted to prevent stale recommendations from being served for the remainder of their TTL.
- `rec:trending:global` is rebuilt atomically: the background job writes to a temporary key `rec:trending:global:tmp`, then uses `RENAME` to swap it in, then sets the TTL. This avoids a window where the key is absent.

---

### Analytics Service

The Analytics Service deduplicates streaming events (play started, play completed, skip) before writing them to the event store. This prevents double-counting caused by client retries or at-least-once delivery from the message broker.

| Key Pattern | Redis Type | TTL | TTL Rationale | Example Key | Example Value | Owner Service | Shared With |
|---|---|---|---|---|---|---|---|
| `analytics:idempotency:{eventId}` | String | 24 hours | Play/skip events carry a client-generated UUID. 24 hours covers all realistic retry scenarios (network failure, client restart, broker redelivery). After 24 hours the token expires and any late duplicate is treated as a new event — acceptable because the impact of a single double-count after 24 hours is negligible. | `analytics:idempotency:c1d2e3f4-5678-90ab-cdef-1234567890ab` | `1` | Analytics Service | — |

**Notes:**
- The check-and-set pattern: `SET analytics:idempotency:{eventId} 1 EX 86400 NX`. If the command returns `nil`, the event was already processed and must be discarded. If it returns `OK`, proceed with processing.
- `eventId` is always a UUID v4 generated by the client at event creation time, not a sequential integer.

---

### Listening Party Service

The Listening Party Service manages real-time collaborative listening sessions. Redis is the primary store for room state (not a cache) because room state is ephemeral by design — sessions do not need to survive a Redis restart. If Redis loses a room, users rejoin or the session is considered ended.

| Key Pattern | Redis Type | TTL | TTL Rationale | Example Key | Example Value | Owner Service | Shared With |
|---|---|---|---|---|---|---|---|
| `party:room:{roomId}` | Hash | 4 hours | A listening party is a short-lived social session. 4 hours covers even the longest realistic party. The TTL is refreshed whenever the host takes an action (play, pause, skip). If the host abandons the session, the room auto-expires. | `party:room:f47ac10b-58cc-4372-a567-0e02b2c3d479` | `{"hostId":"550e…","currentSongId":"song-uuid","positionSec":"142","status":"playing","createdAt":"2026-05-01T20:00:00Z","trackTitle":"Blinding Lights"}` | Listening Party Service | — |
| `party:members:{roomId}` | Set | 4 hours (same as room) | Member set must share the same TTL as the room. If the room expires, the member set is meaningless. TTL is refreshed in the same transaction as `party:room:{roomId}`. | `party:members:f47ac10b-58cc-4372-a567-0e02b2c3d479` | `{"550e8400…", "661f9511…", "772g0622…"}` (Set of userId strings) | Listening Party Service | User Service (reads to resolve displayNames for member list) |
| `party:joincode:{joinCode}` | String | 4 hours (same as room) | A short alphanumeric join code maps to a roomId for easy sharing (e.g., "ABC123"). Same TTL as the room — when the room expires, the join code should also expire. The service must also explicitly delete this key when the room is closed by the host. | `party:joincode:ABC123` | `f47ac10b-58cc-4372-a567-0e02b2c3d479` | Listening Party Service | — |
| `party:heartbeat:{roomId}:{userId}` | String | 35 seconds | Each connected client sends a heartbeat every 30 seconds. The key TTL is set to 35 seconds — a 5-second grace period for network jitter. If the client disconnects without a clean leave event, the heartbeat key expires and the server detects the absence on the next sweep, removing the user from `party:members:{roomId}`. | `party:heartbeat:f47ac10b-58cc-4372-a567-0e02b2c3d479:550e8400-e29b-41d4-a716-446655440000` | `2026-05-01T20:47:00Z` (ISO-8601 timestamp of last heartbeat) | Listening Party Service | — |

**Notes:**
- `party:room:{roomId}` and `party:members:{roomId}` must always be updated in a Redis pipeline or multi-exec to ensure atomicity and consistent TTL refresh.
- When a host ends a session explicitly, the service must delete all four related keys: `party:room:*`, `party:members:*`, `party:joincode:*`, and all `party:heartbeat:{roomId}:*` keys (via SCAN pattern).
- `party:heartbeat:{roomId}:{userId}` intentionally has no complex value — the key's existence is the signal. The timestamp value is stored for debugging only.

---

### Search Service

The Search Service caches search results to avoid hitting Elasticsearch on every keystroke or repeated query. The query string is hashed before being used in the key to avoid long key names and to prevent special characters from breaking the key format.

| Key Pattern | Redis Type | TTL | TTL Rationale | Example Key | Example Value | Owner Service | Shared With |
|---|---|---|---|---|---|---|---|
| `search:cache:{query_hash}` | String (JSON) | 10 minutes | Search results are relatively fresh — new songs and artists are indexed continuously. 10 minutes is short enough to surface recently indexed content without excessive cache churn. Popular queries benefit from caching; rare queries will simply miss and hit Elasticsearch. | `search:cache:5d41402a` (first 8 chars of SHA-256 of `"blinding lights"`) | `{"query":"blinding lights","type":"all","results":[{"type":"song","id":"…","title":"Blinding Lights"},…],"total":42,"cachedAt":"2026-05-01T10:00:00Z"}` | Search Service | — |
| `search:cache:{query_hash}:{type}` | String (JSON) | 10 minutes | When a search is scoped to a specific entity type (songs, artists, albums, playlists), the type is appended as a sub-key so that a broad and a typed search for the same query are cached independently. | `search:cache:5d41402a:song` | `{"query":"blinding lights","type":"song","results":[…],"total":8,"cachedAt":"2026-05-01T10:00:00Z"}` | Search Service | — |

**Notes:**
- `query_hash` is the first 16 hex characters of the SHA-256 hash of the normalized (lowercased, trimmed) query string. This keeps key names short while maintaining sufficient collision resistance for a cache use case.
- Cache entries are never invalidated proactively — they simply expire. If the search index is updated and a cached result is momentarily stale, this is acceptable given the 10-minute TTL.
- Type values: `song`, `artist`, `album`, `playlist`. A search with no type filter uses the pattern without `:{type}`.

---

### Streaming Service

The Streaming Service optionally caches pre-signed S3 URLs to avoid generating a new signature on every play request. The TTL is intentionally shorter than the S3 pre-signed URL lifetime to ensure the cached URL is never served when it is already expired from S3's perspective.

| Key Pattern | Redis Type | TTL | TTL Rationale | Example Key | Example Value | Owner Service | Shared With |
|---|---|---|---|---|---|---|---|
| `stream:presigned:{songId}:{userId}` | String | 13 minutes | S3 pre-signed URLs are generated with a 15-minute expiry. Caching them for 13 minutes (2 minutes less) ensures the URL is always valid when served from cache. The 2-minute buffer covers clock skew and network latency. After 13 minutes the cache miss forces a fresh URL to be generated. | `stream:presigned:song-uuid-1234:550e8400-e29b-41d4-a716-446655440000` | `https://music-bucket.s3.amazonaws.com/songs/song-uuid-1234.mp3?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=900&X-Amz-Signature=abc123…` | Streaming Service | — |
| `stream:idempotency:{eventId}` | String | 24 hours | Streaming start/end events (used for billing or analytics) must not be double-processed. Same pattern as Analytics idempotency. | `stream:idempotency:e5f6a7b8-9012-34cd-ef56-7890abcdef12` | `1` | Streaming Service | — |

**Notes:**
- The userId component in `stream:presigned:{songId}:{userId}` is required because pre-signed URLs may carry per-user permissions or logging metadata. A URL generated for user A must not be served to user B.
- If the platform moves to CDN-signed URLs (e.g., CloudFront signed cookies), this key pattern may become obsolete. The TTL logic must be recalculated against the CDN URL lifetime.

---

## Shared / Cross-Service Keys

These keys are **written by one service** and **read by one or more other services**. Cross-service reads must be explicitly approved and documented here. No service may write to another service's key namespace without being listed in this table.

| Key Pattern | Written By | Read By | Nature of Sharing | Risk if Stale |
|---|---|---|---|---|
| `auth:blacklist:{jti}` | Auth Service | API Gateway | The Gateway checks this key on every authenticated request to reject tokens that have been explicitly revoked (logout, password change). Auth Service writes; Gateway reads. | **High** — a revoked token could be accepted. TTL is set to token remaining lifetime to mitigate. |
| `auth:pubkey:cache` | Auth Service | API Gateway | The Gateway caches the JWT public key to verify token signatures locally without calling Auth Service on every request. Auth Service refreshes this key on key rotation. | **Medium** — Gateway may verify with an old key. TTL of 1h limits exposure window. On key rotation, Auth Service should proactively delete and rewrite this key. |
| `rec:trending:global` | Recommendation Service | Search Service, Listening Party Service, API Gateway (homepage) | Trending data is a shared read-only dataset. These consumers never write to it. | **Low** — trending results are inherently approximate. A 1-hour stale trending list is acceptable. |
| `user:profile:{userId}` | User Service | Recommendation Service, Listening Party Service | These services read display names and avatar URLs for UI rendering. They must never write this key. On cache miss they call the User Service API. | **Low** — display name staleness for 15 minutes is acceptable. |

### Rules for cross-service key access

1. A service must **never write** to a key in another service's namespace.
2. A service may **read** another service's key only if the sharing is documented in the table above.
3. If a new cross-service read dependency is needed, it must be added to this table in a PR that is reviewed by both service owners.
4. Services must handle cache misses gracefully — a missing cross-service key must never cause a hard failure. Fall back to an API call or a sensible default.

---

## TTL Design Summary

| Key Category | Example Key Pattern | TTL | Rationale |
|---|---|---|---|
| Access token blacklist | `auth:blacklist:{jti}` | Token remaining lifetime (minutes to hours) | Must expire exactly when the token would have expired naturally |
| Refresh token | `auth:refresh:{userId}` | 30 days | Matches refresh token expiry policy |
| Brute-force counter | `auth:failcount:{email_hash}` | 15 minutes | Rolling lockout window; auto-clears to give user another chance |
| Account lockout | `auth:lockout:{email_hash}` | 15 minutes | Lockout duration; auto-unlock on expiry |
| JWT public key cache | `auth:pubkey:cache` | 1 hour | Reduces Auth Service load; short enough to pick up key rotation |
| Rate limit counter | `gateway:ratelimit:ip:{ip}`, `gateway:ratelimit:token:{userId}` | 60 seconds | Fixed 60-second window; resets automatically |
| User profile cache | `user:profile:{userId}` | 15 minutes | Balances freshness vs. DB load; write-through invalidation on update |
| Preference weights | `rec:weights:{userId}` | 7 days | Slowly-changing model feature; survives weekly inactivity |
| Recommendation cache | `rec:cache:{userId}:{context}` | 1 hour | Expensive to compute; time-of-day slot changes every few hours |
| Trending sorted set | `rec:trending:global` | 1 hour | Rebuilt hourly by background job; TTL prevents stale data on job failure |
| Onboarding fallback | `rec:onboarding:{userId}` | 7 days | Needed until real listening history accumulates |
| Idempotency token (general) | `rec:idempotency:*`, `analytics:idempotency:*`, `stream:idempotency:*` | 24 hours | Covers all realistic retry windows |
| Listening party room | `party:room:{roomId}`, `party:members:{roomId}`, `party:joincode:{joinCode}` | 4 hours | Maximum realistic session length; refreshed on activity |
| Heartbeat signal | `party:heartbeat:{roomId}:{userId}` | 35 seconds | 30s heartbeat interval + 5s grace; absence = disconnected |
| Search result cache | `search:cache:{query_hash}[:{type}]` | 10 minutes | Fresh enough for newly indexed content; short churn for rare queries |
| Pre-signed URL cache | `stream:presigned:{songId}:{userId}` | 13 minutes | 2-minute safety margin below S3's 15-minute URL expiry |

---

## Key Collision Prevention

### Rule 1 — Service prefix is mandatory

Every key must begin with the service prefix defined in the [Short service name registry](#short-service-name-registry). A key without a prefix is rejected at code review. Enforced by a shared Redis client wrapper that prepends the service prefix and throws if the caller attempts to write a key that does not start with the expected prefix.

### Rule 2 — No service reads or writes another service's namespace without explicit approval

The only documented exceptions are listed in [Shared / Cross-Service Keys](#shared--cross-service-keys). Any new cross-service access must be reviewed and merged into that section before the code ships.

### Rule 3 — Entity names must be unambiguous within a service namespace

Within a single service prefix, entity names must be unique. For example, the Auth Service must not have both `auth:token:{id}` and `auth:tokens:{id}` — pick one term and use it consistently.

### Rule 4 — Identifiers must be UUIDs or opaque hashes

No sequential integers (e.g., `auth:refresh:1`, `auth:refresh:2`). Sequential IDs are enumerable and create a security risk. Use UUIDs v4 or opaque cryptographic hashes as identifiers.

### Rule 5 — No PII in key names

Email addresses, phone numbers, usernames, and display names must never appear in a key name. Use the user's UUID or a SHA-256 hash of the PII value (as in `auth:failcount:{email_hash}`).

### Rule 6 — Key pattern documentation must precede implementation

Before any new Redis key is introduced, its pattern, type, TTL, owner, and any cross-service readers must be added to this document. This document is the single source of truth for Redis key design.

---

## Operational Guidelines

### Memory eviction policy

```
maxmemory-policy allkeys-lru
```

All keys have TTLs, making `allkeys-lru` the correct policy. Redis will evict the least-recently-used keys when memory pressure occurs. This is preferable to `noeviction` (which causes write errors) or `volatile-lru` (which only evicts keys with TTLs — all keys here have TTLs, so the two are equivalent, but `allkeys-lru` is more explicit).

Set `maxmemory` to 75–80% of available RAM to leave headroom for the Redis process itself and for large key operations (e.g., `RENAME` during trending set rebuild).

### Flushing by namespace (never use FLUSHALL in production)

To evict all keys for a specific service (e.g., after a cache invalidation event or a deployment):

```bash
# Example: flush all recommendation caches
redis-cli --scan --pattern "rec:cache:*" | xargs -L 100 redis-cli DEL

# Example: flush all search caches
redis-cli --scan --pattern "search:cache:*" | xargs -L 100 redis-cli DEL
```

**Never use `FLUSHALL` or `FLUSHDB` in production.** These commands evict all keys regardless of service, including session state and rate-limit counters, causing a thundering herd on all downstream databases simultaneously.

Use `SCAN` (never `KEYS`) to iterate over keyspace. `KEYS *` blocks the Redis event loop for the duration of the scan on large keyspaces.

### Key monitoring

- Use **Redis Insight** or **redis-cli MONITOR** (briefly, in non-production) to inspect key activity.
- Configure **keyspace notifications** (`notify-keyspace-events Ex`) to emit events when keys expire. The Listening Party Service subscribes to expiry events on `party:heartbeat:*` to detect disconnected members without a polling loop.
- Alert on `used_memory` / `maxmemory` ratio exceeding 70%.
- Alert on `keyspace_hits` / (`keyspace_hits` + `keyspace_misses`) cache hit rate dropping below 80% for cache namespaces.

### Redis memory estimation (approximate)

| Key Pattern | Estimated Count | Estimated Size per Key | Total |
|---|---|---|---|
| `auth:refresh:{userId}` | 100,000 users | ~120 bytes | ~12 MB |
| `auth:blacklist:{jti}` | 10,000 active revocations | ~80 bytes | ~0.8 MB |
| `auth:failcount` / `auth:lockout` | 1,000 active lockouts | ~60 bytes | ~0.06 MB |
| `gateway:ratelimit:*` | 50,000 active IPs + users | ~60 bytes | ~3 MB |
| `user:profile:{userId}` | 80,000 cached profiles | ~400 bytes | ~32 MB |
| `rec:weights:{userId}` | 80,000 active users | ~200 bytes | ~16 MB |
| `rec:cache:{userId}:{context}` | 80,000 users × 4 contexts | ~800 bytes | ~256 MB |
| `rec:trending:global` | 1 key × 1,000 members | ~40 KB | ~0.04 MB |
| `rec:idempotency` / `analytics:idempotency` / `stream:idempotency` | 500,000 events/day | ~60 bytes | ~30 MB |
| `party:room` / `party:members` / `party:joincode` / `party:heartbeat` | 5,000 active rooms × 10 members | ~500 bytes | ~25 MB |
| `search:cache:*` | 20,000 popular queries | ~2 KB | ~40 MB |
| `stream:presigned:*` | 30,000 active plays | ~600 bytes | ~18 MB |
| **Total (estimated)** | | | **~433 MB** |

Provision at least **1 GB** of Redis memory to accommodate growth and peak load spikes.

### Slow log configuration

```
slowlog-log-slower-than 10000   # Log commands taking > 10ms
slowlog-max-len 512
```

Review the slow log weekly. Any command appearing in the slow log regularly indicates a key that has grown too large (e.g., `rec:trending:global` with too many members) or a missing pipeline where individual commands are issued in a loop.

---

## Anti-patterns to Avoid

### 1. Keys without TTL

Every key must have a TTL set at creation time. A key without a TTL is a memory leak. If you find yourself needing a permanent key (e.g., a global configuration), that data belongs in the primary database, not Redis.

**Wrong:**
```
SET user:profile:550e8400 '{"displayName":"Nghiep"}'
```

**Correct:**
```
SET user:profile:550e8400 '{"displayName":"Nghiep"}' EX 900
```

### 2. PII in key names

Never embed email addresses, phone numbers, usernames, or any directly identifying information in a key name. Key names appear in logs, slow logs, Redis Insight dashboards, and monitoring tools.

**Wrong:**
```
auth:failcount:hoanhnghiep2704@gmail.com
```

**Correct:**
```
auth:failcount:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3
```
(SHA-256 of the email)

### 3. Sequential integer IDs as key identifiers

Sequential IDs are enumerable. An attacker who discovers the pattern can iterate over all keys. Use UUID v4 or opaque hashes.

**Wrong:**
```
auth:refresh:1
auth:refresh:2
auth:refresh:3
```

**Correct:**
```
auth:refresh:550e8400-e29b-41d4-a716-446655440000
```

### 4. Storing large objects in Redis

Redis is not a document store. Avoid storing objects larger than ~100 KB in a single key. Large objects slow down serialization, consume disproportionate memory, and cause network latency spikes. If a cached object exceeds this size, consider caching only the IDs and fetching details lazily, or splitting the object across multiple Hash fields.

### 5. Using KEYS * in production

`KEYS *` blocks the Redis event loop while it scans the entire keyspace. On a large instance this can cause multi-second pauses and trigger timeouts across all services sharing the Redis instance. Always use `SCAN` with a cursor for keyspace iteration.

**Wrong:**
```
KEYS rec:cache:*
```

**Correct:**
```
SCAN 0 MATCH rec:cache:* COUNT 100
```

### 6. Sharing a Redis instance's FLUSHDB across environments

Never run `FLUSHDB` or `FLUSHALL` on a shared Redis instance. In development, each developer should use a separate Redis database index (0–15) or a dedicated Redis container. In production, these commands are prohibited.

### 7. Writing to another service's key namespace

A service must own its key namespace exclusively. If Service B needs data that Service A owns, Service B must call Service A's API, not write directly to Service A's Redis keys. The only approved cross-service reads are documented in [Shared / Cross-Service Keys](#shared--cross-service-keys).

### 8. Using Redis as a primary database for non-ephemeral data

Redis data is ephemeral. Do not store user accounts, song metadata, transaction records, or any data that must survive a Redis restart in Redis alone. The sole exception is `party:room:{roomId}` — listening party sessions are explicitly ephemeral and do not need to survive a Redis restart.

---

*This document is the authoritative reference for Redis key design in the Smart Music Streaming Platform. All Redis key additions or modifications must be reflected here before the corresponding code is merged.*

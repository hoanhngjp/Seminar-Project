# gRPC Contracts — Smart Music Streaming Platform

## Table of Contents

1. [Overview](#1-overview)
2. [RPC: ValidateToken (API Gateway → Auth Service)](#2-rpc-validatetoken-api-gateway--auth-service)
3. [RPC: GetUserProfile (Auth Service → User Service)](#3-rpc-getuserprofile-auth-service--user-service)
4. [Fallback Behavior](#4-fallback-behavior)
5. [Proto File Location & Code Generation](#5-proto-file-location--code-generation)
6. [Versioning Strategy](#6-versioning-strategy)

---

## 1. Overview

### Why Only 2 gRPC Calls?

The Smart Music Streaming Platform intentionally limits gRPC to **exactly two internal calls**. Every other inter-service call uses REST. This is a deliberate design decision documented in `CLAUDE.md`:

> **gRPC**: Auth hot path — API Gateway → Auth Service → User Service (low latency)
> **REST**: Service-to-service internal calls (Music ↔ Streaming, Recommendation ↔ Music)

The rationale is pragmatic:

- **Auth is on every request's critical path.** Latency compounds across the two hops (Gateway → Auth → User). HTTP/1.1 REST overhead (header bloat, text parsing, no multiplexing) would add 10–30ms per hop that cannot be recovered. gRPC over HTTP/2 with Protobuf binary serialization keeps each hop well within budget.
- **All other inter-service calls are not on the critical path.** They are either async (Kafka), user-initiated (REST with acceptable 200–500ms budgets), or cacheable. The operational complexity of a full gRPC mesh (schema registry, breaking-change governance, bi-directional streaming management) is not justified for a seminar-scale project.
- **REST is universally understood by the team.** Limiting gRPC to the two latency-critical hops minimises the learning curve and the blast radius of protocol-level mistakes.

### gRPC vs REST Decision Matrix

| Criterion | gRPC (Auth hot path) | REST (all other calls) |
|---|---|---|
| Serialization | Protobuf (binary, compact) | JSON (text, human-readable) |
| Protocol | HTTP/2 (multiplexed, header compression) | HTTP/1.1 (per-request TCP) |
| Latency | ~1–5ms per hop | ~10–30ms per hop |
| Streaming | Supported (not used here) | Not native |
| Schema contract | `.proto` file (strongly typed) | OpenAPI / informal |
| Code generation | Yes (`protoc`, `dotnet grpc`) | Optional (NSwag, etc.) |
| Debugging ease | Low (binary wire format) | High (curl, Postman) |
| When to use | Sub-50ms latency requirement | Everything else |

---

## 2. RPC: ValidateToken (API Gateway → Auth Service)

**Service:** `AuthService` — defined in `proto/auth.proto`
**Namespace:** `SmartMusic.Auth.Grpc`
**Called by:** API Gateway on **every** authenticated HTTP request before routing upstream.

### Request: `ValidateTokenRequest`

| Field | Proto Type | Required | Description |
|---|---|---|---|
| `token` | `string` | Yes | Raw JWT Bearer token. The caller strips the `"Bearer "` prefix from the `Authorization` header before sending. |
| `correlation_id` | `string` | No | Distributed tracing ID propagated from the incoming HTTP request. When omitted, the Auth Service generates a new UUID v4. |

### Response: `ValidateTokenResponse`

| Field | Proto Type | Always Present | Description |
|---|---|---|---|
| `is_valid` | `bool` | Yes | `true` if token passed signature verification, expiry check, and Redis blacklist check. |
| `user_id` | `string` | Only when valid | UUID v4 — the `sub` claim from the JWT. |
| `role` | `Role` (enum) | Only when valid | RBAC role: `LISTENER`, `CREATOR`, or `ADMIN`. |
| `expires_at` | `google.protobuf.Timestamp` | Only when valid | Token expiry (`exp` claim) in UTC. |
| `correlation_id` | `string` | Yes | Echoed or generated tracing ID for downstream log correlation. |

### `Role` Enum Values

| Value | Number | Meaning |
|---|---|---|
| `ROLE_UNSPECIFIED` | 0 | Proto3 zero-value. Never used in valid responses. |
| `LISTENER` | 1 | Standard end-user. Can play, queue, follow. |
| `CREATOR` | 2 | Musician/artist. Can upload tracks and view analytics. |
| `ADMIN` | 3 | Platform administrator. Full access. |

### gRPC Status Codes

| Status Code | Condition | API Gateway Behaviour |
|---|---|---|
| `OK` | Token is valid, all checks passed. | Forward request with enriched auth headers. |
| `UNAUTHENTICATED` | Token is missing, malformed, expired, or present in the Redis revocation blacklist. | Return `401 Unauthorized` to the HTTP client immediately. |
| `UNAVAILABLE` | Redis blacklist is unreachable and the Auth Service cannot guarantee revocation status. | Apply circuit-breaker offline fallback (see Section 4). |

### Timeout

- **Hard limit: 50ms** (this is the Gateway→Auth leg of the 100ms total auth budget).
- If the deadline is exceeded, gRPC delivers a `DEADLINE_EXCEEDED` status to the Gateway.
- The Gateway treats `DEADLINE_EXCEEDED` identically to `UNAVAILABLE` and applies the offline fallback.

### Retry Policy

| Parameter | Value | Rationale |
|---|---|---|
| Max attempts | 3 (1 initial + 2 retries) | Fast-fail: the auth path blocks every request; excessive retries would cascade into user-visible latency spikes. |
| Initial backoff | 10ms | Short enough to stay within the 50ms budget across all attempts. |
| Backoff multiplier | 1.0 (fixed) | No exponential growth — budget is too tight for it. |
| Retryable status codes | `UNAVAILABLE` only | `UNAUTHENTICATED` is deterministic and must not be retried. |

### Circuit Breaker

| Parameter | Value |
|---|---|
| Failure threshold | 3 consecutive `UNAVAILABLE` or `DEADLINE_EXCEEDED` responses |
| Open-circuit action | Gateway switches to **offline JWT verification mode** (see Section 4) |
| Half-open probe interval | 5 seconds |
| Close condition | 1 successful `ValidateToken` response in half-open state |

---

## 3. RPC: GetUserProfile (Auth Service → User Service)

**Service:** `UserService` — defined in `proto/user.proto`
**Namespace:** `SmartMusic.User.Grpc`
**Called by:** Auth Service immediately after a successful `ValidateToken` to enrich the auth context before it is forwarded to the API Gateway.

### Request: `GetUserProfileRequest`

| Field | Proto Type | Required | Description |
|---|---|---|---|
| `user_id` | `string` | Yes | UUID v4 of the user, sourced from the validated JWT `sub` claim. |

### Response: `GetUserProfileResponse`

| Field | Proto Type | Always Present | Description |
|---|---|---|---|
| `user_id` | `string` | Yes | Echoed UUID for caller-side correlation. |
| `display_name` | `string` | Yes (may be empty) | User-facing display name. Empty if onboarding is incomplete. |
| `email` | `string` | Yes | Primary account email address. |
| `role` | `Role` (enum) | Yes | Authoritative RBAC role from the User Service DB (source of truth). |
| `is_active` | `bool` | Yes | `false` for suspended or soft-deleted accounts. |
| `onboarding_completed` | `bool` | Yes | `false` until the user completes initial onboarding (genres, display name). |
| `created_at` | `google.protobuf.Timestamp` | Yes | Account registration timestamp in UTC. |

### `Role` Enum Values

Same semantic meaning as `auth.Role`. Defined independently in `user.proto` to keep packages decoupled.

| Value | Number | Meaning |
|---|---|---|
| `ROLE_UNSPECIFIED` | 0 | Proto3 zero-value. Never used in valid responses. |
| `LISTENER` | 1 | Standard end-user. |
| `CREATOR` | 2 | Musician/artist with upload and analytics access. |
| `ADMIN` | 3 | Platform administrator. |

### gRPC Status Codes

| Status Code | Condition | Auth Service Behaviour |
|---|---|---|
| `OK` | User found; all profile fields populated. | Include full profile in the enriched auth context. |
| `NOT_FOUND` | No user with the given `user_id` exists in the User Service DB. | Auth Service returns `UNAUTHENTICATED` to the Gateway (token references a deleted user). |
| `UNAVAILABLE` | PostgreSQL is unreachable in the User Service. | Apply minimal-profile fallback (see Section 4). |

### Timeout

- **Hard limit: 50ms** (this is the Auth→User leg of the 100ms total auth budget).
- `DEADLINE_EXCEEDED` is treated as `UNAVAILABLE` by the Auth Service.

### Retry Policy

| Parameter | Value |
|---|---|
| Max attempts | 3 (1 initial + 2 retries) |
| Initial backoff | 10ms (fixed, no exponential growth) |
| Retryable status codes | `UNAVAILABLE` only |

### Circuit Breaker

| Parameter | Value |
|---|---|
| Failure threshold | 3 consecutive `UNAVAILABLE` or `DEADLINE_EXCEEDED` responses |
| Open-circuit action | Auth Service switches to **minimal-profile fallback mode** (see Section 4) |
| Half-open probe interval | 5 seconds |
| Close condition | 1 successful `GetUserProfile` response in half-open state |

---

## 4. Fallback Behavior

The auth path is on the critical path of **every authenticated request**. Both gRPC services must degrade gracefully rather than propagate failures to end users.

### 4.1 Auth Service DOWN (ValidateToken unavailable)

**Trigger:** API Gateway circuit breaker opens after 3 consecutive failures reaching the Auth Service (`UNAVAILABLE`, `DEADLINE_EXCEEDED`, or TCP connection refused).

**Fallback: Offline JWT Verification (Public Key Mode)**

1. The Gateway caches the Auth Service's **RSA public key** (fetched at startup and refreshed every 60 seconds via a background task from the Auth Service's JWKS endpoint).
2. When the circuit is open, the Gateway verifies the JWT signature locally using the cached public key — no Auth Service call is made.
3. **Accepted risk:** The Redis revocation blacklist is not consulted. A token that was revoked (e.g., via logout) within the last rotation window (up to 60 seconds) may be accepted during the outage window. This is a deliberate trade-off: availability over strict revocation guarantees for a short outage window.
4. The Gateway extracts `user_id`, `role`, and `exp` directly from the JWT claims and constructs the enriched auth context without calling the User Service.
5. If the public key cache is also stale (older than 5 minutes), the Gateway rejects all requests with `503 Service Unavailable` rather than accepting tokens with an expired key.

**Headers forwarded in offline mode:**

```
X-User-Id: <from JWT sub claim>
X-User-Role: <from JWT role claim>
X-Auth-Mode: offline
X-Correlation-Id: <generated or propagated>
```

Downstream services MUST tolerate the `X-Auth-Mode: offline` header and SHOULD log a warning, but MUST NOT reject the request solely on this basis.

### 4.2 User Service DOWN (GetUserProfile unavailable)

**Trigger:** Auth Service circuit breaker opens after 3 consecutive failures reaching the User Service (`UNAVAILABLE`, `DEADLINE_EXCEEDED`).

**Fallback: Minimal Profile from JWT Claims**

1. The Auth Service returns a successful `ValidateTokenResponse` with `is_valid = true`.
2. `user_id` and `role` are populated from the JWT claims (already validated).
3. All User Service-sourced fields are omitted or zeroed:
   - `display_name` — empty string
   - `email` — empty string
   - `is_active` — defaults to `true` (optimistic assumption; the JWT is valid so the account was active at login time)
   - `onboarding_completed` — defaults to `true` (avoids redirect loops in degraded mode)
   - `created_at` — zero timestamp (not present)
4. The Gateway forwards the minimal context. Downstream services that require `display_name` or `email` (e.g., Notification Service) will fail gracefully for that specific operation — the music playback path is unaffected.

**Acceptable degradation during User Service outage:**
- Music playback: fully functional
- Listening Party: functional (display name shown as empty or "Unknown")
- Profile page: returns `503` (direct User Service REST call, unrelated to this path)
- Creator Analytics: functional (no display name dependency)

---

## 5. Proto File Location & Code Generation

### File Structure

```
proto/
├── auth.proto          # AuthService — ValidateToken RPC
└── user.proto          # UserService — GetUserProfile RPC
```

Both files import `google/protobuf/timestamp.proto` from the official `google-protobuf` well-known types package.

### Code Generation — C# / ASP.NET Core

**Option A: `dotnet grpc` tooling (recommended for .NET projects)**

Add the NuGet packages to the relevant `.csproj` files:

```xml
<!-- Auth Service -->
<PackageReference Include="Grpc.AspNetCore" Version="2.*" />
<PackageReference Include="Google.Protobuf" Version="3.*" />
<PackageReference Include="Grpc.Tools" Version="2.*" PrivateAssets="All" />

<ItemGroup>
  <!-- Server-side stub (Auth Service implements AuthService) -->
  <Protobuf Include="..\..\proto\auth.proto" GrpcServices="Server" />

  <!-- Client-side stub (Auth Service calls UserService) -->
  <Protobuf Include="..\..\proto\user.proto" GrpcServices="Client" />
</ItemGroup>
```

```xml
<!-- API Gateway -->
<ItemGroup>
  <!-- Client-side stub (Gateway calls AuthService) -->
  <Protobuf Include="..\..\proto\auth.proto" GrpcServices="Client" />
</ItemGroup>
```

```xml
<!-- User Service -->
<ItemGroup>
  <!-- Server-side stub (User Service implements UserService) -->
  <Protobuf Include="..\..\proto\user.proto" GrpcServices="Server" />
</ItemGroup>
```

Stubs are auto-generated at build time by `Grpc.Tools`. No manual `protoc` invocation needed.

**Option B: Manual `protoc` invocation**

```bash
# Install protoc + C# plugin
# protoc is available from https://github.com/protocolbuffers/protobuf/releases
# grpc_csharp_plugin is bundled with Grpc.Tools NuGet package

protoc \
  --proto_path=proto \
  --proto_path=/path/to/google-protobuf/include \
  --csharp_out=src/AuthService/Generated \
  --grpc_out=src/AuthService/Generated \
  --plugin=protoc-gen-grpc=/path/to/grpc_csharp_plugin \
  proto/auth.proto

protoc \
  --proto_path=proto \
  --proto_path=/path/to/google-protobuf/include \
  --csharp_out=src/UserService/Generated \
  --grpc_out=src/UserService/Generated \
  --plugin=protoc-gen-grpc=/path/to/grpc_csharp_plugin \
  proto/user.proto
```

### Package / Namespace Naming Convention

| Proto package | C# namespace | Project |
|---|---|---|
| `auth` | `SmartMusic.Auth.Grpc` | Auth Service, API Gateway |
| `user` | `SmartMusic.User.Grpc` | User Service, Auth Service |

The `csharp_namespace` option in each `.proto` file overrides the default package-derived namespace to follow the project's `SmartMusic.<ServiceName>.Grpc` convention.

---

## 6. Versioning Strategy

**Current version: v1**

### Principles

The two proto files follow **Protobuf's backward-compatibility rules**: field numbers are permanent. Once a field number is assigned, its number must never be reused for a different field, even if the field is removed.

### Non-Breaking Changes (safe to deploy without coordination)

These changes can be made to existing `.proto` files without bumping the version:

| Change | Example |
|---|---|
| Add a new optional field | Add `string avatar_url = 8;` to `GetUserProfileResponse` |
| Add a new enum value | Add `MODERATOR = 4;` to `Role` |
| Add a new RPC to an existing service | Add `RevokeToken` to `AuthService` |

Old clients ignore unknown fields (Protobuf forward compatibility). New clients handle missing fields as zero-values (Protobuf backward compatibility).

### Breaking Changes (require versioned package)

These changes break wire compatibility and require a new package version:

| Change | Migration path |
|---|---|
| Remove or rename a field | Mark field as `reserved`; introduce replacement in same or new package |
| Change a field's type | Introduce new field with new number; deprecate old |
| Change field number | Never do this — treat as a full breaking change |
| Remove an RPC | Deprecate via comment first; remove only after all callers migrate |

### Version Bump Process

When a breaking change is unavoidable:

1. Create `proto/v2/auth.proto` with `package auth.v2` and `option csharp_namespace = "SmartMusic.Auth.Grpc.V2"`.
2. Both the v1 and v2 services run simultaneously during the migration window.
3. Update callers (API Gateway) to use the v2 client stub.
4. Remove v1 after all callers have migrated and the old server stub is deregistered.
5. The directory structure would become:

```
proto/
├── v1/
│   ├── auth.proto
│   └── user.proto
└── v2/
    ├── auth.proto      # breaking-change version
    └── user.proto
```

Currently, with only two RPCs and a small team, the flat `proto/` layout without a version directory is sufficient. If a breaking change arises during the seminar project, introduce the `v1/` subdirectory at that point rather than prematurely.

---

## Appendix: Proto File Contents

### `proto/auth.proto`

```proto
syntax = "proto3";

package auth;

option csharp_namespace = "SmartMusic.Auth.Grpc";

import "google/protobuf/timestamp.proto";

service AuthService {
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
}

enum Role {
  ROLE_UNSPECIFIED = 0;
  LISTENER         = 1;
  CREATOR          = 2;
  ADMIN            = 3;
}

message ValidateTokenRequest {
  string token          = 1;
  string correlation_id = 2;
}

message ValidateTokenResponse {
  bool                      is_valid       = 1;
  string                    user_id        = 2;
  Role                      role           = 3;
  google.protobuf.Timestamp expires_at     = 4;
  string                    correlation_id = 5;
}
```

### `proto/user.proto`

```proto
syntax = "proto3";

package user;

option csharp_namespace = "SmartMusic.User.Grpc";

import "google/protobuf/timestamp.proto";

service UserService {
  rpc GetUserProfile(GetUserProfileRequest) returns (GetUserProfileResponse);
}

enum Role {
  ROLE_UNSPECIFIED = 0;
  LISTENER         = 1;
  CREATOR          = 2;
  ADMIN            = 3;
}

message GetUserProfileRequest {
  string user_id = 1;
}

message GetUserProfileResponse {
  string                    user_id               = 1;
  string                    display_name          = 2;
  string                    email                 = 3;
  Role                      role                  = 4;
  bool                      is_active             = 5;
  bool                      onboarding_completed  = 6;
  google.protobuf.Timestamp created_at            = 7;
}
```

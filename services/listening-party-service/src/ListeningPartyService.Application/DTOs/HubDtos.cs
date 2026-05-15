namespace ListeningPartyService.Application.DTOs;

// ── Client → Server ──────────────────────────────────────────────────────────
// Only Host may send this. Hub silently ignores if sender is not host (AC7.2.2).

public record PlayerActionMessage(
    string EventId,       // UUID v4 — for dedup logging
    string Action,        // "PLAY" | "PAUSE" | "SEEK"
    string? SongId,       // required when Action = PLAY
    double? PositionSec,  // required when Action = SEEK
    string Timestamp);    // ISO 8601 from client

// ── Server → All Clients ─────────────────────────────────────────────────────

// Broadcast when Host changes playback state (AC7.2.1)
public record SyncStateMessage(
    string SongId,
    bool IsPlaying,
    double PositionSec,
    string HostId,
    string Timestamp);    // ISO 8601 — client uses for drift calculation

// Broadcast when a new user connects to the room
public record MemberJoinMessage(
    string UserId,
    string DisplayName,   // fallback = UserId when User Service lookup unavailable
    string? AvatarUrl,    // nullable — not all users have avatars
    string JoinedAt);     // ISO 8601

// Broadcast when a user disconnects
public record MemberLeaveMessage(
    string UserId,
    string Reason);       // "voluntary" | "timeout" | "error"

// Broadcast when the room is terminated (host disconnects)
public record RoomClosedMessage(
    string Reason);       // "host_disconnected" | "manual"

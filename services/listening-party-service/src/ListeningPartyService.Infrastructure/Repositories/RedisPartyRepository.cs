using System.Text.Json;
using ListeningPartyService.Application.Interfaces;
using ListeningPartyService.Domain.Models;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace ListeningPartyService.Infrastructure.Repositories;

public class RedisPartyRepository(IDatabase db, ILogger<RedisPartyRepository> logger) : IPartyRepository
{
    private static readonly TimeSpan RoomTtl = TimeSpan.FromHours(24);

    public async Task CreateAsync(Room room, CancellationToken ct = default)
    {
        var roomKey = $"party:room:{room.RoomId}";
        var joinCodeKey = $"party:joincode:{room.JoinCode}";

        var hashEntries = new HashEntry[]
        {
            new("name", room.Name),
            new("hostId", room.HostId),
            new("songId", room.SongId),
            new("isPlaying", room.IsPlaying.ToString().ToLower()),
            new("positionSec", room.PositionSec),
            new("joinCode", room.JoinCode),
            new("lastUpdatedAt", DateTime.UtcNow.ToString("O")),
        };

        await db.HashSetAsync(roomKey, hashEntries);
        await db.KeyExpireAsync(roomKey, RoomTtl);
        await db.StringSetAsync(joinCodeKey, room.RoomId, RoomTtl);

        logger.LogDebug("Room stored in Redis: key={Key}", roomKey);
    }

    public async Task<string?> GetRoomIdByJoinCodeAsync(string joinCode, CancellationToken ct = default)
    {
        var value = await db.StringGetAsync($"party:joincode:{joinCode}");
        return value.IsNullOrEmpty ? null : value.ToString();
    }

    public async Task<Room?> GetRoomAsync(string roomId, CancellationToken ct = default)
    {
        var hash = await db.HashGetAllAsync($"party:room:{roomId}");
        if (hash.Length == 0) return null;

        var dict = hash.ToDictionary(h => h.Name.ToString(), h => h.Value.ToString());
        return new Room
        {
            RoomId = roomId,
            Name = dict.GetValueOrDefault("name", "Listening Party"),
            HostId = dict.GetValueOrDefault("hostId", ""),
            SongId = dict.GetValueOrDefault("songId", ""),
            IsPlaying = dict.GetValueOrDefault("isPlaying", "false") == "true",
            PositionSec = int.TryParse(dict.GetValueOrDefault("positionSec"), out var pos) ? pos : 0,
            JoinCode = dict.GetValueOrDefault("joinCode", ""),
            LastUpdatedAt = DateTime.TryParse(dict.GetValueOrDefault("lastUpdatedAt"), out var ts) ? ts : DateTime.UtcNow,
        };
    }

    public async Task AddMemberAsync(string roomId, string userId, CancellationToken ct = default)
    {
        await db.SetAddAsync($"party:members:{roomId}", userId);
    }

    public async Task UpdateRoomStateAsync(string roomId, bool isPlaying, int positionSec, CancellationToken ct = default)
    {
        var key = $"party:room:{roomId}";
        await db.HashSetAsync(key, new HashEntry[]
        {
            new("isPlaying", isPlaying.ToString().ToLower()),
            new("positionSec", positionSec),
            new("lastUpdatedAt", DateTime.UtcNow.ToString("O")),
        });
        logger.LogDebug("Room state updated: key={Key} isPlaying={IsPlaying} positionSec={Pos}",
            key, isPlaying, positionSec);
    }

    public async Task UpdateRoomSongAsync(string roomId, string songId, bool isPlaying, int positionSec, CancellationToken ct = default)
    {
        var key = $"party:room:{roomId}";
        await db.HashSetAsync(key, new HashEntry[]
        {
            new("songId",      songId),
            new("isPlaying",   isPlaying.ToString().ToLower()),
            new("positionSec", positionSec),
            new("lastUpdatedAt", DateTime.UtcNow.ToString("O")),
        });
        logger.LogDebug("Room song updated: key={Key} songId={SongId} isPlaying={IsPlaying}",
            key, songId, isPlaying);
    }

    public async Task RemoveMemberAsync(string roomId, string userId, CancellationToken ct = default)
    {
        await db.SetRemoveAsync($"party:members:{roomId}", userId);
    }

    public async Task<ISet<string>> GetMembersAsync(string roomId, CancellationToken ct = default)
    {
        var members = await db.SetMembersAsync($"party:members:{roomId}");
        return members.Select(m => m.ToString()).ToHashSet();
    }

    public async Task DeleteRoomAsync(string roomId, CancellationToken ct = default)
    {
        await db.KeyDeleteAsync(new RedisKey[]
        {
            $"party:room:{roomId}",
            $"party:members:{roomId}",
            $"party:queue:{roomId}",
        });
        logger.LogDebug("Room deleted from Redis: roomId={RoomId}", roomId);
    }

    public async Task<List<QueueItem>> GetQueueAsync(string roomId, CancellationToken ct = default)
    {
        var json = await db.StringGetAsync($"party:queue:{roomId}");
        if (json.IsNullOrEmpty) return [];
        return JsonSerializer.Deserialize<List<QueueItem>>(json.ToString()) ?? [];
    }

    public async Task SaveQueueAsync(string roomId, List<QueueItem> queue, CancellationToken ct = default)
    {
        var key  = $"party:queue:{roomId}";
        var json = JsonSerializer.Serialize(queue);
        await db.StringSetAsync(key, json, RoomTtl);
    }

    public async Task StoreMemberProfileAsync(string roomId, string userId, string displayName, string? avatarUrl, CancellationToken ct = default)
    {
        var key = $"party:memberprofile:{roomId}:{userId}";
        await db.HashSetAsync(key, new HashEntry[]
        {
            new("name",      displayName),
            new("avatarUrl", avatarUrl ?? ""),
        });
        await db.KeyExpireAsync(key, RoomTtl);
    }

    public async Task<(string? DisplayName, string? AvatarUrl)> GetMemberProfileAsync(string roomId, string userId, CancellationToken ct = default)
    {
        var key  = $"party:memberprofile:{roomId}:{userId}";
        var hash = await db.HashGetAllAsync(key);
        if (hash.Length == 0) return (null, null);

        var dict = hash.ToDictionary(h => h.Name.ToString(), h => h.Value.ToString());
        var name   = dict.GetValueOrDefault("name");
        var avatar = dict.GetValueOrDefault("avatarUrl");
        return (
            string.IsNullOrEmpty(name)   ? null : name,
            string.IsNullOrEmpty(avatar) ? null : avatar);
    }
}

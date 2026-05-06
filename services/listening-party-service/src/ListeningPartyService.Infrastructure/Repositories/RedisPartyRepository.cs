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
            new("hostId", room.HostId),
            new("songId", room.SongId),
            new("isPlaying", room.IsPlaying.ToString().ToLower()),
            new("positionSec", room.PositionSec),
            new("joinCode", room.JoinCode),
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
            HostId = dict.GetValueOrDefault("hostId", ""),
            SongId = dict.GetValueOrDefault("songId", ""),
            IsPlaying = dict.GetValueOrDefault("isPlaying", "false") == "true",
            PositionSec = int.TryParse(dict.GetValueOrDefault("positionSec"), out var pos) ? pos : 0,
            JoinCode = dict.GetValueOrDefault("joinCode", ""),
        };
    }

    public async Task AddMemberAsync(string roomId, string userId, CancellationToken ct = default)
    {
        await db.SetAddAsync($"party:members:{roomId}", userId);
    }
}

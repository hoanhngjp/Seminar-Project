using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using MusicService.Application.DTOs;
using MusicService.Application.Interfaces;
using StackExchange.Redis;

namespace MusicService.Infrastructure.Services;

public class RedisSongCache : ISongCache
{
    private readonly IDatabase _redis;
    private readonly ILogger<RedisSongCache> _logger;

    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(30);
    private const string Prefix = "song:meta:";

    public RedisSongCache(IConnectionMultiplexer multiplexer, ILogger<RedisSongCache> logger)
    {
        _redis = multiplexer.GetDatabase();
        _logger = logger;
    }

    public async Task<SongResponseDto?> GetAsync(Guid songId, CancellationToken cancellationToken = default)
    {
        try
        {
            var value = await _redis.StringGetAsync($"{Prefix}{songId}");
            return value.HasValue
                ? JsonSerializer.Deserialize<SongResponseDto>(value.ToString())
                : null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis GET failed for song {SongId} — falling back to DB", songId);
            return null;
        }
    }

    public async Task SetAsync(Guid songId, SongResponseDto song, CancellationToken cancellationToken = default)
    {
        try
        {
            await _redis.StringSetAsync($"{Prefix}{songId}", JsonSerializer.Serialize(song), Ttl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis SET failed for song {SongId} — cache will be populated on next request", songId);
        }
    }

    public async Task InvalidateAsync(Guid songId, CancellationToken cancellationToken = default)
    {
        try
        {
            await _redis.KeyDeleteAsync($"{Prefix}{songId}");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Redis DEL failed for song {SongId}", songId);
        }
    }
}

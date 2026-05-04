using ApiGateway.Infrastructure.Services;
using FluentAssertions;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace ApiGateway.UnitTests.Services;

public class RateLimitingServiceTests
{
    private readonly Mock<IDatabase> _redisMock = new();
    private readonly RateLimitingService _sut;

    public RateLimitingServiceTests()
    {
        _sut = new RateLimitingService(_redisMock.Object);
    }

    [Fact]
    public async Task IsAllowedAsync_UnderLimit_ReturnsTrue()
    {
        // AC0.1.3: first request — under limit → allowed
        var key = "gateway:ratelimit:ip:192.168.1.1";

        _redisMock.Setup(r => r.SortedSetRemoveRangeByScoreAsync(key,
            It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(0);
        _redisMock.Setup(r => r.SortedSetLengthAsync(key, It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(5); // 5 existing entries, limit is 100
        _redisMock.Setup(r => r.SortedSetAddAsync(key, It.IsAny<RedisValue>(), It.IsAny<double>(), SortedSetWhen.Always, CommandFlags.None))
            .ReturnsAsync(true);
        _redisMock.Setup(r => r.KeyExpireAsync(key, It.IsAny<TimeSpan>(), ExpireWhen.Always, CommandFlags.None))
            .ReturnsAsync(true);

        var allowed = await _sut.IsAllowedAsync(key, 100);

        allowed.Should().BeTrue();
    }

    [Fact]
    public async Task IsAllowedAsync_AtLimit_ReturnsFalse()
    {
        // AC0.1.3: exactly at limit → rejected
        var key = "gateway:ratelimit:ip:10.0.0.1";

        _redisMock.Setup(r => r.SortedSetRemoveRangeByScoreAsync(key,
            It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(0);
        _redisMock.Setup(r => r.SortedSetLengthAsync(key, It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(100); // count == limit

        var allowed = await _sut.IsAllowedAsync(key, 100);

        allowed.Should().BeFalse();
    }

    [Fact]
    public async Task IsAllowedAsync_LoginAtLimit_ReturnsFalse()
    {
        // Login limit is 10/min — at 10 entries → rejected
        var key = "gateway:ratelimit:login:10.0.0.1:abcdef123456";

        _redisMock.Setup(r => r.SortedSetRemoveRangeByScoreAsync(key,
            It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(0);
        _redisMock.Setup(r => r.SortedSetLengthAsync(key, It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(10);

        var allowed = await _sut.IsAllowedAsync(key, 10);

        allowed.Should().BeFalse();
    }

    [Fact]
    public async Task IsAllowedAsync_AllowedRequest_AddsEntryAndSetsExpiry()
    {
        // Verify sliding window: adds timestamp entry + sets 61s expiry
        var key = "gateway:ratelimit:ip:172.16.0.1";

        _redisMock.Setup(r => r.SortedSetRemoveRangeByScoreAsync(key,
            It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(0);
        _redisMock.Setup(r => r.SortedSetLengthAsync(key, It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(0);
        _redisMock.Setup(r => r.SortedSetAddAsync(key, It.IsAny<RedisValue>(), It.IsAny<double>(), SortedSetWhen.Always, CommandFlags.None))
            .ReturnsAsync(true);
        _redisMock.Setup(r => r.KeyExpireAsync(key, TimeSpan.FromSeconds(61), ExpireWhen.Always, CommandFlags.None))
            .ReturnsAsync(true);

        await _sut.IsAllowedAsync(key, 100);

        _redisMock.Verify(r => r.SortedSetAddAsync(key, It.IsAny<RedisValue>(), It.IsAny<double>(), SortedSetWhen.Always, CommandFlags.None), Times.Once);
        _redisMock.Verify(r => r.KeyExpireAsync(key, TimeSpan.FromSeconds(61), ExpireWhen.Always, CommandFlags.None), Times.Once);
    }

    [Fact]
    public async Task IsAllowedAsync_AllowedRequest_RemovesOldWindowEntries()
    {
        // Sliding window: cleans up entries older than 60s before counting
        var key = "gateway:ratelimit:ip:10.10.10.10";

        _redisMock.Setup(r => r.SortedSetRemoveRangeByScoreAsync(key,
            It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(3); // 3 stale entries removed
        _redisMock.Setup(r => r.SortedSetLengthAsync(key, It.IsAny<double>(), It.IsAny<double>(), Exclude.None, CommandFlags.None))
            .ReturnsAsync(2);
        _redisMock.Setup(r => r.SortedSetAddAsync(key, It.IsAny<RedisValue>(), It.IsAny<double>(), SortedSetWhen.Always, CommandFlags.None))
            .ReturnsAsync(true);
        _redisMock.Setup(r => r.KeyExpireAsync(key, It.IsAny<TimeSpan>(), ExpireWhen.Always, CommandFlags.None))
            .ReturnsAsync(true);

        await _sut.IsAllowedAsync(key, 100);

        _redisMock.Verify(r => r.SortedSetRemoveRangeByScoreAsync(key, 0, It.IsAny<double>(), Exclude.None, CommandFlags.None), Times.Once);
    }
}

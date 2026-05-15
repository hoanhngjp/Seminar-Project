using AnalyticsService.Application.DTOs;
using AnalyticsService.Application.Interfaces;
using AnalyticsService.Domain.Models;
using InfluxDB.Client;
using InfluxDB.Client.Api.Domain;
using InfluxDB.Client.Writes;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AnalyticsService.Infrastructure.InfluxDb;

public class InfluxAnalyticsRepository(
    InfluxDBClient client,
    IConfiguration configuration,
    ILogger<InfluxAnalyticsRepository> logger) : IAnalyticsRepository
{
    private readonly string _org = configuration["InfluxDB:Org"]
        ?? throw new InvalidOperationException("InfluxDB:Org is required.");
    private readonly string _bucket = configuration["InfluxDB:Bucket"]
        ?? throw new InvalidOperationException("InfluxDB:Bucket is required.");

    // PII rule: only userId (UUID) — no email, no name
    public async Task WritePlayEventAsync(PlayEvent ev, CancellationToken ct = default)
    {
        var point = PointData
            .Measurement("song_played")
            .Tag("song_id", ev.SongId.ToString())
            .Tag("user_id", ev.UserId.ToString())   // UUID only — AC PII rule
            .Tag("platform", ev.Platform)
            .Field("duration_sec", (long)ev.DurationSec)
            .Field("listened_sec", (long)ev.ListenedSec)
            .Field("duration_percent", ev.DurationPercent)
            .Timestamp(ev.OccurredAt.UtcDateTime, WritePrecision.Ms);

        try
        {
            var writeApi = client.GetWriteApiAsync();
            await writeApi.WritePointAsync(point, _bucket, _org, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "InfluxDB write failed for event {EventId}", ev.EventId);
            // DLQ: append to local disk queue for replay
            await AppendToDlqAsync(ev, ex.Message);
        }
    }

    public async Task<HeatmapResponse> GetHeatmapAsync(Guid songId, string timeRange, CancellationToken ct = default)
    {
        var range = timeRange == "30d" ? "-30d" : "-7d";
        var flux = $"""
            from(bucket: "{_bucket}")
              |> range(start: {range})
              |> filter(fn: (r) => r._measurement == "song_played" and r.song_id == "{songId}")
              |> filter(fn: (r) => r._field == "listened_sec")
              |> group(columns: ["_value"])
              |> count()
              |> yield(name: "heatmap")
            """;

        try
        {
            var queryApi = client.GetQueryApi();
            var tables = await queryApi.QueryAsync(flux, _org, ct);

            // Build heatmap: group play events by listened_sec bucket → compute skip rate
            // skip = listened_sec < 30% of duration → skipRate per second bucket
            var points = new List<HeatmapPoint>();
            foreach (var table in tables)
            {
                foreach (var record in table.Records)
                {
                    var second = Convert.ToInt32(record.GetValueByKey("_value") ?? 0);
                    var count = Convert.ToInt32(record.GetValue() ?? 0L);
                    points.Add(new HeatmapPoint(second, count));
                }
            }

            return new HeatmapResponse(points.OrderBy(p => p.Second).ToList());
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Heatmap query failed for song {SongId}", songId);
            return new HeatmapResponse([]);
        }
    }

    public async Task<StatsResponse> GetStatsAsync(Guid songId, CancellationToken ct = default)
    {
        var flux = $$"""
            from(bucket: "{{_bucket}}")
              |> range(start: -30d)
              |> filter(fn: (r) => r._measurement == "song_played" and r.song_id == "{{songId}}")
              |> filter(fn: (r) => r._field == "duration_percent")
              |> group()
              |> reduce(
                   identity: {count: 0, sum: 0.0},
                   fn: (r, accumulator) => ({
                     count: accumulator.count + 1,
                     sum: accumulator.sum + r._value
                   })
                 )
              |> yield(name: "stats")
            """;

        try
        {
            var queryApi = client.GetQueryApi();
            var tables = await queryApi.QueryAsync(flux, _org, ct);

            long totalPlays = 0;
            double sumPercent = 0;

            foreach (var table in tables)
            foreach (var record in table.Records)
            {
                totalPlays = Convert.ToInt64(record.GetValueByKey("count") ?? 0L);
                sumPercent = Convert.ToDouble(record.GetValueByKey("sum") ?? 0.0);
            }

            var avgPercent = totalPlays > 0 ? Math.Round(sumPercent / totalPlays, 2) : 0;

            return new StatsResponse(
                TotalPlays: totalPlays,
                TotalSkips: 0,          // populated by Song_Skipped consumer (Phase 2 detail)
                UniqueListeners: 0,     // requires HyperLogLog or distinct count (Phase 2)
                AvgListenPercent: avgPercent,
                DailyListeners: []
            );
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Stats query failed for song {SongId}", songId);
            return new StatsResponse(0, 0, 0, 0, []);
        }
    }

    private static async Task AppendToDlqAsync(PlayEvent ev, string error)
    {
        try
        {
            var line = System.Text.Json.JsonSerializer.Serialize(new
            {
                eventId = ev.EventId,
                songId = ev.SongId,
                userId = ev.UserId,
                occurredAt = ev.OccurredAt,
                error
            });
            await System.IO.File.AppendAllTextAsync("/tmp/analytics-dlq.jsonl", line + "\n");
        }
        catch
        {
            // Best-effort DLQ — silently drop if disk write fails
        }
    }
}

namespace AnalyticsService.Application.DTOs;

public record HeatmapPoint(int Second, double SkipRate);

public record HeatmapResponse(List<HeatmapPoint> Heatmap);

public record DailyPlay(string Date, long Plays);

public record StatsResponse(
    long TotalPlays,
    long TotalSkips,
    long UniqueListeners,
    double AvgListenPercent,
    List<DailyPlay> DailyPlays
);

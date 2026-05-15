namespace AnalyticsService.Application.DTOs;

public record HeatmapPoint(int Second, int Count);

public record HeatmapResponse(List<HeatmapPoint> Heatmap);

public record DailyListenerPoint(string Date, int Count);

public record StatsResponse(
    long TotalPlays,
    long TotalSkips,
    long UniqueListeners,
    double AvgListenPercent,
    List<DailyListenerPoint> DailyListeners
);

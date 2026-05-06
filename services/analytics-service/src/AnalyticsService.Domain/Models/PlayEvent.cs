namespace AnalyticsService.Domain.Models;

public record PlayEvent(
    string EventId,
    Guid UserId,
    Guid SongId,
    int DurationSec,
    int ListenedSec,
    string Platform,
    DateTimeOffset OccurredAt
)
{
    public double DurationPercent =>
        DurationSec > 0 ? Math.Round((double)ListenedSec / DurationSec * 100, 2) : 0;
}

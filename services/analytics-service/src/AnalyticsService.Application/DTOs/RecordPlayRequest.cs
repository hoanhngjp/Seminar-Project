using System.ComponentModel.DataAnnotations;

namespace AnalyticsService.Application.DTOs;

public record RecordPlayRequest(
    [Required] Guid SongId,
    [Range(1, 86400)] int DurationSec,
    [Range(0, 86400)] int ListenedSec,
    [Required] string Platform
);

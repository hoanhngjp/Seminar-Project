namespace StreamingService.Application.DTOs;

public record ChunkResult(
    Stream Content,
    string ContentRange,
    long TotalBytes,
    string ContentType,
    bool IsPartial);

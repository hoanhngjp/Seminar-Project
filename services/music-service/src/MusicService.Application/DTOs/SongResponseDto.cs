using System;
using System.Collections.Generic;

namespace MusicService.Application.DTOs;

public record SongResponseDto(
    Guid Id,
    string Title,
    ArtistSummaryDto Artist,
    AlbumSummaryDto? Album,
    int DurationSec,
    string? CoverUrl,
    bool IsExplicit,
    DateTimeOffset CreatedAt,
    string? GenreName,
    string? MoodName,
    string? Language,
    DateOnly? ReleaseDate,
    long PlayCount,
    List<FeaturedArtistDto> FeaturedArtists
);

public record ArtistSummaryDto(Guid Id, string StageName);

public record FeaturedArtistDto(Guid? Id, string Name);

public record AlbumSummaryDto(Guid Id, string Title);

public record SongStorageKeyDto(string StorageKey, string Bucket);

public record BatchSongDto(
    Guid Id,
    string Title,
    string ArtistName,
    Guid? GenreId,
    List<string> MoodTags
);

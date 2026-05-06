using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Interfaces;

namespace NotificationService.Infrastructure.Http;

public class UserServiceClient(HttpClient http, ILogger<UserServiceClient> logger) : IUserServiceClient
{
    // Full cursor loop — keeps fetching pages until hasMore = false
    public async IAsyncEnumerable<Guid> GetFollowersAsync(
        Guid artistId, [EnumeratorCancellation] CancellationToken ct)
    {
        string? cursor = null;
        const int pageSize = 1000;

        while (true)
        {
            var url = $"/internal/artists/{artistId}/followers?limit={pageSize}"
                      + (cursor is not null ? $"&cursor={Uri.EscapeDataString(cursor)}" : "");

            FollowerPageResponse? page;
            try
            {
                page = await http.GetFromJsonAsync<FollowerPageResponse>(url, ct)
                                  .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to fetch followers page. ArtistId={ArtistId} Cursor={Cursor}",
                    artistId, cursor);
                yield break;
            }

            if (page is null) yield break;

            foreach (var id in page.FollowerIds)
                yield return id;

            if (!page.HasMore) yield break;

            cursor = page.NextCursor;
        }
    }

    private record FollowerPageResponse(
        IReadOnlyList<Guid> FollowerIds,
        string? NextCursor,
        bool HasMore);
}

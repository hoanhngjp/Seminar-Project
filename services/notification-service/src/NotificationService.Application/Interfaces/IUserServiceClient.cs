namespace NotificationService.Application.Interfaces;

public interface IUserServiceClient
{
    /// <summary>Returns follower user IDs for an artist, full cursor loop until exhausted.</summary>
    IAsyncEnumerable<Guid> GetFollowersAsync(Guid artistId, CancellationToken ct);
}

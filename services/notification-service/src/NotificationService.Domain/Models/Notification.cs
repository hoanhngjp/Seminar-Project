namespace NotificationService.Domain.Models;

public class Notification
{
    public string Id { get; set; } = string.Empty;           // MongoDB ObjectId
    public Guid RecipientId { get; set; }
    public NotificationType Type { get; set; }
    public NotificationStatus Status { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public Guid? ArtistId { get; set; }
    public Guid? SongId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }
}

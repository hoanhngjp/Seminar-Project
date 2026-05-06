using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using NotificationService.Domain.Models;

namespace NotificationService.Infrastructure.Repositories;

[BsonIgnoreExtraElements]
internal class MongoNotificationDoc
{
    [BsonId]
    public ObjectId MongoId { get; set; } = ObjectId.GenerateNewId();

    [BsonElement("recipientId")]
    public Guid RecipientId { get; set; }

    [BsonElement("type")]
    public string Type { get; set; } = NotificationType.NewRelease.ToString();

    [BsonElement("status")]
    public string Status { get; set; } = NotificationStatus.Delivered.ToString();

    [BsonElement("title")]
    public string Title { get; set; } = string.Empty;

    [BsonElement("body")]
    public string Body { get; set; } = string.Empty;

    [BsonElement("thumbnailUrl")]
    public string? ThumbnailUrl { get; set; }

    [BsonElement("artistId")]
    public Guid? ArtistId { get; set; }

    [BsonElement("songId")]
    public Guid? SongId { get; set; }

    [BsonElement("createdAt")]
    public DateTime CreatedAt { get; set; }

    [BsonElement("readAt")]
    public DateTime? ReadAt { get; set; }
}

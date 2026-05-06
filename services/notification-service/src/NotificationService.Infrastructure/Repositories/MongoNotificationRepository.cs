using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using NotificationService.Application.Interfaces;
using NotificationService.Domain.Models;

namespace NotificationService.Infrastructure.Repositories;

public class MongoNotificationRepository(IMongoDatabase db, ILogger<MongoNotificationRepository> logger)
    : INotificationRepository
{
    private readonly IMongoCollection<MongoNotificationDoc> _col =
        db.GetCollection<MongoNotificationDoc>("notifications");

    public async Task<(IReadOnlyList<Notification> Items, string? NextCursor)> GetUnreadAsync(
        Guid recipientId, int limit, string? cursor, CancellationToken ct)
    {
        var filter = Builders<MongoNotificationDoc>.Filter.And(
            Builders<MongoNotificationDoc>.Filter.Eq(n => n.RecipientId, recipientId),
            Builders<MongoNotificationDoc>.Filter.In(n => n.Status,
                new[] { "Pending", "Delivered" }));

        if (cursor is not null && ObjectId.TryParse(cursor, out var cursorId))
        {
            // Cursor points to last seen _id — return docs OLDER than it (descending sort)
            filter = Builders<MongoNotificationDoc>.Filter.And(
                filter,
                Builders<MongoNotificationDoc>.Filter.Lt(n => n.MongoId, cursorId));
        }

        var docs = await _col
            .Find(filter)
            .Sort(Builders<MongoNotificationDoc>.Sort.Descending(n => n.MongoId))
            .Limit(limit + 1) // fetch one extra to determine hasMore
            .ToListAsync(ct)
            .ConfigureAwait(false);

        string? nextCursor = null;
        if (docs.Count > limit)
        {
            docs.RemoveAt(docs.Count - 1);
            nextCursor = docs[^1].MongoId.ToString();
        }

        return (docs.Select(MapToDomain).ToList(), nextCursor);
    }

    public async Task<Notification?> GetByIdAsync(string id, CancellationToken ct)
    {
        if (!ObjectId.TryParse(id, out var objectId))
            return null;

        var doc = await _col
            .Find(Builders<MongoNotificationDoc>.Filter.Eq(n => n.MongoId, objectId))
            .FirstOrDefaultAsync(ct)
            .ConfigureAwait(false);

        return doc is null ? null : MapToDomain(doc);
    }

    public async Task MarkReadAsync(string id, DateTime readAt, CancellationToken ct)
    {
        if (!ObjectId.TryParse(id, out var objectId))
            return;

        var update = Builders<MongoNotificationDoc>.Update
            .Set(n => n.Status, "Read")
            .Set(n => n.ReadAt, readAt);

        await _col.UpdateOneAsync(
            Builders<MongoNotificationDoc>.Filter.Eq(n => n.MongoId, objectId),
            update, cancellationToken: ct).ConfigureAwait(false);
    }

    public async Task MarkAllReadAsync(Guid recipientId, DateTime readAt, CancellationToken ct)
    {
        var filter = Builders<MongoNotificationDoc>.Filter.And(
            Builders<MongoNotificationDoc>.Filter.Eq(n => n.RecipientId, recipientId),
            Builders<MongoNotificationDoc>.Filter.In(n => n.Status,
                new[] { "Pending", "Delivered" }));

        var update = Builders<MongoNotificationDoc>.Update
            .Set(n => n.Status, "Read")
            .Set(n => n.ReadAt, readAt);

        var result = await _col
            .UpdateManyAsync(filter, update, cancellationToken: ct)
            .ConfigureAwait(false);

        logger.LogInformation("MarkAllRead updated {Count} docs. UserId={UserId}",
            result.ModifiedCount, recipientId);
    }

    public async Task InsertAsync(Notification notification, CancellationToken ct)
    {
        var doc = MapToDoc(notification);
        await _col.InsertOneAsync(doc, cancellationToken: ct).ConfigureAwait(false);
        notification.Id = doc.MongoId.ToString();
    }

    public async Task InsertManyAsync(IEnumerable<Notification> notifications, CancellationToken ct)
    {
        var docs = notifications.Select(MapToDoc).ToList();
        if (docs.Count == 0) return;

        await _col.InsertManyAsync(docs, cancellationToken: ct).ConfigureAwait(false);

        // Back-fill generated IDs
        var items = notifications.ToList();
        for (var i = 0; i < items.Count && i < docs.Count; i++)
            items[i].Id = docs[i].MongoId.ToString();
    }

    private static Notification MapToDomain(MongoNotificationDoc doc) => new()
    {
        Id = doc.MongoId.ToString(),
        RecipientId = doc.RecipientId,
        Type = Enum.Parse<NotificationType>(doc.Type),
        Status = Enum.Parse<NotificationStatus>(doc.Status),
        Title = doc.Title,
        Body = doc.Body,
        ThumbnailUrl = doc.ThumbnailUrl,
        ArtistId = doc.ArtistId,
        SongId = doc.SongId,
        CreatedAt = doc.CreatedAt,
        ReadAt = doc.ReadAt
    };

    private static MongoNotificationDoc MapToDoc(Notification n) => new()
    {
        RecipientId = n.RecipientId,
        Type = n.Type.ToString(),
        Status = n.Status.ToString(),
        Title = n.Title,
        Body = n.Body,
        ThumbnailUrl = n.ThumbnailUrl,
        ArtistId = n.ArtistId,
        SongId = n.SongId,
        CreatedAt = n.CreatedAt,
        ReadAt = n.ReadAt
    };
}

using Google.Cloud.Storage.V1;
using MusicService.Application.Interfaces;

namespace MusicService.Infrastructure.Services;

public class GcsStorageService : IStorageService
{
    private readonly StorageClient _client;

    public string BucketName { get; }

    public GcsStorageService(StorageClient client, string bucketName)
    {
        _client = client;
        BucketName = bucketName;
    }

    public async Task<string> UploadFileAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        await _client.UploadObjectAsync(BucketName, key, contentType, content,
            cancellationToken: cancellationToken);
        return key;
    }

    public async Task<bool> DeleteFileAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            await _client.DeleteObjectAsync(BucketName, key,
                cancellationToken: cancellationToken);
            return true;
        }
        catch (Google.GoogleApiException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }
}

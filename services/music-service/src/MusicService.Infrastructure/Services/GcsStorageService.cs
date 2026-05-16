using Google.Cloud.Storage.V1;
using MusicService.Application.Interfaces;

namespace MusicService.Infrastructure.Services;

public class GcsStorageService : IStorageService
{
    private readonly Lazy<StorageClient> _lazyClient;

    public string BucketName { get; }

    public GcsStorageService(Lazy<StorageClient> lazyClient, string bucketName)
    {
        _lazyClient = lazyClient;
        BucketName = bucketName;
    }

    public async Task<string> UploadFileAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        await _lazyClient.Value.UploadObjectAsync(BucketName, key, contentType, content,
            cancellationToken: cancellationToken);
        return key;
    }

    public async Task<bool> DeleteFileAsync(string key, CancellationToken cancellationToken = default)
    {
        try
        {
            await _lazyClient.Value.DeleteObjectAsync(BucketName, key,
                cancellationToken: cancellationToken);
            return true;
        }
        catch (Google.GoogleApiException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return false;
        }
    }
}

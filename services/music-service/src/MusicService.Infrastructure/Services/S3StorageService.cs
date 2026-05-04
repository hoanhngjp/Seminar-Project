using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MusicService.Application.Interfaces;

namespace MusicService.Infrastructure.Services;

public class S3StorageService : IStorageService
{
    private readonly IAmazonS3 _s3Client;
    private readonly string _bucketName;
    private readonly ILogger<S3StorageService> _logger;

    public S3StorageService(IAmazonS3 s3Client, IConfiguration configuration, ILogger<S3StorageService> logger)
    {
        _s3Client = s3Client;
        _bucketName = configuration["S3:BucketName"] ?? throw new ArgumentNullException("S3:BucketName is missing");
        _logger = logger;
    }

    public async Task<string> UploadFileAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Uploading file {Key} to bucket {BucketName}", key, _bucketName);
        var request = new PutObjectRequest
        {
            BucketName = _bucketName,
            Key = key,
            InputStream = content,
            ContentType = contentType
        };

        var response = await _s3Client.PutObjectAsync(request, cancellationToken);
        if (response.HttpStatusCode == System.Net.HttpStatusCode.OK)
        {
            return key;
        }

        _logger.LogError("Failed to upload file {Key}. HTTP status code: {StatusCode}", key, response.HttpStatusCode);
        throw new Exception($"Failed to upload file to S3. Status: {response.HttpStatusCode}");
    }

    public async Task<bool> DeleteFileAsync(string key, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Deleting file {Key} from bucket {BucketName}", key, _bucketName);
        var request = new DeleteObjectRequest
        {
            BucketName = _bucketName,
            Key = key
        };

        var response = await _s3Client.DeleteObjectAsync(request, cancellationToken);
        return response.HttpStatusCode == System.Net.HttpStatusCode.NoContent || 
               response.HttpStatusCode == System.Net.HttpStatusCode.OK;
    }
}

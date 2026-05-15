using System.Runtime.CompilerServices;
using Google.Cloud.Storage.V1;
using StreamingService.Application.Interfaces;

[assembly: InternalsVisibleTo("StreamingService.UnitTests")]

namespace StreamingService.Infrastructure.Storage;

public class GcsStoragePresigner : IStoragePresigner
{
    private readonly Func<string, string, CancellationToken, Task<string>> _signUrl;
    private readonly HttpClient _httpClient;

    // Production constructor: wraps UrlSigner (uses GOOGLE_APPLICATION_CREDENTIALS)
    public GcsStoragePresigner(UrlSigner urlSigner, HttpClient httpClient)
        : this(
            (bucket, key, ct) => urlSigner.SignAsync(bucket, key, TimeSpan.FromSeconds(900),
                HttpMethod.Get, cancellationToken: ct),
            httpClient)
    { }

    // Internal constructor for unit tests — injects fake sign function
    internal GcsStoragePresigner(
        Func<string, string, CancellationToken, Task<string>> signUrl,
        HttpClient httpClient)
    {
        _signUrl = signUrl;
        _httpClient = httpClient;
    }

    public Task<string> GeneratePresignedUrlAsync(string bucket, string storageKey, CancellationToken ct)
        => _signUrl(bucket, storageKey, ct);

    public async Task<StorageRangeResult> GetRangeAsync(
        string bucket,
        string storageKey,
        long? rangeStart,
        long? rangeEnd,
        CancellationToken ct)
    {
        var signedUrl = await GeneratePresignedUrlAsync(bucket, storageKey, ct);

        using var request = new HttpRequestMessage(HttpMethod.Get, signedUrl);

        bool isPartial = rangeStart.HasValue || rangeEnd.HasValue;
        if (isPartial)
            request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(rangeStart, rangeEnd);

        var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        response.EnsureSuccessStatusCode();

        var stream = await response.Content.ReadAsStreamAsync(ct);
        var totalBytes = response.Content.Headers.ContentLength ?? 0L;
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "audio/mpeg";
        var contentRangeStr = response.Content.Headers.ContentRange?.ToString()
            ?? $"bytes 0-{Math.Max(0, totalBytes - 1)}/{totalBytes}";
        bool actuallyPartial = response.StatusCode == System.Net.HttpStatusCode.PartialContent;

        return new StorageRangeResult(stream, contentRangeStr, totalBytes, contentType, actuallyPartial);
    }
}

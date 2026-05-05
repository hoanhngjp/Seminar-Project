using System.Net.Http.Json;
using StreamingService.Application.Interfaces;

namespace StreamingService.Infrastructure.Http;

public class MusicServiceClient : IMusicServiceClient
{
    private readonly HttpClient _http;

    public MusicServiceClient(HttpClient http)
    {
        _http = http;
    }

    public async Task<StorageKeyResult> GetStorageKeyAsync(Guid songId, CancellationToken ct)
    {
        HttpResponseMessage response;
        try
        {
            response = await _http.GetAsync($"/internal/songs/{songId}/storage-key", ct);
        }
        catch (OperationCanceledException)
        {
            throw new InvalidOperationException("Music service call timed out or was cancelled.");
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException($"Music service unavailable: {ex.Message}");
        }

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            throw new KeyNotFoundException($"Song {songId} not found.");

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Music service returned {(int)response.StatusCode}.");

        var body = await response.Content.ReadFromJsonAsync<StorageKeyResponse>(ct)
            ?? throw new InvalidOperationException("Music service returned empty body.");

        return new StorageKeyResult(body.StorageKey, body.Bucket);
    }

    private sealed class StorageKeyResponse
    {
        public string StorageKey { get; set; } = string.Empty;
        public string Bucket { get; set; } = string.Empty;
    }
}

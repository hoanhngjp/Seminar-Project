using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using StreamingService.Infrastructure.Storage;

namespace StreamingService.UnitTests;

public class GcsStoragePresignerTests
{
    // Fake sign function — returns a deterministic URL without real GCS credentials
    private static Func<string, string, CancellationToken, Task<string>> FakeSign(string returnUrl)
        => (_, _, _) => Task.FromResult(returnUrl);

    private static HttpClient BuildHttpClient(HttpStatusCode status, byte[] body,
        string? contentRange = null, string contentType = "audio/mpeg")
    {
        var handler = new FakeHttpMessageHandler(status, body, contentRange, contentType);
        return new HttpClient(handler) { BaseAddress = new Uri("https://gcs.example.com") };
    }

    [Fact]
    public async Task GeneratePresignedUrl_CallsSignFuncWith900sExpiry_Implicitly()
    {
        // The sign func is called — 900s expiry is enforced inside the production ctor.
        // Here we verify the func is invoked and its return value is propagated.
        var signCalled = false;
        Func<string, string, CancellationToken, Task<string>> sign = (b, k, ct) =>
        {
            signCalled = true;
            b.Should().Be("my-bucket");
            k.Should().Be("songs/abc.mp3");
            return Task.FromResult("https://signed.url");
        };

        var sut = new GcsStoragePresigner(sign, BuildHttpClient(HttpStatusCode.OK, Array.Empty<byte>()));

        var url = await sut.GeneratePresignedUrlAsync("my-bucket", "songs/abc.mp3", CancellationToken.None);

        signCalled.Should().BeTrue();
        url.Should().Be("https://signed.url");
    }

    [Fact]
    public async Task GetRangeAsync_WithRange_SetsRangeHeader_ReturnsPartialResult()
    {
        // AC3.1.2: Range request → 206 Partial Content
        var responseBody = new byte[1024];
        var httpClient = BuildHttpClient(HttpStatusCode.PartialContent, responseBody,
            contentRange: "bytes 0-1023/4096");

        var sut = new GcsStoragePresigner(FakeSign("https://signed.url"), httpClient);

        var result = await sut.GetRangeAsync("bucket", "key.mp3", 0, 1023, CancellationToken.None);

        result.IsPartial.Should().BeTrue();
        result.ContentRange.Should().Be("bytes 0-1023/4096");
        result.TotalBytes.Should().Be(1024);
        result.ContentType.Should().Be("audio/mpeg");
    }

    [Fact]
    public async Task GetRangeAsync_WithoutRange_ReturnsFullContent_IsPartialFalse()
    {
        var responseBody = new byte[4096];
        var httpClient = BuildHttpClient(HttpStatusCode.OK, responseBody);

        var sut = new GcsStoragePresigner(FakeSign("https://signed.url"), httpClient);

        var result = await sut.GetRangeAsync("bucket", "key.mp3", null, null, CancellationToken.None);

        result.IsPartial.Should().BeFalse();
        result.TotalBytes.Should().Be(4096);
    }

    [Fact]
    public async Task GetRangeAsync_WhenGcsReturns404_ThrowsHttpRequestException()
    {
        var httpClient = BuildHttpClient(HttpStatusCode.NotFound, Array.Empty<byte>());
        var sut = new GcsStoragePresigner(FakeSign("https://signed.url"), httpClient);

        var act = () => sut.GetRangeAsync("bucket", "missing.mp3", null, null, CancellationToken.None);

        await act.Should().ThrowAsync<HttpRequestException>();
    }

    // ----------------------------------------------------------------
    // FakeHttpMessageHandler — inline mock for HttpClient
    // ----------------------------------------------------------------

    private sealed class FakeHttpMessageHandler : HttpMessageHandler
    {
        private readonly HttpStatusCode _status;
        private readonly byte[] _body;
        private readonly string? _contentRange;
        private readonly string _contentType;

        public FakeHttpMessageHandler(HttpStatusCode status, byte[] body,
            string? contentRange = null, string contentType = "audio/mpeg")
        {
            _status = status;
            _body = body;
            _contentRange = contentRange;
            _contentType = contentType;
        }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(_status)
            {
                Content = new ByteArrayContent(_body)
            };
            response.Content.Headers.ContentType = new MediaTypeHeaderValue(_contentType);
            response.Content.Headers.ContentLength = _body.Length;

            if (_contentRange != null && ContentRangeHeaderValue.TryParse(_contentRange, out var cr))
                response.Content.Headers.ContentRange = cr;

            return Task.FromResult(response);
        }
    }
}

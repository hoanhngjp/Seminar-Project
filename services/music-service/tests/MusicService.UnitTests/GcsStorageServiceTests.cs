using System.IO;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Google.Apis.Upload;
using Google.Cloud.Storage.V1;
using Moq;
using MusicService.Infrastructure.Services;

namespace MusicService.UnitTests;

public class GcsStorageServiceTests
{
    private readonly Mock<StorageClient> _clientMock = new();
    private const string Bucket = "test-bucket";
    private readonly GcsStorageService _sut;

    public GcsStorageServiceTests()
    {
        _sut = new GcsStorageService(_clientMock.Object, Bucket);
    }

    [Fact]
    public void BucketName_ReturnsConstructorValue()
    {
        _sut.BucketName.Should().Be(Bucket);
    }

    [Fact]
    public async Task UploadFileAsync_CallsGcsWithCorrectArgs_ReturnsKey()
    {
        var key = "songs/abc/audio.mp3";
        var content = new MemoryStream(new byte[100]);

        // Signature: UploadObjectAsync(bucket, objectName, contentType, source, options, cancellationToken, progress)
        _clientMock
            .Setup(c => c.UploadObjectAsync(
                Bucket, key, "audio/mpeg", content,
                It.IsAny<UploadObjectOptions>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<IProgress<IUploadProgress>>()))
            .ReturnsAsync(new Google.Apis.Storage.v1.Data.Object { Name = key });

        var result = await _sut.UploadFileAsync(key, content, "audio/mpeg");

        result.Should().Be(key);
        _clientMock.Verify(c => c.UploadObjectAsync(
            Bucket, key, "audio/mpeg", content,
            It.IsAny<UploadObjectOptions>(),
            It.IsAny<CancellationToken>(),
            It.IsAny<IProgress<IUploadProgress>>()), Times.Once);
    }

    [Fact]
    public async Task DeleteFileAsync_WhenObjectExists_DeletesAndReturnsTrue()
    {
        var key = "songs/abc/audio.mp3";

        _clientMock
            .Setup(c => c.DeleteObjectAsync(
                Bucket, key,
                It.IsAny<DeleteObjectOptions>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await _sut.DeleteFileAsync(key);

        result.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteFileAsync_WhenObjectNotFound_ReturnsFalse()
    {
        var key = "songs/missing/audio.mp3";

        _clientMock
            .Setup(c => c.DeleteObjectAsync(
                Bucket, key,
                It.IsAny<DeleteObjectOptions>(),
                It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Google.GoogleApiException("storage", "Not Found")
            {
                HttpStatusCode = HttpStatusCode.NotFound
            });

        var result = await _sut.DeleteFileAsync(key);

        result.Should().BeFalse();
    }
}

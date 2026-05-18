using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace MusicService.Application.Interfaces;

public interface IImageStorageService
{
    Task<string> UploadImageAsync(string folder, string publicId, Stream content, string contentType, CancellationToken cancellationToken = default);
}

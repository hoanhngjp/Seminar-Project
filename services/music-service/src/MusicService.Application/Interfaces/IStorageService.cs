using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace MusicService.Application.Interfaces;

public interface IStorageService
{
    Task<string> UploadFileAsync(string key, Stream content, string contentType, CancellationToken cancellationToken = default);
    Task<bool> DeleteFileAsync(string key, CancellationToken cancellationToken = default);
}

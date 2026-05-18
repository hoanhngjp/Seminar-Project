using System.IO;
using System.Threading;
using System.Threading.Tasks;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using MusicService.Application.Interfaces;

namespace MusicService.Infrastructure.Services;

public class CloudinaryImageService : IImageStorageService
{
    private readonly Cloudinary _cloudinary;

    public CloudinaryImageService(Cloudinary cloudinary)
    {
        _cloudinary = cloudinary;
    }

    public async Task<string> UploadImageAsync(string folder, string publicId, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        var uploadParams = new ImageUploadParams
        {
            File = new FileDescription(publicId, content),
            Folder = folder,
            PublicId = publicId,
            Overwrite = true,
            Transformation = new Transformation().Width(640).Height(640).Crop("fill").Quality("auto").FetchFormat("auto")
        };

        var result = await _cloudinary.UploadAsync(uploadParams, cancellationToken);

        if (result.Error != null)
            throw new InvalidOperationException($"Cloudinary upload failed: {result.Error.Message}");

        return result.SecureUrl.ToString();
    }
}

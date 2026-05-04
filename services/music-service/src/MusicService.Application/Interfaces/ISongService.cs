using System;
using System.Threading;
using System.Threading.Tasks;
using MusicService.Application.DTOs;
using MusicService.Domain.Models;

namespace MusicService.Application.Interfaces;

public interface ISongService
{
    Task<Song> UploadSongAsync(Guid userId, UploadSongDto dto, CancellationToken cancellationToken = default);
}

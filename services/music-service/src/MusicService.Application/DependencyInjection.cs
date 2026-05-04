using Microsoft.Extensions.DependencyInjection;
using MusicService.Application.Interfaces;
using MusicService.Application.Services;

namespace MusicService.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ISongService, SongService>();
        return services;
    }
}

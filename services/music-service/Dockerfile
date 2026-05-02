FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/MusicService.Api/MusicService.Api.csproj", "src/MusicService.Api/"]
COPY ["src/MusicService.Application/MusicService.Application.csproj", "src/MusicService.Application/"]
COPY ["src/MusicService.Infrastructure/MusicService.Infrastructure.csproj", "src/MusicService.Infrastructure/"]
COPY ["src/MusicService.Domain/MusicService.Domain.csproj", "src/MusicService.Domain/"]
RUN dotnet restore "src/MusicService.Api/MusicService.Api.csproj"
COPY . .
RUN dotnet build "src/MusicService.Api/MusicService.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/MusicService.Api/MusicService.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MusicService.Api.dll"]

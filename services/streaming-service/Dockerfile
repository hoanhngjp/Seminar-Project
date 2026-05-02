FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/StreamingService.Api/StreamingService.Api.csproj", "src/StreamingService.Api/"]
COPY ["src/StreamingService.Application/StreamingService.Application.csproj", "src/StreamingService.Application/"]
COPY ["src/StreamingService.Infrastructure/StreamingService.Infrastructure.csproj", "src/StreamingService.Infrastructure/"]
COPY ["src/StreamingService.Domain/StreamingService.Domain.csproj", "src/StreamingService.Domain/"]
RUN dotnet restore "src/StreamingService.Api/StreamingService.Api.csproj"
COPY . .
RUN dotnet build "src/StreamingService.Api/StreamingService.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/StreamingService.Api/StreamingService.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "StreamingService.Api.dll"]

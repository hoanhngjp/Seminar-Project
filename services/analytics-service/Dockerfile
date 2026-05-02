FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/AnalyticsService.Api/AnalyticsService.Api.csproj", "src/AnalyticsService.Api/"]
COPY ["src/AnalyticsService.Application/AnalyticsService.Application.csproj", "src/AnalyticsService.Application/"]
COPY ["src/AnalyticsService.Infrastructure/AnalyticsService.Infrastructure.csproj", "src/AnalyticsService.Infrastructure/"]
COPY ["src/AnalyticsService.Domain/AnalyticsService.Domain.csproj", "src/AnalyticsService.Domain/"]
RUN dotnet restore "src/AnalyticsService.Api/AnalyticsService.Api.csproj"
COPY . .
RUN dotnet build "src/AnalyticsService.Api/AnalyticsService.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/AnalyticsService.Api/AnalyticsService.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "AnalyticsService.Api.dll"]

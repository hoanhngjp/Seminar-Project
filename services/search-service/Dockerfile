FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/SearchService.Api/SearchService.Api.csproj", "src/SearchService.Api/"]
COPY ["src/SearchService.Application/SearchService.Application.csproj", "src/SearchService.Application/"]
COPY ["src/SearchService.Infrastructure/SearchService.Infrastructure.csproj", "src/SearchService.Infrastructure/"]
COPY ["src/SearchService.Domain/SearchService.Domain.csproj", "src/SearchService.Domain/"]
RUN dotnet restore "src/SearchService.Api/SearchService.Api.csproj"
COPY . .
RUN dotnet build "src/SearchService.Api/SearchService.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/SearchService.Api/SearchService.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "SearchService.Api.dll"]

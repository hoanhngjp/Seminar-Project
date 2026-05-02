FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/ListeningPartyService.Api/ListeningPartyService.Api.csproj", "src/ListeningPartyService.Api/"]
COPY ["src/ListeningPartyService.Application/ListeningPartyService.Application.csproj", "src/ListeningPartyService.Application/"]
COPY ["src/ListeningPartyService.Infrastructure/ListeningPartyService.Infrastructure.csproj", "src/ListeningPartyService.Infrastructure/"]
COPY ["src/ListeningPartyService.Domain/ListeningPartyService.Domain.csproj", "src/ListeningPartyService.Domain/"]
RUN dotnet restore "src/ListeningPartyService.Api/ListeningPartyService.Api.csproj"
COPY . .
RUN dotnet build "src/ListeningPartyService.Api/ListeningPartyService.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/ListeningPartyService.Api/ListeningPartyService.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ListeningPartyService.Api.dll"]

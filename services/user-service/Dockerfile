FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
# Build context = repo root so proto/ is accessible
WORKDIR /repo

# Restore — copy csproj files first for Docker layer cache
COPY services/user-service/src/UserService.Api/UserService.Api.csproj services/user-service/src/UserService.Api/
COPY services/user-service/src/UserService.Application/UserService.Application.csproj services/user-service/src/UserService.Application/
COPY services/user-service/src/UserService.Infrastructure/UserService.Infrastructure.csproj services/user-service/src/UserService.Infrastructure/
COPY services/user-service/src/UserService.Domain/UserService.Domain.csproj services/user-service/src/UserService.Domain/
COPY proto/ proto/
RUN dotnet restore services/user-service/src/UserService.Api/UserService.Api.csproj

# Copy rest and build
COPY services/user-service/ services/user-service/
RUN dotnet build services/user-service/src/UserService.Api/UserService.Api.csproj -c Release -o /app/build

FROM build AS publish
RUN dotnet publish services/user-service/src/UserService.Api/UserService.Api.csproj -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "UserService.Api.dll"]

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
# Build context = repo root so proto/ is accessible
WORKDIR /repo

# Restore — copy csproj files first for Docker layer cache
COPY services/auth-service/src/AuthService.Api/AuthService.Api.csproj services/auth-service/src/AuthService.Api/
COPY services/auth-service/src/AuthService.Application/AuthService.Application.csproj services/auth-service/src/AuthService.Application/
COPY services/auth-service/src/AuthService.Infrastructure/AuthService.Infrastructure.csproj services/auth-service/src/AuthService.Infrastructure/
COPY services/auth-service/src/AuthService.Domain/AuthService.Domain.csproj services/auth-service/src/AuthService.Domain/
COPY proto/ proto/
RUN dotnet restore services/auth-service/src/AuthService.Api/AuthService.Api.csproj

# Copy rest and build
COPY services/auth-service/ services/auth-service/
RUN dotnet build services/auth-service/src/AuthService.Api/AuthService.Api.csproj -c Release -o /app/build

FROM build AS publish
RUN dotnet publish services/auth-service/src/AuthService.Api/AuthService.Api.csproj -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "AuthService.Api.dll"]

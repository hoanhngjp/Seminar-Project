FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/ApiGateway.Api/ApiGateway.Api.csproj", "src/ApiGateway.Api/"]
COPY ["src/ApiGateway.Application/ApiGateway.Application.csproj", "src/ApiGateway.Application/"]
COPY ["src/ApiGateway.Infrastructure/ApiGateway.Infrastructure.csproj", "src/ApiGateway.Infrastructure/"]
COPY ["src/ApiGateway.Domain/ApiGateway.Domain.csproj", "src/ApiGateway.Domain/"]
RUN dotnet restore "src/ApiGateway.Api/ApiGateway.Api.csproj"
COPY . .
RUN dotnet build "src/ApiGateway.Api/ApiGateway.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "src/ApiGateway.Api/ApiGateway.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ApiGateway.Api.dll"]

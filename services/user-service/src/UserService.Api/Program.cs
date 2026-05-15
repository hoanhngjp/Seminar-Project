using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Prometheus;
using Serilog;
using Serilog.Formatting.Compact;
using UserService.Api.Auth;
using UserService.Api.Grpc;
using UserService.Api.Middleware;
using UserService.Infrastructure;
using UserService.Infrastructure.Data;

AppContext.SetSwitch("System.Net.Http.SocketsHttpHandler.Http2UnencryptedSupport", true);

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("service", "user-service")
    .WriteTo.Console(new CompactJsonFormatter())
    .CreateLogger();
builder.Host.UseSerilog();

builder.WebHost.ConfigureKestrel(options =>
{
    // Port 80: HTTP/1.1 for REST (API Gateway + health checks)
    options.ListenAnyIP(80, o => o.Protocols = HttpProtocols.Http1);
    // Port 5300: HTTP/2 cleartext (h2c) for gRPC — internal only
    options.ListenAnyIP(5300, o => o.Protocols = HttpProtocols.Http2);
});

// Trust X-User-Id / X-User-Role headers set by the API Gateway — no JWT re-validation
builder.Services.AddAuthentication(GatewayAuthHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, GatewayAuthHandler>(GatewayAuthHandler.SchemeName, _ => { });

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddGrpc();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpContextAccessor();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("ConnectionStrings:Postgres is required."))
    .AddRedis(
        builder.Configuration["Redis:ConnectionString"]
            ?? throw new InvalidOperationException("Redis:ConnectionString is required."));

var app = builder.Build();

// Run migrations + seed
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<UserDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    await DbInitializer.SeedAsync(db, logger);
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseRouting();
app.UseHttpMetrics();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapMetrics();
app.MapGrpcService<UserGrpcService>();
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = HealthChecks.UI.Client.UIResponseWriter.WriteHealthCheckUIResponse
});

app.Run();

public partial class Program { } // for integration tests

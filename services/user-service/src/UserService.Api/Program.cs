using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using Serilog.Formatting.Compact;
using System.Text;
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
    options.ListenAnyIP(80, o => o.Protocols = HttpProtocols.Http1AndHttp2);
});

var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? builder.Configuration["Jwt:Secret"]
    ?? "fallback-secret-for-development-and-testing-only";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
            ValidAlgorithms = ["HS256"]
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddGrpc();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpContextAccessor();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddHealthChecks()
    .AddNpgSql(
        builder.Configuration["USER_DB_CONNECTION_STRING"]
            ?? builder.Configuration.GetConnectionString("Postgres")
            ?? "Host=localhost;Database=test")
    .AddRedis(
        builder.Configuration["REDIS_CONNECTION_STRING"]
            ?? builder.Configuration["Redis:ConnectionString"]
            ?? "localhost:6379");

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
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGrpcService<UserGrpcService>();
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = HealthChecks.UI.Client.UIResponseWriter.WriteHealthCheckUIResponse
});

app.Run();

public partial class Program { } // for integration tests

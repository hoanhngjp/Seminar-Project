using NotificationService.Api.Extensions;
using NotificationService.Api.Middleware;
using NotificationService.Infrastructure;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

// Kafka consumer may throw on startup if broker is not yet ready.
// StopHost (default) would kill the HTTP server — use Ignore so HTTP stays up.
builder.Services.Configure<HostOptions>(o =>
    o.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

builder.Services.AddGatewayAuth();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseRouting();
app.UseHttpMetrics();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapMetrics();

app.Run();

// Expose Program for integration tests
public partial class Program { }

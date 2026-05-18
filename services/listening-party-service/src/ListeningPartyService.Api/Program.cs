using ListeningPartyService.Api.Extensions;
using ListeningPartyService.Api.Hubs;
using ListeningPartyService.Api.Middleware;
using ListeningPartyService.Infrastructure;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSignalR(options =>
{
    // Ping every 15s; disconnect client if no response within 60s.
    // Client mirrors these values (serverTimeoutInMilliseconds=60000, keepAliveIntervalInMilliseconds=15000).
    // Previous 30s/40s caused spurious timeouts through the YARP proxy.
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
});
builder.Services.AddGatewayAuth();
builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseWebSockets();
app.UseRouting();
app.UseHttpMetrics();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapMetrics();
app.MapHub<PartyHub>("/hubs/party");

app.Run();

// Expose for WebApplicationFactory in integration tests
public partial class Program { }

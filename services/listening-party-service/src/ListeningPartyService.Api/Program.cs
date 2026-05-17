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
    // Built-in keepalive: server pings every 30s, disconnects if no pong within 40s
    options.KeepAliveInterval = TimeSpan.FromSeconds(30);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(40);
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

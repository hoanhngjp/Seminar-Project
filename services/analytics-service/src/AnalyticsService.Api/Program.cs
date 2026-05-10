using AnalyticsService.Api.Auth;
using AnalyticsService.Api.Middleware;
using AnalyticsService.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();

builder.Services.AddAuthentication(GatewayAuthHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, GatewayAuthHandler>(GatewayAuthHandler.SchemeName, _ => { });

builder.Services.AddAuthorization();

builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseRouting();
app.UseHttpMetrics();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapMetrics();

app.Run();

// Required for WebApplicationFactory in integration tests
public partial class Program { }

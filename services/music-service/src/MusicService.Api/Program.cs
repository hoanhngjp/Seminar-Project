using System;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.RateLimiting;
using MusicService.Api.Auth;
using MusicService.Api.Middleware;
using MusicService.Application;
using MusicService.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplication();

// Auth: trust X-User-Id / X-User-Role headers set by API Gateway
builder.Services.AddAuthentication(GatewayAuthHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, GatewayAuthHandler>(GatewayAuthHandler.SchemeName, _ => { });
builder.Services.AddAuthorization();

// Rate Limiting — POST /music/songs: 10 req/min per IP
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("UploadLimit", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 10;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = 429;
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Apply rate limit only to upload endpoint
app.MapControllers();
app.MapControllerRoute(
    name: "upload",
    pattern: "api/v1/music/songs",
    defaults: new { controller = "Songs", action = "UploadSong" })
   .RequireRateLimiting("UploadLimit");

app.Run();

// Needed for WebApplicationFactory in integration tests
public partial class Program { }

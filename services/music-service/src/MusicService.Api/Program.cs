using Microsoft.AspNetCore.RateLimiting;
using MusicService.Api.Middleware;
using MusicService.Application;
using MusicService.Infrastructure;
using System.Threading.RateLimiting;
using System;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApplication();

// Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("UploadLimit", opt =>
    {
        opt.Window = TimeSpan.FromMinutes(1);
        opt.PermitLimit = 10;
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 2;
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
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers().RequireRateLimiting("UploadLimit");

app.Run();

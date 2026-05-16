using ApiGateway.Api.Middleware;
using ApiGateway.Infrastructure;
using Prometheus;
using Yarp.ReverseProxy.Transforms;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var origins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? ["http://localhost:3000"];
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(ctx =>
    {
        // YARP builds HttpRequestMessage before middleware-added headers propagate.
        // Explicitly copy gateway identity headers to every proxied request.
        ctx.AddRequestTransform(transform =>
        {
            var headers = transform.HttpContext.Request.Headers;

            if (headers.TryGetValue("X-User-Id", out var userId) && !string.IsNullOrEmpty(userId))
            {
                transform.ProxyRequest.Headers.Remove("X-User-Id");
                transform.ProxyRequest.Headers.TryAddWithoutValidation("X-User-Id", (string?)userId);
            }

            if (headers.TryGetValue("X-User-Role", out var userRole) && !string.IsNullOrEmpty(userRole))
            {
                transform.ProxyRequest.Headers.Remove("X-User-Role");
                transform.ProxyRequest.Headers.TryAddWithoutValidation("X-User-Role", (string?)userRole);
            }

            return ValueTask.CompletedTask;
        });
    });

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");

// Middleware order matters:
// 1. CorrelationId — attach before anything logs
// 2. CircuitBreaker — wrap downstream timeout
// 3. RateLimiting — reject before JWT parsing
// 4. JwtValidation — authenticate
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<CircuitBreakerMiddleware>();
app.UseMiddleware<RateLimitingMiddleware>();
app.UseMiddleware<JwtValidationMiddleware>();

app.UseRouting();
app.UseHttpMetrics();
app.UseAuthorization();
app.MapControllers();
app.MapMetrics();
app.MapReverseProxy();

app.Run();

public partial class Program { }

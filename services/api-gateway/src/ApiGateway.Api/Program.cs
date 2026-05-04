using ApiGateway.Api.Middleware;
using ApiGateway.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHttpContextAccessor();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

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
app.UseAuthorization();
app.MapControllers();
app.MapReverseProxy();

app.Run();

public partial class Program { }

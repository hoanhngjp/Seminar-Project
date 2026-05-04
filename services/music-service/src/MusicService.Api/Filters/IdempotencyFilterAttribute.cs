using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using StackExchange.Redis;
using System;
using System.Threading.Tasks;

namespace MusicService.Api.Filters;

[AttributeUsage(AttributeTargets.Method)]
public class IdempotencyFilterAttribute : ActionFilterAttribute
{
    public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var idempotencyKey = context.HttpContext.Request.Headers["Idempotency-Key"].ToString();
        if (string.IsNullOrEmpty(idempotencyKey))
        {
            context.Result = new BadRequestObjectResult(new { success = false, error = "Idempotency-Key header is required" });
            return;
        }

        var redis = context.HttpContext.RequestServices.GetService(typeof(IConnectionMultiplexer)) as IConnectionMultiplexer;
        if (redis == null)
        {
            await next();
            return;
        }

        var db = redis.GetDatabase();
        var cacheKey = $"idempotency:music:{idempotencyKey}";
        
        // Use SetNx (StringSetAsync with When.NotExists)
        var isFirst = await db.StringSetAsync(cacheKey, "processing", TimeSpan.FromMinutes(10), When.NotExists);

        if (!isFirst)
        {
            context.Result = new ConflictObjectResult(new { success = false, error = "IDEMPOTENCY_CONFLICT", message = "Request already processed or is processing." });
            return;
        }

        var executedContext = await next();

        // If it failed, allow retry
        if (executedContext.Exception != null || (executedContext.Result is ObjectResult objectResult && objectResult.StatusCode >= 400 && objectResult.StatusCode != 409))
        {
            await db.KeyDeleteAsync(cacheKey);
        }
        else
        {
            // Extend TTL to 24h
            await db.KeyExpireAsync(cacheKey, TimeSpan.FromHours(24));
        }
    }
}

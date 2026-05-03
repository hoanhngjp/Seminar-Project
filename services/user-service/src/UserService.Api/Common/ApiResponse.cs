namespace UserService.Api.Common;

public class ApiResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public ApiMeta Meta { get; init; } = null!;
    public ApiError? Error { get; init; }

    public static ApiResponse<T> Ok(T data, HttpContext ctx, string? cache = null) => new()
    {
        Success = true, Data = data, Meta = ApiMeta.From(ctx, cache), Error = null
    };

    public static ApiResponse<T> Fail(string code, string message, HttpContext ctx) => new()
    {
        Success = false, Data = default, Meta = ApiMeta.From(ctx),
        Error = new ApiError(code, message)
    };
}

public class ApiMeta
{
    public string ApiVersion { get; init; } = "v1";
    public string RequestId { get; init; } = string.Empty;
    public string Timestamp { get; init; } = string.Empty;
    public string? Cache { get; init; }

    public static ApiMeta From(HttpContext ctx, string? cache = null) => new()
    {
        RequestId = ctx.Items["CorrelationId"]?.ToString() ?? Guid.NewGuid().ToString(),
        Timestamp = DateTime.UtcNow.ToString("O"),
        Cache = cache
    };
}

public record ApiError(string Code, string Message);

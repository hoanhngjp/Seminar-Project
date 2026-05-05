namespace SearchService.Api.Models;

public record ApiError(string Code, string Message);

public class ApiMeta
{
    public string ApiVersion { get; init; } = "v1";
    public string RequestId { get; init; } = Guid.NewGuid().ToString();
    public string Timestamp { get; init; } = DateTimeOffset.UtcNow.ToString("O");
    public string? Cache { get; init; }
}

public class ApiResponse<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public ApiMeta Meta { get; init; } = new();
    public ApiError? Error { get; init; }

    public static ApiResponse<T> Ok(T data, string? requestId = null, string? cache = null) => new()
    {
        Success = true,
        Data = data,
        Meta = new ApiMeta { RequestId = requestId ?? Guid.NewGuid().ToString(), Cache = cache },
        Error = null
    };

    public static ApiResponse<T> Fail(string code, string message, string? requestId = null) => new()
    {
        Success = false,
        Data = default,
        Meta = new ApiMeta { RequestId = requestId ?? Guid.NewGuid().ToString() },
        Error = new ApiError(code, message)
    };
}

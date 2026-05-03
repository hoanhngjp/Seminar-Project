using Microsoft.AspNetCore.Http;
using System.Text.Json.Serialization;

namespace AuthService.Application.DTOs;

public class ApiError
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class ApiMeta
{
    public string ApiVersion { get; set; } = "v1";
    public string RequestId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Cache { get; set; }
}

public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public ApiMeta Meta { get; set; } = new ApiMeta();
    public ApiError? Error { get; set; }

    public static ApiResponse<T> CreateSuccess(T data, HttpContext httpContext, string? cache = null)
    {
        return new ApiResponse<T>
        {
            Success = true,
            Data = data,
            Meta = new ApiMeta
            {
                RequestId = httpContext.TraceIdentifier,
                Cache = cache
            }
        };
    }

    public static ApiResponse<T> CreateFail(string code, string message, HttpContext httpContext)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Data = default,
            Meta = new ApiMeta
            {
                RequestId = httpContext.TraceIdentifier
            },
            Error = new ApiError { Code = code, Message = message }
        };
    }
}

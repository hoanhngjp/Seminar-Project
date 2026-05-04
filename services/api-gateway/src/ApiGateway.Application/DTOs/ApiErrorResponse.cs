using System.Text.Json.Serialization;

namespace ApiGateway.Application.DTOs;

public class GatewayApiError
{
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

public class GatewayApiMeta
{
    public string ApiVersion { get; set; } = "v1";
    public string RequestId { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class GatewayApiErrorResponse
{
    public bool Success => false;
    public object? Data => null;
    public GatewayApiMeta Meta { get; set; } = new();
    public GatewayApiError Error { get; set; } = new();
}

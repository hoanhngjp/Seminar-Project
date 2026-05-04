using System.Text.Json;
using ApiGateway.Application.DTOs;

namespace ApiGateway.Api.Common;

public static class ApiErrorWriter
{
    private static readonly JsonSerializerOptions Options = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static async Task WriteAsync(HttpContext context, int statusCode, string code, string message)
    {
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var response = new GatewayApiErrorResponse
        {
            Meta = new GatewayApiMeta
            {
                RequestId = context.TraceIdentifier
            },
            Error = new GatewayApiError { Code = code, Message = message }
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response, Options));
    }
}

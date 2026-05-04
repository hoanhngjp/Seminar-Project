namespace ApiGateway.Application.Interfaces;

public record JwtValidationResult(bool IsValid, string? Code, string? UserId, string? Role, string? Jti);

public interface IJwtValidationService
{
    Task<JwtValidationResult> ValidateAsync(string token, CancellationToken ct = default);
}

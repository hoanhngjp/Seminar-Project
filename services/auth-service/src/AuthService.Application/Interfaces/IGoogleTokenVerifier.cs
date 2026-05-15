namespace AuthService.Application.Interfaces;

public record GooglePayload(
    string Email,
    string Name,
    string? PictureUrl,
    string Subject
);

public interface IGoogleTokenVerifier
{
    Task<GooglePayload> VerifyAsync(string idToken, CancellationToken ct);
}

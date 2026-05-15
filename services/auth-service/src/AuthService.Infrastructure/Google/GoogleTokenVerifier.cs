using AuthService.Application.Interfaces;
using Google.Apis.Auth;

namespace AuthService.Infrastructure.Google;

public class GoogleTokenVerifier : IGoogleTokenVerifier
{
    private readonly string _clientId;

    public GoogleTokenVerifier()
    {
        _clientId = Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID")
            ?? throw new InvalidOperationException("GOOGLE_CLIENT_ID environment variable is required.");
    }

    public async Task<GooglePayload> VerifyAsync(string idToken, CancellationToken ct)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = new[] { _clientId }
        };

        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);

        return new GooglePayload(
            Email: payload.Email,
            Name: payload.Name ?? payload.Email,
            PictureUrl: payload.Picture,
            Subject: payload.Subject
        );
    }
}

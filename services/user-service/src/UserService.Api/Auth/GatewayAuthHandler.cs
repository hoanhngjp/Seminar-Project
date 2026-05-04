using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace UserService.Api.Auth;

/// <summary>
/// Trusts X-User-Id and X-User-Role headers set by the API Gateway after JWT validation.
/// Downstream services do not re-validate the JWT — the gateway is the single auth boundary.
/// </summary>
public class GatewayAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "GatewayAuth";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userId = Request.Headers["X-User-Id"].FirstOrDefault();
        var role = Request.Headers["X-User-Role"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(userId))
            return Task.FromResult(AuthenticateResult.Fail("Missing X-User-Id header from gateway."));

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim(ClaimTypes.Role, role ?? "Listener")
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

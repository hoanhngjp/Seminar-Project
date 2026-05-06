using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace ListeningPartyService.Api.Extensions;

public class GatewayAuthHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder) : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-User-Id", out var userIdHeader) ||
            string.IsNullOrWhiteSpace(userIdHeader))
            return Task.FromResult(AuthenticateResult.Fail("Missing X-User-Id header"));

        if (!Guid.TryParse(userIdHeader, out _))
            return Task.FromResult(AuthenticateResult.Fail("Invalid X-User-Id header"));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userIdHeader.ToString())
        };

        if (Request.Headers.TryGetValue("X-User-Role", out var roleHeader) &&
            !string.IsNullOrWhiteSpace(roleHeader))
        {
            claims.Add(new Claim(ClaimTypes.Role, roleHeader.ToString()));
        }

        var identity = new ClaimsIdentity(claims, "GatewayAuth");
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, "GatewayAuth");

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}

namespace AuthService.Application.Interfaces;

public interface IUserGrpcClient
{
    Task<(string UserId, string Role)> VerifyCredentialsAsync(string username, string password, CancellationToken ct);
}

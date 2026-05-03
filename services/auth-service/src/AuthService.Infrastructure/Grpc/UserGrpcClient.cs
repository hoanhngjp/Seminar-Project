using AuthService.Application.Interfaces;
using AuthService.Domain.Exceptions;
using Grpc.Core;
using SmartMusic.User.Grpc;

namespace AuthService.Infrastructure.Grpc;

public class UserGrpcClient(UserService.UserServiceClient client) : IUserGrpcClient
{
    public async Task<(string UserId, string Role)> VerifyCredentialsAsync(string username, string password, CancellationToken ct)
    {
        try
        {
            var request = new VerifyCredentialsRequest
            {
                Username = username,
                Password = password
            };

            var response = await client.VerifyCredentialsAsync(request, cancellationToken: ct);
            return (response.UserId, response.Role.ToString());
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.InvalidArgument)
        {
            throw new UnauthorizedException("AUTH_INVALID_CREDENTIALS", "Invalid credentials.");
        }
        catch (RpcException ex)
        {
            throw new Exception($"gRPC call failed: {ex.Status.Detail}", ex);
        }
    }
}

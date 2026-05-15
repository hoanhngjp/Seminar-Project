using AuthService.Application.DTOs;
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

    public async Task<RegisterResponse> CreateUserAsync(RegisterRequest request, CancellationToken ct)
    {
        var grpcRole = request.Role switch
        {
            "Creator" => Role.Creator,
            _         => Role.Listener
        };

        try
        {
            var response = await client.CreateUserAsync(new CreateUserRequest
            {
                Email       = request.Email,
                Password    = request.Password,
                DisplayName = request.DisplayName,
                Role        = grpcRole
            }, cancellationToken: ct);

            return new RegisterResponse
            {
                UserId      = response.UserId,
                Email       = response.Email,
                DisplayName = response.DisplayName,
                Role        = response.Role == Role.Creator ? "Creator" : "Listener"
            };
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
        {
            // TODO: propose USER_ALREADY_EXISTS error code to team
            throw new ValidationException("Email is already registered.");
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.InvalidArgument)
        {
            throw new ValidationException(ex.Status.Detail);
        }
        catch (RpcException ex)
        {
            throw new Exception($"gRPC CreateUser failed: {ex.Status.Detail}", ex);
        }
    }

    public async Task<(string UserId, string Role)?> GetUserByEmailAsync(string email, CancellationToken ct)
    {
        try
        {
            var response = await client.GetUserByEmailAsync(
                new GetUserByEmailRequest { Email = email }, cancellationToken: ct);
            return (response.UserId, response.Role.ToString());
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.NotFound)
        {
            return null;
        }
        catch (RpcException ex)
        {
            throw new Exception($"gRPC GetUserByEmail failed: {ex.Status.Detail}", ex);
        }
    }

    public async Task<RegisterResponse> CreateOAuthUserAsync(
        string email, string displayName, string? pictureUrl, CancellationToken ct)
    {
        try
        {
            var response = await client.CreateUserAsync(new CreateUserRequest
            {
                Email       = email,
                Password    = string.Empty,
                DisplayName = displayName,
                Role        = Role.Listener,
                IsOauth     = true,
                PictureUrl  = pictureUrl ?? string.Empty
            }, cancellationToken: ct);

            return new RegisterResponse
            {
                UserId      = response.UserId,
                Email       = response.Email,
                DisplayName = response.DisplayName,
                Role        = response.Role == Role.Creator ? "Creator" : "Listener"
            };
        }
        catch (RpcException ex) when (ex.StatusCode == StatusCode.AlreadyExists)
        {
            // Race condition: another request already created the user — look up instead
            var existing = await GetUserByEmailAsync(email, ct);
            if (existing.HasValue)
                return new RegisterResponse { UserId = existing.Value.UserId, Email = email, DisplayName = displayName, Role = existing.Value.Role };
            throw new Exception($"OAuth user creation conflict could not be resolved for {email}.");
        }
        catch (RpcException ex)
        {
            throw new Exception($"gRPC CreateOAuthUser failed: {ex.Status.Detail}", ex);
        }
    }
}

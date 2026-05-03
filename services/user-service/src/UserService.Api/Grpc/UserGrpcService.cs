using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.Extensions.Logging;
using SmartMusic.User.Grpc;
using UserService.Application.Interfaces;
using UserService.Domain.Models;

namespace UserService.Api.Grpc;

public class UserGrpcService(
    IUserRepository userRepo,
    ILogger<UserGrpcService> logger) : SmartMusic.User.Grpc.UserService.UserServiceBase
{
    public override async Task<GetUserProfileResponse> GetUserProfile(
        GetUserProfileRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.UserId, out var userId))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "user_id must be a valid UUID."));

        logger.LogInformation("gRPC GetUserProfile called. UserId={UserId}", userId);

        User? user;
        try
        {
            user = await userRepo.GetByIdAsync(userId, context.CancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not RpcException)
        {
            logger.LogError(ex, "DB unavailable during GetUserProfile. UserId={UserId}", userId);
            throw new RpcException(new Status(StatusCode.Unavailable, "User Service database is unreachable."));
        }

        if (user is null)
            throw new RpcException(new Status(StatusCode.NotFound, $"User {userId} not found."));

        var role = user.Role switch
        {
            "Creator" => Role.Creator,
            "Admin" => Role.Admin,
            _ => Role.Listener
        };

        return new GetUserProfileResponse
        {
            UserId = user.Id.ToString(),
            DisplayName = user.DisplayName,
            Email = user.Email,
            Role = role,
            IsActive = user.IsActive,
            OnboardingCompleted = true, // simplified: assume completed if user exists
            CreatedAt = Timestamp.FromDateTime(DateTime.SpecifyKind(user.CreatedAt, DateTimeKind.Utc))
        };
    }

    public override async Task<VerifyCredentialsResponse> VerifyCredentials(
        VerifyCredentialsRequest request, ServerCallContext context)
    {
        logger.LogInformation("gRPC VerifyCredentials called for username/email: {Username}", request.Username);

        User? user;
        try
        {
            user = await userRepo.GetByUsernameOrEmailAsync(request.Username, context.CancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not RpcException)
        {
            logger.LogError(ex, "DB unavailable during VerifyCredentials.");
            throw new RpcException(new Status(StatusCode.Unavailable, "User Service database is unreachable."));
        }

        if (user is null || !user.IsActive)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid credentials or inactive account."));
        }

        bool isPasswordValid = false;
        try
        {
            isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Password hash verification failed format error.");
        }

        if (!isPasswordValid)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Invalid credentials."));
        }

        var role = user.Role switch
        {
            "Creator" => Role.Creator,
            "Admin" => Role.Admin,
            _ => Role.Listener
        };

        return new VerifyCredentialsResponse
        {
            UserId = user.Id.ToString(),
            Role = role
        };
    }
}

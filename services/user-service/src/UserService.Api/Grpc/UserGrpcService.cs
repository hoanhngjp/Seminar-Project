using Google.Protobuf.WellKnownTypes;
using Grpc.Core;
using Microsoft.Extensions.Logging;
using SmartMusic.User.Grpc;
using UserService.Application.Interfaces;
using UserService.Domain.Models;
using BC = BCrypt.Net.BCrypt;

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

        // OAuth users have no password — block password-based login for them
        if (string.IsNullOrEmpty(user.PasswordHash))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "This account uses Google sign-in."));
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

    public override async Task<GetUserByEmailResponse> GetUserByEmail(
        GetUserByEmailRequest request, ServerCallContext context)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            throw new RpcException(new Status(StatusCode.InvalidArgument, "email is required."));

        logger.LogInformation("gRPC GetUserByEmail called. Email={Email}", request.Email);

        User? user;
        try
        {
            user = await userRepo.GetByEmailAsync(request.Email, context.CancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not RpcException)
        {
            logger.LogError(ex, "DB unavailable during GetUserByEmail.");
            throw new RpcException(new Status(StatusCode.Unavailable, "User Service database is unreachable."));
        }

        if (user is null)
            throw new RpcException(new Status(StatusCode.NotFound, $"User with email not found."));

        var role = user.Role switch
        {
            "Creator" => Role.Creator,
            "Admin"   => Role.Admin,
            _         => Role.Listener
        };

        return new GetUserByEmailResponse
        {
            UserId      = user.Id.ToString(),
            Email       = user.Email,
            DisplayName = user.DisplayName,
            Role        = role,
            IsActive    = user.IsActive
        };
    }

    public override async Task<CreateUserResponse> CreateUser(
        CreateUserRequest request, ServerCallContext context)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.DisplayName))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "email and display_name are required."));
        }

        // Password required only for non-OAuth registrations
        if (!request.IsOauth)
        {
            if (string.IsNullOrWhiteSpace(request.Password))
                throw new RpcException(new Status(StatusCode.InvalidArgument, "password is required."));
            if (request.Password.Length < 8)
                throw new RpcException(new Status(StatusCode.InvalidArgument, "Password must be at least 8 characters."));
        }

        bool exists;
        try
        {
            exists = await userRepo.ExistsByEmailAsync(request.Email, context.CancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not RpcException)
        {
            logger.LogError(ex, "DB unavailable during CreateUser.");
            throw new RpcException(new Status(StatusCode.Unavailable, "User Service database is unreachable."));
        }

        if (exists)
            throw new RpcException(new Status(StatusCode.AlreadyExists, "Email already registered."));

        var roleStr = request.Role switch
        {
            Role.Creator => "Creator",
            Role.Admin   => "Listener", // Admin cannot be created via register
            _            => "Listener"
        };

        var user = new User
        {
            Id           = Guid.NewGuid(),
            Email        = request.Email,
            Username     = request.Email,
            DisplayName  = request.DisplayName,
            PasswordHash = request.IsOauth ? null : BC.HashPassword(request.Password),
            AvatarUrl    = request.IsOauth && !string.IsNullOrEmpty(request.PictureUrl)
                               ? request.PictureUrl : null,
            Role         = roleStr,
            IsActive     = true,
            CreatedAt    = DateTime.UtcNow,
            UpdatedAt    = DateTime.UtcNow
        };

        try
        {
            await userRepo.CreateAsync(user, context.CancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex) when (ex is not RpcException)
        {
            logger.LogError(ex, "DB error during CreateUser for email: {Email}", user.Email);
            throw new RpcException(new Status(StatusCode.Unavailable, "Failed to create user."));
        }

        var grpcRole = roleStr == "Creator" ? Role.Creator : Role.Listener;

        logger.LogInformation("User created via gRPC. UserId={UserId} Role={Role}", user.Id, roleStr);

        return new CreateUserResponse
        {
            UserId      = user.Id.ToString(),
            Email       = user.Email,
            DisplayName = user.DisplayName,
            Role        = grpcRole
        };
    }
}

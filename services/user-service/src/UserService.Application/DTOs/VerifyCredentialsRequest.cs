namespace UserService.Application.DTOs;

public record VerifyCredentialsRequest(string Email, string Password);

public record VerifyCredentialsResult(Guid UserId, string Role, bool IsActive, string DisplayName);

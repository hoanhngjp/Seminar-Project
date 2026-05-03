namespace AuthService.Domain.Exceptions;

public abstract class DomainException(string errorCode, string message, int httpStatusCode)
    : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
    public int HttpStatusCode { get; } = httpStatusCode;
}

public class UnauthorizedException(string code, string message)
    : DomainException(code, message, 401);

public class ForbiddenException(string code, string message)
    : DomainException(code, message, 403);

public class ValidationException(string message)
    : DomainException("VALIDATION_ERROR", message, 400);

public class ConflictException(string code, string message)
    : DomainException(code, message, 409);

public class AccountLockedException()
    : DomainException("ACCOUNT_LOCKED", "Account locked due to too many failed login attempts. Please try again later.", 423);

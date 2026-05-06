namespace NotificationService.Domain.Exceptions;

public abstract class DomainException(string errorCode, string message, int httpStatusCode)
    : Exception(message)
{
    public string ErrorCode { get; } = errorCode;
    public int HttpStatusCode { get; } = httpStatusCode;
}

public class NotFoundException(string resource)
    : DomainException($"{resource.ToUpperInvariant()}_NOT_FOUND", $"{resource} not found.", 404);

public class ValidationException(string message)
    : DomainException("VALIDATION_ERROR", message, 400);

public class IdempotencyConflictException()
    : DomainException("IDEMPOTENCY_CONFLICT", "Duplicate request detected.", 409);

public class UnauthorizedException(string message = "Unauthorized.")
    : DomainException("UNAUTHORIZED", message, 401);

public class ForbiddenException(string message = "Access denied.")
    : DomainException("FORBIDDEN", message, 403);

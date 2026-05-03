namespace UserService.Domain.Exceptions;

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

public class UnauthorizedException(string code = "UNAUTHORIZED", string message = "Unauthorized.")
    : DomainException(code, message, 401);

public class ForbiddenException(string code = "FORBIDDEN", string message = "Access denied.")
    : DomainException(code, message, 403);

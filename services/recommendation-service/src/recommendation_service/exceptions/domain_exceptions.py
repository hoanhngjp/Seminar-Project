class DomainException(Exception):
    def __init__(self, error_code: str, message: str, http_status: int):
        self.error_code = error_code
        self.message = message
        self.http_status = http_status
        super().__init__(message)


class NotFoundException(DomainException):
    def __init__(self, resource: str):
        super().__init__(f"{resource.upper()}_NOT_FOUND", f"{resource} not found.", 404)


class ValidationException(DomainException):
    def __init__(self, message: str):
        super().__init__("VALIDATION_ERROR", message, 400)


class UnauthorizedException(DomainException):
    def __init__(self):
        super().__init__("UNAUTHORIZED", "Authentication required.", 401)


class ServiceUnavailableException(DomainException):
    def __init__(self, detail: str = "Service temporarily unavailable."):
        super().__init__("SERVICE_UNAVAILABLE", detail, 503)

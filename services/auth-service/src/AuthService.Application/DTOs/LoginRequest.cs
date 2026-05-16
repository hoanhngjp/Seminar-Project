namespace AuthService.Application.DTOs;

public class LoginRequest
{
    // API Design V2 uses "username" field (accepts email format)
    public string Username { get; set; } = string.Empty;
    // Also accept "email" for backward compat
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    public string EffectiveEmail => !string.IsNullOrEmpty(Username) ? Username : Email;
}

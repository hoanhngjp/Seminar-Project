namespace AuthService.Domain.Models;

public class TokenBlacklist
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid Jti { get; set; }
    public Guid UserId { get; set; }
    public string Reason { get; set; } = "rotated";
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

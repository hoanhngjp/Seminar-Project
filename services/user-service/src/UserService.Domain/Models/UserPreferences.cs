namespace UserService.Domain.Models;

public class UserPreferences
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public List<string> PreferredGenres { get; set; } = [];
    public List<string> PreferredArtists { get; set; } = [];
    public string AudioQuality { get; set; } = "standard";
    public bool Autoplay { get; set; } = true;
    public bool ExplicitContent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}

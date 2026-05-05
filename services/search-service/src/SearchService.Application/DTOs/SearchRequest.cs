using System.ComponentModel.DataAnnotations;

namespace SearchService.Application.DTOs;

public record SearchRequest(
    [Required] string Q,
    string Type = "all",
    int Limit = 10,
    string? Cursor = null
);

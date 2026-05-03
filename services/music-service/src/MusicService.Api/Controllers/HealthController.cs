using Microsoft.AspNetCore.Mvc;

namespace MusicService.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        status = "healthy",
        service = "music-service",
        version = "1.0.0",
        timestamp = DateTime.UtcNow
    });
}

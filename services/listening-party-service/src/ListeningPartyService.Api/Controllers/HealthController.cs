using Microsoft.AspNetCore.Mvc;

namespace ListeningPartyService.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        status = "healthy",
        service = "listening-party-service",
        version = "1.0.0",
        timestamp = DateTime.UtcNow
    });
}

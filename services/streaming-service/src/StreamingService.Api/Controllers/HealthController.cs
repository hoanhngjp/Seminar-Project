using Microsoft.AspNetCore.Mvc;

namespace StreamingService.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        status = "healthy",
        service = "streaming-service",
        version = "1.0.0",
        timestamp = DateTime.UtcNow
    });
}

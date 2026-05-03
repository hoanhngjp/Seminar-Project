using Microsoft.AspNetCore.Mvc;

namespace AnalyticsService.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new
    {
        status = "healthy",
        service = "analytics-service",
        version = "1.0.0",
        timestamp = DateTime.UtcNow
    });
}

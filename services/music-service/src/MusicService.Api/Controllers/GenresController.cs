using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using MusicService.Api.Models;
using MusicService.Application.Interfaces;

namespace MusicService.Api.Controllers;

[ApiController]
[Route("api/v1/music/[controller]")]
public class GenresController : ControllerBase
{
    private readonly IMusicRepository _repository;

    public GenresController(IMusicRepository repository)
    {
        _repository = repository;
    }

    // ----------------------------------------------------------------
    // Contract-First Checklist — GET /api/v1/music/genres
    // [1] GET /api/v1/music/genres
    // [2] —
    // [3] 200: { success, data: [{ id, name, slug }], meta }
    // [4] 500 INTERNAL_ERROR
    // [5] No auth required (public lookup)
    // [6] 200ms
    // [7] YES
    // [8] Returns all genres ordered by name
    // ----------------------------------------------------------------

    [HttpGet]
    public async Task<IActionResult> GetGenres()
    {
        var requestId = HttpContext.Items["X-Correlation-Id"]?.ToString() ?? Guid.NewGuid().ToString();

        try
        {
            var genres = await _repository.GetAllGenresAsync(HttpContext.RequestAborted);
            var data = genres.Select(g => new { id = g.Id, name = g.Name, slug = g.Slug });
            return Ok(ApiResponse<object>.Ok(data, requestId));
        }
        catch (Exception)
        {
            return StatusCode(500, ApiResponse<object>.Fail("INTERNAL_ERROR", "An unexpected error occurred.", requestId));
        }
    }
}

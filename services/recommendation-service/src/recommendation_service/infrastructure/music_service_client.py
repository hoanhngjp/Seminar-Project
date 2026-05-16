"""
HTTP client gọi Music Service internal batch endpoint.
GET {base_url}/internal/songs/batch?ids=id1,id2,...
Timeout: 200ms (theo latency budget API Design V2).
Failure → trả list rỗng (graceful degradation, không làm crash Rule Engine).
"""
import logging
from dataclasses import dataclass

import httpx

from recommendation_service.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class MusicBatchSong:
    id: str
    title: str
    artist_name: str
    genre_id: str | None
    mood_tags: list[str]
    cover_image_url: str = ""


class MusicServiceClient:
    def __init__(self, http_client: httpx.AsyncClient):
        self._client = http_client
        self._base_url = settings.music_service_base_url
        self._timeout = settings.music_service_timeout_ms / 1000  # convert ms → seconds

    async def get_songs_batch(self, song_ids: list[str]) -> list[MusicBatchSong]:
        """
        Fetch song metadata for a list of IDs from Music Service.
        Returns only found songs — missing IDs are silently skipped (Music Service contract).
        Returns [] on any error to allow Rule Engine fallback.
        """
        if not song_ids:
            return []

        ids_param = ",".join(song_ids)
        url = f"{self._base_url}/internal/songs/batch"

        try:
            resp = await self._client.get(
                url,
                params={"ids": ids_param},
                timeout=self._timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            songs = data.get("songs", [])
            return [
                MusicBatchSong(
                    id=str(s.get("id", "")),
                    title=s.get("title", ""),
                    artist_name=s.get("artistName", ""),
                    genre_id=str(s["genreId"]) if s.get("genreId") else None,
                    mood_tags=s.get("moodTags", []),
                    cover_image_url=s.get("coverImageUrl") or "",
                )
                for s in songs
            ]
        except httpx.TimeoutException:
            logger.warning(
                "music_service_batch_timeout url=%s ids_count=%d timeout_ms=%d",
                url, len(song_ids), settings.music_service_timeout_ms,
            )
            return []
        except Exception as exc:
            logger.warning("music_service_batch_error url=%s error=%s", url, str(exc))
            return []

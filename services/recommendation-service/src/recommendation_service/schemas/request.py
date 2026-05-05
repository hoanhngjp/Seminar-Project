from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class RecommendationQueryParams(BaseModel):
    context: Literal["morning", "afternoon", "evening", "night"] | None = None
    limit: int = Field(default=20, ge=1, le=50)


class FeedbackRequest(BaseModel):
    song_id: UUID
    action: Literal["PLAY", "SKIP"]
    duration_percent: float = Field(..., ge=0.0, le=100.0)

    @field_validator("duration_percent")
    @classmethod
    def round_percent(cls, v: float) -> float:
        return round(v, 2)

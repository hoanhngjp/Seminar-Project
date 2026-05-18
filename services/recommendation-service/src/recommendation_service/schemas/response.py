import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

T = TypeVar("T")


class ApiMeta(BaseModel):
    apiVersion: str = "v1"
    requestId: str
    timestamp: str
    cache: str | None = None


class ApiError(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: T | None
    meta: ApiMeta
    error: ApiError | None

    @classmethod
    def ok(cls, data: Any, request_id: str, cache: str | None = None) -> "ApiResponse":
        return cls(
            success=True,
            data=data,
            meta=ApiMeta(
                requestId=request_id,
                timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                cache=cache,
            ),
            error=None,
        )

    @classmethod
    def fail(cls, code: str, message: str, request_id: str) -> "ApiResponse":
        return cls(
            success=False,
            data=None,
            meta=ApiMeta(
                requestId=request_id,
                timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            ),
            error=ApiError(code=code, message=message),
        )


class ReasonItem(BaseModel):
    type: Literal["CONTEXT", "PREFERENCE", "TRENDING"]
    text: str


class SongItem(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    song_id: str
    title: str
    artist: str
    thumbnail: str
    duration_sec: int = 0
    reason: ReasonItem


class RecommendationData(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    items: list[SongItem]

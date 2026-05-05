"""
Rule Engine scoring — pure functions only, no I/O.
formula: final_score = base_score + context_bonus + preference_bonus - skip_penalty
"""
import datetime
from dataclasses import dataclass
from typing import Literal

ContextType = Literal["morning", "afternoon", "evening", "night"]

TIMEOUT_MS = 300  # caller uses asyncio.wait_for(timeout=TIMEOUT_MS/1000)

# Genre names that get a context bonus per time-of-day
CONTEXT_GENRE_MAP: dict[str, list[str]] = {
    "morning":   ["acoustic", "pop", "indie", "morning", "focus"],
    "afternoon": ["pop", "hip-hop", "edm", "energetic", "party"],
    "evening":   ["r&b", "jazz", "soul", "chill", "relaxing"],
    "night":     ["electronic", "ambient", "classical", "lofi"],
}

CONTEXT_BONUS = 0.4
PREFERENCE_WEIGHT_MULTIPLIER = 0.3
ONBOARDING_BONUS = 0.2
SKIP_PENALTY_MULTIPLIER = 0.5


@dataclass
class SongCandidate:
    song_id: str
    title: str
    artist: str
    thumbnail: str
    genre_id: str
    genre_name: str
    mood_tags: list[str]
    base_popularity: float  # 0.0–1.0


@dataclass
class ScoredSong:
    candidate: SongCandidate
    score: float
    context_bonus: float
    preference_bonus: float
    skip_penalty: float
    reason_type: Literal["CONTEXT", "PREFERENCE", "TRENDING"]
    reason_text: str


def get_current_context() -> ContextType:
    hour = datetime.datetime.now(datetime.timezone.utc).hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    else:
        return "night"


def score_candidate(
    candidate: SongCandidate,
    context: str,
    weights: dict[str, float],
    onboarding_genres: list[str],
) -> ScoredSong:
    base = candidate.base_popularity

    # Context bonus: +0.4 if genre_name or any mood_tag matches context genres
    context_genres = CONTEXT_GENRE_MAP.get(context, [])
    candidate_tags = [candidate.genre_name.lower()] + [t.lower() for t in candidate.mood_tags]
    ctx_bonus = CONTEXT_BONUS if any(t in context_genres for t in candidate_tags) else 0.0

    # Preference bonus from Redis Hash weights (can be negative from skips)
    raw_weight = float(weights.get(candidate.genre_id, 0.0))
    pref_bonus = max(0.0, raw_weight) * PREFERENCE_WEIGHT_MULTIPLIER

    # Onboarding bonus: +0.2 if genre in onboarding preferences
    onboarding_lower = [g.lower() for g in onboarding_genres]
    onb_bonus = ONBOARDING_BONUS if candidate.genre_name.lower() in onboarding_lower else 0.0

    # Skip penalty from negative weights
    skip_pen = abs(min(0.0, raw_weight)) * SKIP_PENALTY_MULTIPLIER

    total = base + ctx_bonus + pref_bonus + onb_bonus - skip_pen

    # Reason for explain_text
    if ctx_bonus > 0:
        reason_type = "CONTEXT"
        reason_text = _context_reason_text(context)
    elif pref_bonus > 0 or onb_bonus > 0:
        reason_type = "PREFERENCE"
        reason_text = f"Phù hợp sở thích {candidate.genre_name} của bạn"
    else:
        reason_type = "TRENDING"
        reason_text = "Đang thịnh hành"

    return ScoredSong(
        candidate=candidate,
        score=total,
        context_bonus=ctx_bonus,
        preference_bonus=pref_bonus,
        skip_penalty=skip_pen,
        reason_type=reason_type,
        reason_text=reason_text,
    )


def _context_reason_text(context: str) -> str:
    return {
        "morning":   "Gợi ý buổi sáng tươi mới",
        "afternoon": "Gợi ý buổi chiều năng động",
        "evening":   "Gợi ý buổi tối thư giãn",
        "night":     "Gợi ý đêm khuya nhẹ nhàng",
    }.get(context, "Gợi ý cho bạn")

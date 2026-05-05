"""
Unit tests for Rule Engine — pure functions, no I/O, no mocks needed.
AC2.1.1: context=morning → acoustic/morning songs ranked higher
AC2.1.4: every scored candidate has non-empty reason_text
"""
import pytest

from recommendation_service.services.rule_engine import (
    CONTEXT_GENRE_MAP,
    SongCandidate,
    score_candidate,
)


def make_candidate(
    genre_name: str = "pop",
    mood_tags: list[str] | None = None,
    base_popularity: float = 0.5,
    genre_id: str = "genre-uuid-1",
) -> SongCandidate:
    return SongCandidate(
        song_id="song-uuid-1",
        title="Test Song",
        artist="Test Artist",
        thumbnail="https://cdn/img.jpg",
        genre_id=genre_id,
        genre_name=genre_name,
        mood_tags=mood_tags or [],
        base_popularity=base_popularity,
    )


# ----------------------------------------------------------------
# Context bonus tests (AC2.1.1)
# ----------------------------------------------------------------

def test_context_bonus_applied_when_genre_matches_morning():
    # AC2.1.1: context=morning, genre=acoustic → context_bonus > 0
    candidate = make_candidate(genre_name="acoustic")
    result = score_candidate(candidate, "morning", weights={}, onboarding_genres=[])

    assert result.context_bonus == pytest.approx(0.4, abs=0.001)
    assert result.score > 0.5
    assert result.reason_type == "CONTEXT"
    assert "buổi sáng" in result.reason_text


def test_context_bonus_applied_via_mood_tags():
    # mood_tags match context genres → context_bonus applies
    candidate = make_candidate(genre_name="metal", mood_tags=["morning", "focus"])
    result = score_candidate(candidate, "morning", weights={}, onboarding_genres=[])

    assert result.context_bonus == pytest.approx(0.4, abs=0.001)
    assert result.reason_type == "CONTEXT"


def test_no_bonus_when_genre_mismatch():
    candidate = make_candidate(genre_name="metal")
    result = score_candidate(candidate, "morning", weights={}, onboarding_genres=[])

    assert result.context_bonus == 0.0
    assert result.score == pytest.approx(0.5, abs=0.001)
    assert result.reason_type == "TRENDING"
    assert result.reason_text == "Đang thịnh hành"


def test_context_bonus_evening():
    candidate = make_candidate(genre_name="jazz")
    result = score_candidate(candidate, "evening", weights={}, onboarding_genres=[])

    assert result.context_bonus == pytest.approx(0.4, abs=0.001)
    assert "buổi tối" in result.reason_text


def test_context_bonus_night():
    candidate = make_candidate(genre_name="ambient")
    result = score_candidate(candidate, "night", weights={}, onboarding_genres=[])

    assert result.context_bonus == pytest.approx(0.4, abs=0.001)
    assert "đêm khuya" in result.reason_text


# ----------------------------------------------------------------
# Preference bonus from Redis weights
# ----------------------------------------------------------------

def test_preference_bonus_when_positive_weight():
    # positive weight → preference_bonus > 0
    weights = {"genre-uuid-1": 1.0}
    candidate = make_candidate(genre_name="metal", genre_id="genre-uuid-1")
    result = score_candidate(candidate, "morning", weights=weights, onboarding_genres=[])

    assert result.preference_bonus > 0
    assert result.score > 0.5


def test_skip_penalty_reduces_score(  # AC2.1.2: skip → lower score
):
    weights = {"genre-uuid-1": -0.6}  # negative weight from repeated skips
    candidate = make_candidate(genre_name="metal", genre_id="genre-uuid-1")
    result = score_candidate(candidate, "morning", weights=weights, onboarding_genres=[])

    assert result.skip_penalty > 0
    assert result.score < 0.5


def test_onboarding_bonus_applied():
    candidate = make_candidate(genre_name="jazz")
    result = score_candidate(candidate, "morning", weights={}, onboarding_genres=["Jazz", "Pop"])

    assert result.preference_bonus == pytest.approx(0.0, abs=0.001)
    # onboarding_bonus adds to score — but we check via score > base
    # Note: reason_type may be CONTEXT or PREFERENCE depending on context
    assert result.score > 0.5


def test_onboarding_case_insensitive():
    candidate = make_candidate(genre_name="Jazz")
    result = score_candidate(candidate, "morning", weights={}, onboarding_genres=["jazz"])

    assert result.score > 0.5


# ----------------------------------------------------------------
# Score formula invariant
# ----------------------------------------------------------------

def test_final_score_equals_sum_of_components():
    weights = {"genre-uuid-1": 0.8}
    candidate = make_candidate(genre_name="pop", genre_id="genre-uuid-1")
    result = score_candidate(candidate, "morning", weights=weights, onboarding_genres=["Pop"])

    expected = (
        candidate.base_popularity
        + result.context_bonus
        + result.preference_bonus
        - result.skip_penalty
        + (0.2 if "pop" in ["pop"] else 0)  # onboarding bonus
    )
    # Allow for floating point
    assert abs(result.score - expected) < 0.001


# ----------------------------------------------------------------
# AC2.1.4: reason_text must be non-empty for all scored candidates
# ----------------------------------------------------------------

@pytest.mark.parametrize("context", ["morning", "afternoon", "evening", "night"])
def test_reason_text_always_present(context: str):
    # AC2.1.4: every scored candidate has non-empty explain_text
    candidate = make_candidate(genre_name="metal")  # no match → TRENDING
    result = score_candidate(candidate, context, weights={}, onboarding_genres=[])

    assert result.reason_text is not None
    assert len(result.reason_text) > 0


# ----------------------------------------------------------------
# TIMEOUT_MS constant (AC2.1.5)
# ----------------------------------------------------------------

def test_timeout_constant_is_300ms():
    # AC2.1.5: caller enforces 300ms timeout via TIMEOUT_MS
    from recommendation_service.services.rule_engine import TIMEOUT_MS
    assert TIMEOUT_MS == 300

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "recommendation-service"
    service_version: str = "1.0.0"
    debug: bool = False

    redis_url: str = "redis://localhost:6379"

    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_consumer_group_id: str = "recommendation-service"
    kafka_topics: list[str] = ["Song_Played", "Song_Skipped", "User_Preferences_Updated"]

    music_service_base_url: str = "http://localhost:5003"
    music_service_timeout_ms: int = 200

    recommendation_timeout_ms: int = 300
    recommendation_default_limit: int = 20


settings = Settings()

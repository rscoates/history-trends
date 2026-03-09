from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://htu:htu_secret@db:5432/htu"
    APP_PASSWORD: str = "changeme"
    SECRET_KEY: str = "change-this-to-a-random-secret-key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        env_file = ".env"


settings = Settings()

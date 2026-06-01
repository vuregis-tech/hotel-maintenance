from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    SECRET_KEY: str = "changeme-use-strong-secret-in-production"
    APP_URL: str = "http://localhost:8000"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_GROUP_REPORTER: str = ""
    TELEGRAM_GROUP_TECHNICIAN: str = ""
    TELEGRAM_GROUP_INSPECTOR: str = ""
    TELEGRAM_GROUP_ALL: str = ""

    DATABASE_URL: str = "sqlite:///./hotel_maintenance.db"

    # Cloudinary — เก็บรูปภาพถาวร
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    DAILY_REPORT_TIME: str = "08:00"
    WEEKLY_REPORT_DAY: int = 0
    MONTHLY_REPORT_DAY: int = 1

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

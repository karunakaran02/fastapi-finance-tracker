from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Personal Finance Intelligence Platform"
    API_V1_STR: str = "/api/v1"

    JWT_SECRET: str = "personal_finance_intelligence_platform_secret_key_change_me_in_prod_at_least_32_chars"
    JWT_REFRESH_SECRET: str = "personal_finance_refresh_secret_key_change_me_in_prod_at_least_32_chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    LOGIN_RATE_LIMIT_MAX_HITS: int = 10
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = 7200

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "finance_db"
    POSTGRES_PORT: str = "5432"
    DATABASE_URL: str = ""

    def get_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
        else:
            url = f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg2://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_TLS: bool = True
    EMAILS_FROM_EMAIL: str = "alerts@financeintel.com"
    EMAILS_FROM_NAME: str = "Finance Intel Alerts"

    CHECK_EMAIL_DELIVERABILITY: bool = True

    @property
    def clean_smtp_host(self) -> str:
        return self.SMTP_HOST.strip() if self.SMTP_HOST else ""

    @property
    def clean_smtp_user(self) -> str:
        return self.SMTP_USER.strip() if self.SMTP_USER else ""

    @property
    def clean_smtp_password(self) -> str:
        if not self.SMTP_PASSWORD:
            return ""
        pwd = self.SMTP_PASSWORD.strip()
        if (pwd.startswith('"') and pwd.endswith('"')) or (pwd.startswith("'") and pwd.endswith("'")):
            pwd = pwd[1:-1].strip()
        return pwd

    @property
    def clean_emails_from_email(self) -> str:
        if self.EMAILS_FROM_EMAIL and self.EMAILS_FROM_EMAIL.strip() and self.EMAILS_FROM_EMAIL.strip() != "alerts@financeintel.com":
            return self.EMAILS_FROM_EMAIL.strip()
        return self.clean_smtp_user or "alerts@financeintel.com"

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }

settings = Settings()

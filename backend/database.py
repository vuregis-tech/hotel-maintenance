from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import get_settings

settings = get_settings()

# Railway ส่ง DATABASE_URL เป็น postgres:// แต่ SQLAlchemy 2.x ต้องใช้ postgresql://
_url = settings.DATABASE_URL
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql://", 1)

_is_postgres = _url.startswith("postgresql")

engine = create_engine(
    _url,
    connect_args={"check_same_thread": False} if not _is_postgres else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

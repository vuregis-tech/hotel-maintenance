from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
import hashlib, hmac, os, base64
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import User
from .config import get_settings

settings = get_settings()
try:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _test_hash = pwd_context.hash("test")
    _USE_PASSLIB = True
except Exception:
    _USE_PASSLIB = False

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ALGORITHM = "HS256"
VALID_ROLES = {"admin", "supervisor", "technician", "staff"}


def _sha256_hash(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 260000)
    return "pbkdf2$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(dk).decode()


def _sha256_verify(password: str, hashed: str) -> bool:
    if not hashed.startswith("pbkdf2$"):
        return False
    _, salt_b64, dk_b64 = hashed.split("$")
    salt = base64.b64decode(salt_b64)
    expected = base64.b64decode(dk_b64)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 260000)
    return hmac.compare_digest(dk, expected)


def verify_password(plain: str, hashed: str) -> bool:
    if hashed.startswith("pbkdf2$"):
        return _sha256_verify(plain, hashed)
    if _USE_PASSLIB:
        return pwd_context.verify(plain, hashed)
    return False


def hash_password(password: str) -> str:
    if _USE_PASSLIB:
        try:
            return pwd_context.hash(password)
        except Exception:
            pass
    return _sha256_hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise credentials_exception
        user_id = int(sub)
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if user is None:
        raise credentials_exception
    return user


def require_roles(*roles):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in roles and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="ไม่มีสิทธิ์ดำเนินการนี้")
        return current_user
    return role_checker

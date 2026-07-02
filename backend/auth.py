from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy.orm import Session

from database import get_db
from models import User

from dotenv import load_dotenv
load_dotenv()

# -------------------
# CONFIG
# -------------------
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# -------------------
# SECURITY SCHEME
# -------------------
security = HTTPBearer()

# -------------------
# PASSWORD HASHING
# -------------------
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__truncate_error=True
)

def hash_password(password: str):
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password too long (bcrypt max 72 bytes)")
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str):
    if len(password.encode("utf-8")) > 72:
        return False
    return pwd_context.verify(password, hashed)

# -------------------
# JWT CREATION
# -------------------
def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# -------------------
# JWT DECODE
# -------------------
def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

# -------------------
# GET CURRENT USER (🔥 FIXES YOUR 401 ISSUE)
# -------------------
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials  # removes "Bearer "

    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user
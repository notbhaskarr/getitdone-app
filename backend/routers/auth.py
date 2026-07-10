from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from models import User
from schemas import UserCreate, UserLogin
from auth import hash_password, verify_password, create_access_token
from dependencies import get_current_user

router = APIRouter()

@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    user.email = user.email.strip().lower()
    if not user.email:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    if len(user.password) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password too long (max 72 characters)"
        )

    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = User(
        name=user.name.strip().title(),
        email=user.email,
        password_hash=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully"}


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    user.email = user.email.strip().lower()

    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    today = datetime.utcnow().date()
    if db_user.last_login_date is None or db_user.last_login_date < today:
        db_user.luffies += 2
        db_user.last_login_date = today
        db.commit()

    token = create_access_token({"user_id": str(db_user.id)})

    return {"access_token": token}


@router.get("/users/me")
def get_user_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "luffies": current_user.luffies
    }

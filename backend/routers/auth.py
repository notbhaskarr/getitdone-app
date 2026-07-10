from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserCreate, UserLogin
from dependencies import get_current_user
from services import users_service

router = APIRouter()

@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    return users_service.signup(db, user)

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    return users_service.login(db, user)

@router.get("/users/me")
def get_user_profile(current_user: User = Depends(get_current_user)):
    return users_service.get_user_profile(current_user)

from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from uuid import UUID

from database import get_db
from models import User
from auth import decode_token

def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):

    if not authorization:
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.replace("Bearer ", "")

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")

    user = db.query(User).filter(User.id == UUID(user_id)).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

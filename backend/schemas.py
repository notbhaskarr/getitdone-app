from pydantic import BaseModel
from typing import Optional
from uuid import UUID


# -------------------
# AUTH SCHEMAS
# -------------------
class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# -------------------
# TASK SCHEMAS
# -------------------
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_completed: Optional[bool] = None
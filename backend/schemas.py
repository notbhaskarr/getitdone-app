from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


# -------------------
# AUTH SCHEMAS
# -------------------
class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class UserRead(BaseModel):
    id: UUID
    name: str
    email: str
    luffies: int
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# -------------------
# PEER SCHEMAS
# -------------------
class PeerRequestCreate(BaseModel):
    email: str

class PeerConnectionRead(BaseModel):
    id: UUID
    requester_id: UUID
    receiver_id: UUID
    status: str
    created_at: datetime
    # We will include basic user info of the peer in the endpoint response directly.

# -------------------
# TASK SCHEMAS
# -------------------
class SubtaskCreate(BaseModel):
    title: str

class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None

class SubtaskRead(BaseModel):
    id: UUID
    task_id: UUID
    title: str
    is_completed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    reward_luffies: Optional[int] = 3
    assigned_to_id: Optional[UUID] = None
    due_date: Optional[datetime] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_completed: Optional[bool] = None
    reward_luffies: Optional[int] = None
    assigned_to_id: Optional[UUID] = None
    is_rejected: Optional[bool] = False
    due_date: Optional[datetime] = None

class TaskTipRequest(BaseModel):
    amount: int

class TaskEventRead(BaseModel):
    id: UUID
    task_id: UUID
    user_id: Optional[UUID] = None
    event_type: str
    details: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
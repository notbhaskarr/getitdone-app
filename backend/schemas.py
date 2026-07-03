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
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    reward_luffies: Optional[int] = 3
    assigned_to_id: Optional[UUID] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_completed: Optional[bool] = None
    reward_luffies: Optional[int] = None
    assigned_to_id: Optional[UUID] = None
    is_rejected: Optional[bool] = False

class TaskTipRequest(BaseModel):
    amount: int
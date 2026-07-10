from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

class PeerRequestCreate(BaseModel):
    email: str

class PeerConnectionRead(BaseModel):
    id: UUID
    requester_id: UUID
    receiver_id: UUID
    status: str
    created_at: datetime

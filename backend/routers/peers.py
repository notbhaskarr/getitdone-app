from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from uuid import UUID

from database import get_db
from models import User
from schemas.peers import PeerRequestCreate
from dependencies import get_current_user
from services import peers_service

router = APIRouter()

@router.post("/peers/request")
def request_peer(req: PeerRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return peers_service.request_peer(db, current_user, req)

@router.put("/peers/accept/{conn_id}")
def accept_peer(conn_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return peers_service.accept_peer(db, current_user, conn_id)

@router.delete("/peers/{conn_id}")
def remove_peer(conn_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return peers_service.remove_peer(db, current_user, conn_id)

@router.get("/peers")
def list_peers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return peers_service.list_peers(db, current_user)

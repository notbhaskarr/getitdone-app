from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from uuid import UUID

from database import get_db
from models import User, PeerConnection
from schemas import PeerRequestCreate
from dependencies import get_current_user

router = APIRouter()

@router.post("/peers/request")
def request_peer(req: PeerRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    req.email = req.email.strip().lower()
    receiver = db.query(User).filter(User.email == req.email).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Username not found")
    if receiver.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send request to yourself")
    
    existing = db.query(PeerConnection).filter(
        or_(
            (PeerConnection.requester_id == current_user.id) & (PeerConnection.receiver_id == receiver.id),
            (PeerConnection.requester_id == receiver.id) & (PeerConnection.receiver_id == current_user.id)
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Connection already exists or is pending")

    new_conn = PeerConnection(requester_id=current_user.id, receiver_id=receiver.id)
    db.add(new_conn)
    db.commit()
    return {"message": "Request sent"}

@router.put("/peers/accept/{conn_id}")
def accept_peer(conn_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = db.query(PeerConnection).filter(PeerConnection.id == conn_id, PeerConnection.receiver_id == current_user.id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Request not found")
    
    conn.status = "accepted"
    db.commit()
    return {"message": "Request accepted"}

@router.delete("/peers/{conn_id}")
def remove_peer(conn_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = db.query(PeerConnection).filter(
        PeerConnection.id == conn_id,
        or_(PeerConnection.requester_id == current_user.id, PeerConnection.receiver_id == current_user.id)
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Peer connection not found")
    
    db.delete(conn)
    db.commit()
    return {"message": "Peer removed"}

@router.get("/peers")
def list_peers(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conns = db.query(PeerConnection).filter(
        or_(PeerConnection.requester_id == current_user.id, PeerConnection.receiver_id == current_user.id)
    ).all()
    
    result = []
    for c in conns:
        peer_id = c.receiver_id if c.requester_id == current_user.id else c.requester_id
        peer_user = db.query(User).filter(User.id == peer_id).first()
        result.append({
            "id": c.id,
            "status": c.status,
            "peer_id": peer_id,
            "peer_name": peer_user.name if peer_user else "Unknown",
            "peer_email": peer_user.email if peer_user else "Unknown",
            "is_requester": c.requester_id == current_user.id
        })
    return result

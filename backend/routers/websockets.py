from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models import PeerConnection
from auth import decode_token
from socket_manager import manager

router = APIRouter()

@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload or not payload.get("user_id"):
        await websocket.close(code=1008)
        return
        
    user_id = payload.get("user_id")
    await manager.connect(websocket, user_id)
    
    conns = db.query(PeerConnection).filter(
        or_(PeerConnection.requester_id == user_id, PeerConnection.receiver_id == user_id),
        PeerConnection.status == 'accepted'
    ).all()
    
    peer_ids = []
    for c in conns:
        pid = c.receiver_id if str(c.requester_id) == str(user_id) else c.requester_id
        peer_ids.append(str(pid))
        
    online_peers = [p for p in peer_ids if p in manager.active_connections]
    await websocket.send_json({"type": "online_peers", "peers": online_peers})
    
    for pid in online_peers:
        await manager.send_personal_message({"type": "peer_online", "peer_id": user_id}, pid)
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        for pid in online_peers:
            await manager.send_personal_message({"type": "peer_offline", "peer_id": user_id}, pid)

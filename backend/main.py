from fastapi import FastAPI, Depends, HTTPException, Header, WebSocket, WebSocketDisconnect, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from uuid import UUID
from datetime import datetime

from database import engine, get_db
from models import Base, User, Task, PeerConnection, TaskEvent, Subtask

from schemas import UserCreate, UserLogin, TaskCreate, TaskUpdate, Token, PeerRequestCreate, TaskTipRequest, SubtaskCreate, SubtaskUpdate
from auth import hash_password, verify_password, create_access_token, decode_token

from fastapi.middleware.cors import CORSMiddleware



app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://letsgetitdone.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


Base.metadata.create_all(bind=engine)

# =========================
# HEALTH
# =========================
@app.get("/")
def home():
    return {"message": "Todo API running 🚀"}


# =========================
# AUTH: SIGNUP
# =========================
@app.post("/signup")
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


# =========================
# AUTH: LOGIN
# =========================
@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    user.email = user.email.strip().lower()

    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid credentials")

    # ✅ correct order
    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid credentials")

    today = datetime.utcnow().date()
    if db_user.last_login_date is None or db_user.last_login_date < today:
        db_user.luffies += 2
        db_user.last_login_date = today
        db.commit()

    token = create_access_token({"user_id": str(db_user.id)})

    return {"access_token": token}

# =========================
# WEBSOCKET MANAGER
# =========================
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        user_id_str = str(user_id)
        if user_id_str in self.active_connections:
            websocket = self.active_connections[user_id_str]
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(user_id_str)

manager = ConnectionManager()

# =========================
# WEBSOCKET ENDPOINT
# =========================
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str, db: Session = Depends(get_db)):
    payload = decode_token(token)
    if not payload or not payload.get("user_id"):
        await websocket.close(code=1008)
        return
        
    user_id = payload.get("user_id")
    await manager.connect(websocket, user_id)
    
    # Get accepted peers
    conns = db.query(PeerConnection).filter(
        or_(PeerConnection.requester_id == user_id, PeerConnection.receiver_id == user_id),
        PeerConnection.status == 'accepted'
    ).all()
    
    peer_ids = []
    for c in conns:
        pid = c.receiver_id if str(c.requester_id) == str(user_id) else c.requester_id
        peer_ids.append(str(pid))
        
    # Send current online peers to this user
    online_peers = [p for p in peer_ids if p in manager.active_connections]
    await websocket.send_json({"type": "online_peers", "peers": online_peers})
    
    # Broadcast to online peers that this user is now online
    for pid in online_peers:
        await manager.send_personal_message({"type": "peer_online", "peer_id": user_id}, pid)
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id)
        # Broadcast offline status
        for pid in online_peers:
            await manager.send_personal_message({"type": "peer_offline", "peer_id": user_id}, pid)

# =========================
# JWT DEPENDENCY (CURRENT USER)
# =========================
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

# =========================
# USER: GET PROFILE
# =========================
@app.get("/users/me")
def get_user_profile(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "luffies": current_user.luffies
    }


# =========================
# PEER: REQUEST CONNECTION
# =========================
@app.post("/peers/request")
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

# =========================
# PEER: ACCEPT CONNECTION
# =========================
@app.put("/peers/accept/{conn_id}")
def accept_peer(conn_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conn = db.query(PeerConnection).filter(PeerConnection.id == conn_id, PeerConnection.receiver_id == current_user.id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Request not found")
    
    conn.status = "accepted"
    db.commit()
    return {"message": "Request accepted"}

# =========================
# PEER: REMOVE CONNECTION
# =========================
@app.delete("/peers/{conn_id}")
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

# =========================
# PEER: LIST CONNECTIONS
# =========================
@app.get("/peers")
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

# =========================
# TASK: CREATE (USER-BOUND)
# =========================
@app.post("/tasks")
def create_task(
    task: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    # Handle initial assignment escrow
    if task.assigned_to_id:
        if current_user.luffies < task.reward_luffies:
            raise HTTPException(status_code=400, detail="Not enough Whuffies to assign this task")
        current_user.luffies -= task.reward_luffies
        
    new_task = Task(
        title=task.title,
        description=task.description,
        reward_luffies=task.reward_luffies,
        user_id=current_user.id,
        assigned_to_id=task.assigned_to_id,
        due_date=task.due_date
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # Log creation
    db.add(TaskEvent(task_id=new_task.id, user_id=current_user.id, event_type="CREATED"))
    if new_task.assigned_to_id:
        db.add(TaskEvent(task_id=new_task.id, user_id=current_user.id, event_type="ASSIGNED", details=f"Assigned to peer {new_task.assigned_to_id}"))
        background_tasks.add_task(
            manager.send_personal_message,
            {"type": "NOTIFICATION", "event": "ASSIGNED", "actor": current_user.name, "action": "assigned a task to you:", "task_title": new_task.title, "task_id": str(new_task.id)},
            str(new_task.assigned_to_id)
        )
    db.commit()
    db.refresh(new_task)

    return new_task


# =========================
# TASK: GET USER TASKS ONLY
# =========================
@app.get("/debug_tasks")
def debug_tasks(db: Session = Depends(get_db)):
    try:
        tasks = db.query(Task).all()
        result = []
        for t in tasks:
            d = dict(t.__dict__)
            d.pop("_sa_instance_state", None)
            result.append(d)
        return {"tasks": result}
    except Exception as e:
        import traceback
        return {"error_debug": str(e), "traceback": traceback.format_exc()}

@app.get("/tasks")
def get_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        tasks = db.query(Task).filter(
            or_(Task.user_id == current_user.id, Task.assigned_to_id == current_user.id)
        ).all()
        
        result = []
        for t in tasks:
            d = dict(t.__dict__)
            d.pop("_sa_instance_state", None)
            d["subtasks"] = [{"id": s.id, "title": s.title, "is_completed": s.is_completed} for s in t.subtasks]
            result.append(d)
        return result
    except Exception as e:
        import traceback
        return {"error_debug": str(e), "traceback": traceback.format_exc()}


@app.get("/tasks/{task_id}/events")
def get_task_events(task_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != current_user.id and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this task's events")
    
    events = db.query(TaskEvent).filter(TaskEvent.task_id == task_id).order_by(TaskEvent.created_at.desc()).all()
    
    # We will format this directly to avoid needing a response_model for now
    result = []
    for e in events:
        user = db.query(User).filter(User.id == e.user_id).first() if e.user_id else None
        user_name = user.name if user else "System"
        
        message = f"{user_name} {e.event_type}"
        
        if e.event_type == "CREATED":
            message = f"{user_name} CREATED the task."
        elif e.event_type == "COMPLETED":
            message = f"{user_name} COMPLETED the task."
        elif e.event_type == "REJECTED":
            message = f"{user_name} REJECTED the task."
        elif e.event_type == "ASSIGNED":
            if e.details and e.details.startswith("Assigned to peer "):
                peer_id_str = e.details.replace("Assigned to peer ", "")
                try:
                    peer_uuid = UUID(peer_id_str)
                    peer_user = db.query(User).filter(User.id == peer_uuid).first()
                    peer_name = peer_user.name if peer_user else "someone"
                    message = f"{user_name} ASSIGNED task to {peer_name}"
                except:
                    message = f"{user_name} ASSIGNED task"
            else:
                message = f"{user_name} {e.details}" if e.details else f"{user_name} ASSIGNED task"
        elif e.event_type == "TIPPED":
            # The tip goes to the assignee
            amount = e.details.replace("Tipped ", "").replace(" Whuffies", "") if e.details else "some"
            assignee_name = "someone"
            if task.assigned_to_id:
                assignee = db.query(User).filter(User.id == task.assigned_to_id).first()
                if assignee:
                    assignee_name = assignee.name
            message = f"{user_name} TIPPED {amount} whuffies to {assignee_name}"

        result.append({
            "id": e.id,
            "task_id": e.task_id,
            "user_id": e.user_id,
            "user_name": user_name,
            "event_type": e.event_type,
            "details": e.details,
            "message": message,
            "created_at": e.created_at
        })
    return result

# =========================
# TASK: UPDATE
# =========================
@app.put("/tasks/{task_id}")
def update_task(
    task_id: UUID,
    update: TaskUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    task = db.query(Task).with_for_update().filter(
        Task.id == task_id,
        or_(Task.user_id == current_user.id, Task.assigned_to_id == current_user.id)
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    is_owner = (task.user_id == current_user.id)
    is_assignee = (task.assigned_to_id == current_user.id)
    update_data = update.dict(exclude_unset=True)
    print(f"DEBUG update_data: {update_data}")

    # 1. Handle Assignee Rejection
    if is_assignee and not is_owner and update_data.get("is_rejected"):
        owner = db.query(User).with_for_update().filter(User.id == task.user_id).first()
        if owner:
            owner.luffies += task.reward_luffies
        task.assigned_to_id = None
        task.updated_at = datetime.utcnow()
        db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="REJECTED"))
        background_tasks.add_task(
            manager.send_personal_message,
            {"type": "NOTIFICATION", "event": "REJECTED", "actor": current_user.name, "action": "rejected your task:", "task_title": task.title, "task_id": str(task.id)},
            str(task.user_id)
        )
        db.commit()
        db.refresh(task)
        return task

    # 2. Handle Assignee Updates (Can only toggle completion)
    if not is_owner:
        if "is_completed" in update_data and update_data["is_completed"] != task.is_completed:
            db_current_user = db.query(User).with_for_update().filter(User.id == current_user.id).first()
            if update_data["is_completed"]:
                db_current_user.luffies += task.reward_luffies
                db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="COMPLETED"))
                background_tasks.add_task(
                    manager.send_personal_message,
                    {"type": "NOTIFICATION", "event": "COMPLETED", "actor": current_user.name, "action": "completed your task:", "task_title": task.title, "task_id": str(task.id)},
                    str(task.user_id)
                )
            else:
                db_current_user.luffies = max(0, db_current_user.luffies - task.reward_luffies)
                db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="REOPENED"))
            task.is_completed = update_data["is_completed"]
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return task

    # 3. Handle Owner Updates
    if "title" in update_data:
        task.title = update_data["title"]
    if "description" in update_data:
        task.description = update_data["description"]
    if "due_date" in update_data:
        task.due_date = update_data["due_date"]

    # Owner assignment/revocation
    if "assigned_to_id" in update_data:
        new_assignee_id = update_data["assigned_to_id"]
        if new_assignee_id != task.assigned_to_id:
            # Prevent assigning if already completed
            if task.is_completed:
                raise HTTPException(status_code=400, detail="Cannot assign a completed task")
            
            # Assigning a previously unassigned task
            if task.assigned_to_id is None and new_assignee_id is not None:
                db_current_user = db.query(User).with_for_update().filter(User.id == current_user.id).first()
                if db_current_user.luffies < task.reward_luffies:
                    raise HTTPException(status_code=400, detail="Not enough Whuffies to assign")
                db_current_user.luffies -= task.reward_luffies
                background_tasks.add_task(
                    manager.send_personal_message,
                    {"type": "NOTIFICATION", "event": "ASSIGNED", "actor": current_user.name, "action": "assigned a task to you:", "task_title": task.title, "task_id": str(task.id)},
                    str(new_assignee_id)
                )
            
            # Revoking an assignment back to self
            elif task.assigned_to_id is not None and new_assignee_id is None:
                db_current_user = db.query(User).with_for_update().filter(User.id == current_user.id).first()
                db_current_user.luffies += task.reward_luffies
                db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="ASSIGNED", details="Assignment revoked"))
            
            task.assigned_to_id = new_assignee_id
            if new_assignee_id is not None:
                db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="ASSIGNED", details=f"Assigned to peer {new_assignee_id}"))

    # Owner completion (only if unassigned)
    if "is_completed" in update_data and update_data["is_completed"] != task.is_completed:
        if task.assigned_to_id is not None:
            raise HTTPException(status_code=400, detail="Cannot complete a task assigned to someone else")
        if update_data["is_completed"]:
            current_user.luffies += task.reward_luffies
            db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="COMPLETED"))
        else:
            current_user.luffies = max(0, current_user.luffies - task.reward_luffies)
            db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="REOPENED"))
        task.is_completed = update_data["is_completed"]

    task.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task


# =========================
# TASK: DELETE
# =========================
@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()

    return {"detail": "Task deleted successfully"}

# =========================
# TASK: TIP
# =========================
@app.post("/tasks/{task_id}/tip")
def tip_task(
    task_id: UUID,
    tip: TaskTipRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if tip.amount <= 0:
        raise HTTPException(status_code=400, detail="Tip amount must be positive")

    task = db.query(Task).with_for_update().filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only tip on tasks you created")

    if not task.assigned_to_id or task.assigned_to_id == current_user.id:
        raise HTTPException(status_code=400, detail="You can only tip peers on assigned tasks")

    if not task.is_completed:
        raise HTTPException(status_code=400, detail="You can only tip on completed tasks")

    if getattr(task, 'tipped_amount', 0) > 0:
        raise HTTPException(status_code=400, detail="This task has already been tipped")

    db_current_user = db.query(User).with_for_update().filter(User.id == current_user.id).first()
    if db_current_user.luffies < tip.amount:
        raise HTTPException(status_code=400, detail="Not enough Whuffies to send this tip")

    assignee = db.query(User).with_for_update().filter(User.id == task.assigned_to_id).first()
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")

    # Perform tipping
    db_current_user.luffies -= tip.amount
    assignee.luffies += tip.amount
    task.tipped_amount = tip.amount

    db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="TIPPED", details=f"Tipped {tip.amount} Whuffies"))
    background_tasks.add_task(
        manager.send_personal_message,
        {"type": "NOTIFICATION", "event": "TIPPED", "actor": current_user.name, "action": f"tipped you {tip.amount} Whuffies for", "task_title": task.title, "task_id": str(task.id)},
        str(task.assigned_to_id)
    )

    db.commit()
    db.refresh(task)
    return task

# =========================
# SUBTASKS
# =========================
@app.post("/tasks/{task_id}/subtasks")
def create_subtask(
    task_id: UUID,
    subtask: SubtaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != current_user.id and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    new_subtask = Subtask(
        task_id=task_id,
        title=subtask.title
    )
    db.add(new_subtask)
    db.commit()
    db.refresh(new_subtask)
    return {"id": new_subtask.id, "title": new_subtask.title, "is_completed": new_subtask.is_completed}

@app.put("/subtasks/{subtask_id}")
def update_subtask(
    subtask_id: UUID,
    update: SubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subtask = db.query(Subtask).filter(Subtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
    
    task = db.query(Task).filter(Task.id == subtask.task_id).first()
    if not task or (task.user_id != current_user.id and task.assigned_to_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if update.title is not None:
        subtask.title = update.title
    if update.is_completed is not None:
        subtask.is_completed = update.is_completed
        
    db.commit()
    return {"message": "Subtask updated"}

@app.delete("/subtasks/{subtask_id}")
def delete_subtask(
    subtask_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subtask = db.query(Subtask).filter(Subtask.id == subtask_id).first()
    if not subtask:
        raise HTTPException(status_code=404, detail="Subtask not found")
        
    task = db.query(Task).filter(Task.id == subtask.task_id).first()
    if not task or (task.user_id != current_user.id and task.assigned_to_id != current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.delete(subtask)
    db.commit()
    return {"message": "Subtask deleted"}
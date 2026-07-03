from fastapi import FastAPI, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_
from uuid import UUID
from datetime import datetime

from database import engine, get_db
from models import Base, User, Task, PeerConnection

from schemas import UserCreate, UserLogin, TaskCreate, TaskUpdate, Token, PeerRequestCreate
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

    if len(user.password) > 72:
        raise HTTPException(
            status_code=400,
            detail="Password too long (max 72 characters)"
        )

    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=user.name,
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
    receiver = db.query(User).filter(User.email == req.email).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="User not found")
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
        assigned_to_id=task.assigned_to_id
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


# =========================
# TASK: GET USER TASKS ONLY
# =========================
@app.get("/tasks")
def get_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return db.query(Task).filter(
        or_(Task.user_id == current_user.id, Task.assigned_to_id == current_user.id)
    ).all()


# =========================
# TASK: UPDATE
# =========================
@app.put("/tasks/{task_id}")
def update_task(
    task_id: UUID,
    update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    task = db.query(Task).filter(
        Task.id == task_id,
        or_(Task.user_id == current_user.id, Task.assigned_to_id == current_user.id)
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    is_owner = (task.user_id == current_user.id)
    is_assignee = (task.assigned_to_id == current_user.id)
    update_data = update.dict(exclude_unset=True)

    # 1. Handle Assignee Rejection
    if is_assignee and not is_owner and update_data.get("is_rejected"):
        owner = db.query(User).filter(User.id == task.user_id).first()
        if owner:
            owner.luffies += task.reward_luffies
        task.assigned_to_id = None
        task.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(task)
        return task

    # 2. Handle Assignee Updates (Can only toggle completion)
    if not is_owner:
        if "is_completed" in update_data and update_data["is_completed"] != task.is_completed:
            if update_data["is_completed"]:
                current_user.luffies += task.reward_luffies
            else:
                current_user.luffies = max(0, current_user.luffies - task.reward_luffies)
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

    # Owner assignment/revocation
    if "assigned_to_id" in update_data:
        new_assignee_id = update_data["assigned_to_id"]
        if new_assignee_id != task.assigned_to_id:
            # Prevent assigning if already completed
            if task.is_completed:
                raise HTTPException(status_code=400, detail="Cannot assign a completed task")
            
            # Assigning a previously unassigned task
            if task.assigned_to_id is None and new_assignee_id is not None:
                if current_user.luffies < task.reward_luffies:
                    raise HTTPException(status_code=400, detail="Not enough Whuffies to assign")
                current_user.luffies -= task.reward_luffies
            
            # Revoking an assignment back to self
            elif task.assigned_to_id is not None and new_assignee_id is None:
                current_user.luffies += task.reward_luffies
            
            task.assigned_to_id = new_assignee_id

    # Owner completion (only if unassigned)
    if "is_completed" in update_data and update_data["is_completed"] != task.is_completed:
        if task.assigned_to_id is not None:
            raise HTTPException(status_code=400, detail="Cannot complete a task assigned to someone else")
        if update_data["is_completed"]:
            current_user.luffies += task.reward_luffies
        else:
            current_user.luffies = max(0, current_user.luffies - task.reward_luffies)
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

    return {"message": "Task deleted"}
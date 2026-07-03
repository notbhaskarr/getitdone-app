from fastapi import FastAPI, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from database import engine, get_db
from models import Base, User, Task

from schemas import UserCreate, UserLogin, TaskCreate, TaskUpdate, Token
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
# TASK: CREATE (USER-BOUND)
# =========================
@app.post("/tasks")
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    new_task = Task(
        title=task.title,
        description=task.description,
        reward_luffies=task.reward_luffies,
        user_id=current_user.id
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

    return db.query(Task).filter(Task.user_id == current_user.id).all()


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
        Task.user_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if update.title is not None:
        task.title = update.title

    if update.description is not None:
        task.description = update.description

    if update.is_completed is not None:
        if update.is_completed != task.is_completed:
            if update.is_completed:
                current_user.luffies += task.reward_luffies
            else:
                current_user.luffies = max(0, current_user.luffies - task.reward_luffies)
        task.is_completed = update.is_completed

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
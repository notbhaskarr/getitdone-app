from sqlalchemy import Column, String, Boolean, Text, ForeignKey, TIMESTAMP, Integer, Date
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid

Base = declarative_base()

# -------------------
# USER MODEL
# -------------------
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    luffies = Column(Integer, default=10)
    last_login_date = Column(Date, nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    tasks = relationship("Task", back_populates="user", cascade="all, delete", foreign_keys="[Task.user_id]")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="[Task.assigned_to_id]")

# -------------------
# PEER CONNECTION MODEL
# -------------------
class PeerConnection(Base):
    __tablename__ = "peer_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requester_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending") # "pending" or "accepted"
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    requester = relationship("User", foreign_keys=[requester_id])
    receiver = relationship("User", foreign_keys=[receiver_id])


# -------------------
# TASK MODEL
# -------------------
class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_completed = Column(Boolean, default=False)
    is_rejected = Column(Boolean, default=False)
    reward_luffies = Column(Integer, default=3)
    tipped_amount = Column(Integer, default=0)
    due_date = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    events = relationship("TaskEvent", back_populates="task", cascade="all, delete-orphan", order_by="TaskEvent.created_at")
    user = relationship("User", back_populates="tasks", foreign_keys=[user_id])
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assigned_to_id])
    subtasks = relationship("Subtask", back_populates="task", cascade="all, delete-orphan", order_by="Subtask.created_at")

# -------------------
# SUBTASK MODEL
# -------------------
class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    is_completed = Column(Boolean, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    task = relationship("Task", back_populates="subtasks")

# -------------------
# TASK EVENT MODEL
# -------------------
class TaskEvent(Base):
    __tablename__ = "task_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String(50), nullable=False)
    details = Column(String(255), nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    task = relationship("Task", back_populates="events")
    user = relationship("User")
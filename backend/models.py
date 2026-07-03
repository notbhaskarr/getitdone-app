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
    description = Column(Text)

    is_completed = Column(Boolean, default=False)
    reward_luffies = Column(Integer, default=3)

    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    updated_at = Column(TIMESTAMP, default=datetime.utcnow, onupdate=datetime.utcnow)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="tasks", foreign_keys=[user_id])
    assignee = relationship("User", back_populates="assigned_tasks", foreign_keys=[assigned_to_id])
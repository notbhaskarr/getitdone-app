from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID

from database import get_db
from models import User
from schemas.tasks import TaskCreate, TaskUpdate, TaskTipRequest, SubtaskCreate, SubtaskUpdate
from dependencies import get_current_user
from services import tasks_service

router = APIRouter()

@router.post("/tasks")
def create_task(
    task: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return tasks_service.create_task(task, background_tasks, db, current_user)

@router.get("/tasks")
def get_tasks(
    filter_by: str = 'all',
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return tasks_service.get_tasks(filter_by, db, current_user)

@router.get("/tasks/{task_id}/events")
def get_task_events(task_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return tasks_service.get_task_events(task_id, db, current_user)

@router.put("/tasks/{task_id}")
def update_task(
    task_id: UUID,
    task_update: TaskUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return tasks_service.update_task(task_id, task_update, background_tasks, db, current_user)

@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return tasks_service.delete_task(task_id, background_tasks, db, current_user)

@router.post("/tasks/{task_id}/tip")
def tip_task(
    task_id: UUID,
    tip_req: TaskTipRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return tasks_service.tip_task(task_id, tip_req, background_tasks, db, current_user)

@router.post("/tasks/{task_id}/subtasks")
def create_subtask(
    task_id: UUID,
    subtask: SubtaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return tasks_service.create_subtask(task_id, subtask, background_tasks, db, current_user)

@router.put("/tasks/{task_id}/subtasks/{subtask_id}")
def update_subtask(
    task_id: UUID,
    subtask_id: UUID,
    subtask_update: SubtaskUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return tasks_service.update_subtask(task_id, subtask_id, subtask_update, background_tasks, db, current_user)

@router.delete("/tasks/{task_id}/subtasks/{subtask_id}")
def delete_subtask(
    task_id: UUID,
    subtask_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return tasks_service.delete_subtask(task_id, subtask_id, background_tasks, db, current_user)

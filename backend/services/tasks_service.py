from fastapi import HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import or_
from uuid import UUID
from datetime import datetime

from database import get_db
from models import User, Task, TaskEvent, Subtask
from schemas import TaskCreate, TaskUpdate, TaskTipRequest, SubtaskCreate, SubtaskUpdate
from dependencies import get_current_user
from socket_manager import manager


def create_task(
    task: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session ,
    current_user: User 
):
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

def get_tasks(
    db: Session ,
    current_user: User 
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
        # Standard HTTP 500 error instead of exposing traceback
        raise HTTPException(status_code=500, detail="An internal server error occurred while fetching tasks.")

def get_task_events(task_id: UUID, db: Session , current_user: User ):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != current_user.id and task.assigned_to_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this task's events")
    
    events = db.query(TaskEvent).filter(TaskEvent.task_id == task_id).order_by(TaskEvent.created_at.desc()).all()
    
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

def update_task(
    task_id: UUID,
    update: TaskUpdate,
    background_tasks: BackgroundTasks,
    db: Session ,
    current_user: User 
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

    if "title" in update_data:
        task.title = update_data["title"]
    if "description" in update_data:
        task.description = update_data["description"]
    if "due_date" in update_data:
        task.due_date = update_data["due_date"]

    if "assigned_to_id" in update_data:
        new_assignee_id = update_data["assigned_to_id"]
        if new_assignee_id != task.assigned_to_id:
            if task.is_completed:
                raise HTTPException(status_code=400, detail="Cannot assign a completed task")
            
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
            
            elif task.assigned_to_id is not None and new_assignee_id is None:
                db_current_user = db.query(User).with_for_update().filter(User.id == current_user.id).first()
                db_current_user.luffies += task.reward_luffies
                db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="ASSIGNED", details="Assignment revoked"))
            
            task.assigned_to_id = new_assignee_id
            if new_assignee_id is not None:
                db.add(TaskEvent(task_id=task.id, user_id=current_user.id, event_type="ASSIGNED", details=f"Assigned to peer {new_assignee_id}"))

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

def delete_task(
    task_id: UUID,
    db: Session ,
    current_user: User 
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

def tip_task(
    task_id: UUID,
    tip: TaskTipRequest,
    background_tasks: BackgroundTasks,
    db: Session ,
    current_user: User 
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

def create_subtask(
    task_id: UUID,
    subtask: SubtaskCreate,
    db: Session ,
    current_user: User 
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

def update_subtask(
    subtask_id: UUID,
    update: SubtaskUpdate,
    db: Session ,
    current_user: User 
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

def delete_subtask(
    subtask_id: UUID,
    db: Session ,
    current_user: User 
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

import React, { useState } from 'react';
import './TaskCard.css';
import { getDeterministicColorIndex } from '../utils/helpers';
import { useAppContext } from "../context/AppContext";

export default function TaskCard({
  task,
  currentUserId,
  loadingTasks,
  peers,
  handleToggleComplete,
  setActiveSubtaskTask,
  setMaximizedTask,
  setEditTitle,
  setEditDesc,
  setEditAssigneeId,
  setEditDueDate,
  setIsMacEditing,
  openTipModal,
  dragProps = {}
}) {
  const { archiveTask } = useAppContext();
  const colors = [
    "162, 178, 150",
    "224, 122, 95",
    "61, 90, 128",
    "129, 178, 154",
    "242, 204, 143",
    "212, 163, 115",
    "157, 129, 137"
  ];
  const colorIndex = getDeterministicColorIndex(task.id);
  const taskColorRGB = colors[colorIndex % colors.length];
  
  const { isDragged, ...restDragProps } = dragProps;

  return (
    <div 
      className={`task-card ${task.is_completed ? 'completed' : ''}`} 
      style={{ 
        '--task-color': taskColorRGB,
        opacity: isDragged ? 0.5 : 1,
        boxShadow: isDragged ? '0 10px 20px rgba(0,0,0,0.2)' : undefined,
        cursor: restDragProps.draggable ? 'grab' : 'default',
        transform: isDragged ? 'scale(1.02)' : 'scale(1)'
      }}
      onClick={() => {
        setActiveSubtaskTask(task);
      }}
      {...restDragProps}
    >
      <input
        type="checkbox"
        className="task-checkbox"
        checked={task.is_completed}
        disabled={(task.assigned_to_id && task.user_id === currentUserId) || loadingTasks.has(task.id)}
        onChange={() => handleToggleComplete(task)}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          '--progress': task.subtasks && task.subtasks.length > 0 
            ? `${(task.subtasks.filter(st => st.is_completed).length / task.subtasks.length) * 100}%` 
            : '0%' 
        }}
      />

      <div className="task-content" style={{ cursor: 'pointer' }}>
        <div className="task-title">{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
        {task.assigned_to_id && task.user_id === currentUserId && (
          <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Assigned to: {peers.find(p => p.peer_id === task.assigned_to_id)?.peer_name || "Peer"}
          </div>
        )}
        {task.user_id !== currentUserId && (
          <div style={{ fontSize: '10px', color: 'var(--accent)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Assigned by: {peers.find(p => p.peer_id === task.user_id)?.peer_name || "Peer"}
          </div>
        )}
      </div>
      <div className="task-actions">
        {task.is_completed ? (
          <button className="icon-btn edit-btn" onClick={(e) => {
            e.stopPropagation();
            archiveTask(task.id);
          }} title="Remove from View" style={{ opacity: 0.3 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle' }}>
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        ) : (
          <button className="icon-btn edit-btn" onClick={(e) => {
            e.stopPropagation();
            setMaximizedTask(task);
            setEditTitle(task.title);
            setEditDesc(task.description || "");
            setEditAssigneeId(task.assigned_to_id || "");

            if (task.due_date) {
              setEditDueDate(task.due_date.substring(0, 10));
            } else {
              setEditDueDate("");
            }

            setIsMacEditing(false);
          }} title="Edit Task">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', opacity: 0.7 }}>
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
        )}

        {task.user_id === currentUserId && task.assigned_to_id && task.is_completed && !task.tipped_amount && (
          <button className="icon-btn edit" onClick={() => openTipModal(task)} title="Send Tip" style={{ color: '#af9f5d' }} disabled={loadingTasks.has(task.id)}>✦</button>
        )}
      </div>
    </div>
  );
}

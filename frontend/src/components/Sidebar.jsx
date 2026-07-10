import React from 'react';
import Calendar from './Calendar';
import './Sidebar.css';
import { getDeterministicColorIndex } from '../utils/helpers';

export default function Sidebar({
  isSidebarOpen,
  setIsSidebarOpen,
  tasks,
  selectedDate,
  setSelectedDate
}) {
  
  const now = new Date();
  now.setHours(0,0,0,0);

  const pendingTasks = tasks.filter(t => t.due_date && !t.is_completed);
  pendingTasks.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  const upcomingTasks = pendingTasks.slice(0, 5);

  const getDueText = (dueDateStr) => {
    const due = new Date(dueDateStr);
    due.setHours(0,0,0,0);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "1D Overdue";
    if (diffDays < -1) return `${Math.abs(diffDays)}D Overdue`;
    return `In ${diffDays}d`;
  };

  const colors = [
    "162, 178, 150",
    "224, 122, 95",
    "61, 90, 128",
    "129, 178, 154",
    "242, 204, 143",
    "212, 163, 115",
    "157, 129, 137"
  ];

  return (
    <>
      <div className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)}></div>
      <div className={`hidden-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <Calendar
          tasks={tasks}
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setIsSidebarOpen(false);
          }}
        />

        {upcomingTasks.length > 0 && (
          <div style={{ padding: '0 24px', marginTop: '64px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', opacity: 0.4, marginBottom: '16px', letterSpacing: '1px' }}>NEXT UP</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {upcomingTasks.map(task => {
                const colorIndex = getDeterministicColorIndex(task.id);
                const color = colors[colorIndex % colors.length];
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', opacity: 0.85, transition: 'opacity 0.2s ease' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.85'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: `rgb(${color})`, flexShrink: 0, boxShadow: `0 0 6px rgba(${color}, 0.8)` }}></div>
                      <span style={{ fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{task.title}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.5, flexShrink: 0, marginLeft: '16px', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>{getDueText(task.due_date)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

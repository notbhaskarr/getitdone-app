import { useEffect, useState } from "react";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import { getUserProfile } from "../api/users";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import Calendar from "../components/Calendar";
import "./Dashboard.css";

function timeAgo(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(dateString + 'Z');
  const seconds = Math.floor((new Date() - date) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " year ago" : " years ago");
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " month ago" : " months ago");
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " day ago" : " days ago");
  interval = seconds / 3600;
  if (interval >= 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " hour ago" : " hours ago");
  interval = seconds / 60;
  if (interval >= 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " minute ago" : " minutes ago");
  return "just now";
}

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [userName, setUserName] = useState("");
  const [luffies, setLuffies] = useState(0);

  const [selectedDate, setSelectedDate] = useState(null);

  const [maximizedTask, setMaximizedTask] = useState(null);
  const [isMacEditing, setIsMacEditing] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [tasksData, userData] = await Promise.all([
        getTasks(),
        getUserProfile()
      ]);
      setTasks(tasksData);
      setUserName(userData.name);
      setLuffies(userData.luffies || 0);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/");
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    const newTask = await createTask(title, description);
    setTasks([...tasks, newTask]);
    setTitle("");
    setDescription("");
    setIsCreatingTask(false);
  };

  const handleToggleComplete = async (task) => {
    const isNowCompleted = !task.is_completed;
    const reward = task.reward_luffies ?? 3;
    setLuffies(prev => isNowCompleted ? prev + reward : Math.max(0, prev - reward));

    const updated = await updateTask(task.id, { is_completed: isNowCompleted });
    setTasks(tasks.map(t => (t.id === task.id ? updated : t)));
    if (maximizedTask?.id === task.id) {
      setMaximizedTask(updated);
    }
  };

  const handleDelete = async (id) => {
    await deleteTask(id);
    setTasks(tasks.filter(t => t.id !== id));
    if (maximizedTask?.id === id) {
      setMaximizedTask(null);
    }
  };

  const handleMacSave = async () => {
    const updated = await updateTask(maximizedTask.id, { title: editTitle, description: editDesc });
    setTasks(tasks.map(t => (t.id === maximizedTask.id ? updated : t)));
    setMaximizedTask(updated);
    setIsMacEditing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="dashboard-wrapper">
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
      </div>

      <div className="dashboard-header">
        <div className="logo-container">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
            {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
              <g key={angle} transform={`rotate(${angle} 12 12)`}>
                <path d="M12 8 C14 5 15 3 13.5 1.5 M12.5 5 C15.5 5 16.5 3 17.5 1.5 M12 8 C10 6 9.5 7 7.5 4.5" />
              </g>
            ))}
          </svg>
          <h2>GETitDONE</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            {userName && <span style={{ fontFamily: 'var(--heading)', fontWeight: '500', color: 'var(--text-h)', opacity: 0.8, fontSize: '14px', lineHeight: '1' }}>{userName}</span>}
            <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: '600', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              ✦ {luffies} Whuffies
            </span>
          </div>
          <button className="logout-icon-btn" onClick={handleLogout} title="Log Out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <div className="task-list">
            {(() => {
              const filteredTasks = selectedDate
                ? tasks.filter(task => {
                  if (!task.created_at) return false;
                  const d1 = new Date(task.created_at + 'Z');
                  return d1.getFullYear() === selectedDate.getFullYear() &&
                    d1.getMonth() === selectedDate.getMonth() &&
                    d1.getDate() === selectedDate.getDate();
                })
                : tasks;

              if (filteredTasks.length === 0) {
                return <p style={{ textAlign: "center", color: "var(--text)" }}>{selectedDate ? "No tasks for this date." : "No tasks yet. Create one above!"}</p>;
              }

              return filteredTasks.map((task, index) => {
                const colors = [
                  "162, 178, 150",
                  "224, 122, 95",
                  "61, 90, 128",
                  "129, 178, 154",
                  "242, 204, 143",
                  "212, 163, 115",
                  "157, 129, 137"
                ];
                const taskColorRGB = colors[index % colors.length];

                return (
                  <div key={task.id} className={`task-card ${task.is_completed ? 'completed' : ''}`} style={{ '--task-color': taskColorRGB }}>
                    <input
                      type="checkbox"
                      className="task-checkbox"
                      checked={task.is_completed}
                      onChange={() => handleToggleComplete(task)}
                    />
                    <div className="task-content" onClick={(e) => {
                      setMaximizedTask(task);
                      setEditTitle(task.title);
                      setEditDesc(task.description || "");
                      setIsMacEditing(false);
                    }} style={{ cursor: 'pointer' }}>
                      <div className="task-title">{task.title}</div>
                      {task.description && <div className="task-desc">{task.description}</div>}
                    </div>
                    <div className="task-actions">
                      <button className="icon-btn delete" onClick={() => handleDelete(task.id)}>✖</button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

      </div>

      <button className="stealth-fab" onClick={() => setIsCreatingTask(true)} title="Add Task">
        +
      </button>

      <button className="stealth-fab left" onClick={() => setIsSidebarOpen(true)} title="Calendar">
        📅
      </button>

      {maximizedTask && (() => {
        const colors = [
          "162, 178, 150",
          "224, 122, 95",
          "61, 90, 128",
          "129, 178, 154",
          "242, 204, 143",
          "212, 163, 115",
          "157, 129, 137"
        ];
        const taskIndex = tasks.findIndex(t => t.id === maximizedTask.id);
        const colorIndex = taskIndex !== -1 ? taskIndex : 0;
        const taskColorRGB = colors[colorIndex % colors.length];

        return (
          <div className="mac-modal-overlay">
            <div className="mac-modal fullscreen" style={{ '--task-color': taskColorRGB }}>
              <div className="mac-header" style={{ justifyContent: 'space-between' }}>
                <div className="mac-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isMacEditing ? (
                    <button className="icon-btn edit" style={{ width: 'auto', padding: '0 12px', fontSize: '14px', fontWeight: 500 }} onClick={handleMacSave} title="Save">Save</button>
                  ) : (
                    <>
                      <button className="icon-btn edit" onClick={() => setIsMacEditing(true)} title="Edit">✎</button>
                      <span style={{ fontSize: '13px', opacity: 0.5, fontFamily: 'var(--sans)', marginLeft: '4px' }}>
                        Last modified {timeAgo(maximizedTask.updated_at)}
                      </span>
                    </>
                  )}
                </div>
                <div className="mac-controls">
                  <button className="mac-btn red" onClick={() => setMaximizedTask(null)} title="Close"></button>
                </div>
              </div>
              <div className="mac-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flexGrow: 1 }}>
                  {isMacEditing ? (
                    <>
                      <input
                        className="mac-title-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Task Title"
                      />
                      <textarea
                        className="mac-desc-input"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Description (optional)"
                        rows={5}
                      />
                    </>
                  ) : (
                    <>
                      <h1 className="mac-title">{maximizedTask.title}</h1>
                      {maximizedTask.description ? (
                        <ReactMarkdown className="mac-desc">{maximizedTask.description}</ReactMarkdown>
                      ) : (
                        <p className="mac-desc" style={{ opacity: 0.5 }}>No description provided.</p>
                      )}
                    </>
                  )}
                </div>

                <div className="mac-meta" style={{ marginTop: 'auto', paddingTop: '32px', fontSize: '13px', opacity: 0.5, textAlign: 'right', fontFamily: 'var(--sans)' }}>
                  <div>Created on: {maximizedTask.created_at ? new Date(maximizedTask.created_at + 'Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {isCreatingTask && (
        <div className="mac-modal-overlay">
          <div className="mac-modal fullscreen" style={{ '--task-color': '162, 178, 150' }}>
            <div className="mac-header" style={{ justifyContent: 'space-between' }}>
              <div className="mac-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="icon-btn edit" style={{ width: 'auto', padding: '0 12px', fontSize: '14px', fontWeight: 500 }} onClick={handleCreate} title="Save">Save</button>
              </div>
              <div className="mac-controls">
                <button className="mac-btn red" onClick={() => setIsCreatingTask(false)} title="Close"></button>
              </div>
            </div>
            <div className="mac-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flexGrow: 1 }}>
                <input
                  className="mac-title-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's going on?"
                  autoFocus
                />
                <textarea
                  className="mac-desc-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description and Details"
                  rows={5}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
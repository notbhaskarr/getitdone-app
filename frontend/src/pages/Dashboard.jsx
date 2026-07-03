import { useEffect, useState } from "react";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import { getUserProfile } from "../api/users";
import { useNavigate } from "react-router-dom";
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

  const [maximizedTask, setMaximizedTask] = useState(null);
  const [isMacEditing, setIsMacEditing] = useState(false);

  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [tasksData, userData] = await Promise.all([
        getTasks(),
        getUserProfile()
      ]);
      setTasks(tasksData);
      setUserName(userData.name);
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
    e.preventDefault();
    if (!title.trim()) return;

    const newTask = await createTask(title, description);
    setTasks([...tasks, newTask]);
    setTitle("");
    setDescription("");
  };

  const handleToggleComplete = async (task) => {
    const updated = await updateTask(task.id, { is_completed: !task.is_completed });
    setTasks(tasks.map(t => t.id === task.id ? updated : t));
  };

  const handleDelete = async (taskId) => {
    await deleteTask(taskId);
    setTasks(tasks.filter(t => t.id !== taskId));
  };

  const handleMacSave = async () => {
    if (!maximizedTask) return;
    const updated = await updateTask(maximizedTask.id, {
      title: editTitle,
      description: editDesc
    });
    setTasks(tasks.map(t => t.id === maximizedTask.id ? updated : t));
    setMaximizedTask(updated);
    setIsMacEditing(false);
  };

  const handleMacDelete = async () => {
    if (!maximizedTask) return;
    await deleteTask(maximizedTask.id);
    setTasks(tasks.filter(t => t.id !== maximizedTask.id));
    setMaximizedTask(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-header">
        <h2>GETitDONE</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
          {userName && <span style={{ fontFamily: 'var(--heading)', fontWeight: '500', color: 'var(--text-h)', opacity: 0.8, fontSize: '14px', lineHeight: '1' }}>{userName}</span>}
          <button className="logout-btn" style={{ fontSize: '12px' }} onClick={handleLogout}>Log Out</button>
        </div>
      </div>

      <div className="dashboard-container">
        <form className="task-form" onSubmit={handleCreate}>
          <input
            className="task-input"
            placeholder="What's going on?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="task-input"
            placeholder="Thoughts and Details"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button type="submit" className="task-submit-btn">Add the entry</button>
        </form>

        <div className="task-list">
          {tasks.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text)" }}>No tasks yet. Create one above!</p>
          ) : (
            tasks.map((task, index) => {
              const colors = [
                "162, 178, 150", // sage
                "224, 122, 95",  // dusty orange
                "61, 90, 128",   // slate
                "129, 178, 154", // mint
                "242, 204, 143", // sandy
                "212, 163, 115", // wood
                "157, 129, 137"  // mauve
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
                    console.log("Task clicked!", task);
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
            })
          )}
        </div>

      </div>
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
                    <button className="icon-btn edit" onClick={handleMacSave} title="Save">✓</button>
                  ) : (
                    <button className="icon-btn edit" onClick={() => setIsMacEditing(true)} title="Edit">✎</button>
                  )}
                  <span style={{ fontSize: '13px', opacity: 0.5, fontFamily: 'var(--sans)', marginLeft: '4px' }}>
                    Last modified {timeAgo(maximizedTask.updated_at)}
                  </span>
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
                      <p className="mac-desc">{maximizedTask.description}</p>
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
    </div>
  );
}
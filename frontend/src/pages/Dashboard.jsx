import { useEffect, useState } from "react";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import { getUserProfile } from "../api/users";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [userName, setUserName] = useState("");

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

  const openEditModal = (task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDesc(task.description || "");
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    const updated = await updateTask(editingTask.id, {
      title: editTitle,
      description: editDesc
    });
    setTasks(tasks.map(t => t.id === editingTask.id ? updated : t));
    setEditingTask(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>GETitDONE</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginTop: '28px' }}>
          {userName && <span style={{ fontFamily: 'var(--heading)', fontWeight: '500', color: 'var(--text-h)', opacity: 0.5, fontSize: '16px', lineHeight: '1', paddingRight: '16px' }}>{userName}</span>}
          <button className="logout-btn" style={{ fontSize: '12px' }} onClick={handleLogout}>Log Out</button>
        </div>
      </div>

      <form className="task-form" onSubmit={handleCreate}>
        <input
          className="task-input"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="task-input"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit" className="task-submit-btn">Add Task</button>
      </form>

      <div className="task-list">
        {tasks.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text)" }}>No tasks yet. Create one above!</p>
        ) : (
          tasks.map(task => (
            <div key={task.id} className={`task-card ${task.is_completed ? 'completed' : ''}`}>
              <input
                type="checkbox"
                className="task-checkbox"
                checked={task.is_completed}
                onChange={() => handleToggleComplete(task)}
              />
              <div className="task-content">
                <div className="task-title">{task.title}</div>
                {task.description && <div className="task-desc">{task.description}</div>}
              </div>
              <div className="task-actions">
                <button className="icon-btn edit" onClick={() => openEditModal(task)}>✎</button>
                <button className="icon-btn delete" onClick={() => handleDelete(task.id)}>✖</button>
              </div>
            </div>
          ))
        )}
      </div>

      {editingTask && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Edit Task</h3>
            <input
              className="task-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <input
              className="task-input"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditingTask(null)}>Cancel</button>
              <button className="btn-save" onClick={handleSaveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
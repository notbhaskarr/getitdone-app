import { useEffect, useState } from "react";
import { getTasks, createTask, updateTask, deleteTask } from "../api/tasks";
import { getUserProfile } from "../api/users";
import { getPeers, requestPeer, acceptPeer } from "../api/peers";
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
  const [assigneeId, setAssigneeId] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [userName, setUserName] = useState("");
  const [luffies, setLuffies] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  const [peers, setPeers] = useState([]);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [peerEmail, setPeerEmail] = useState("");

  const [selectedDate, setSelectedDate] = useState(null);

  const [maximizedTask, setMaximizedTask] = useState(null);
  const [isMacEditing, setIsMacEditing] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const [tasksData, userData, peersData] = await Promise.all([
        getTasks(),
        getUserProfile(),
        getPeers()
      ]);
      setTasks(tasksData);
      setUserName(userData.name);
      setLuffies(userData.luffies || 0);
      setCurrentUserId(userData.id);
      setPeers(peersData);
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

    try {
      const newTask = await createTask(title, description, assigneeId ? assigneeId : undefined);
      setTasks([...tasks, newTask]);
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setIsCreatingTask(false);
      // reload luffies as escrow might have deducted points
      if (assigneeId) {
        const u = await getUserProfile();
        setLuffies(u.luffies || 0);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to create task");
    }
  };

  const handleToggleComplete = async (task) => {
    // Prevent the creator from completing a task they assigned to someone else
    if (task.assigned_to_id && task.user_id === currentUserId) {
      alert("You cannot complete a task you assigned to someone else.");
      return;
    }

    const isNowCompleted = !task.is_completed;
    const reward = task.reward_luffies ?? 3;
    
    // Optimistic update
    setLuffies(prev => isNowCompleted ? prev + reward : Math.max(0, prev - reward));

    try {
      const updated = await updateTask(task.id, { is_completed: isNowCompleted });
      setTasks(tasks.map(t => (t.id === task.id ? updated : t)));
      if (maximizedTask?.id === task.id) {
        setMaximizedTask(updated);
      }
    } catch (err) {
      // Revert optimistic update on failure
      setLuffies(prev => isNowCompleted ? Math.max(0, prev - reward) : prev + reward);
      alert(err.response?.data?.detail || "Failed to update task");
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
    try {
      const updated = await updateTask(maximizedTask.id, { 
        title: editTitle, 
        description: editDesc,
        assigned_to_id: editAssigneeId ? editAssigneeId : null
      });
      setTasks(tasks.map(t => (t.id === maximizedTask.id ? updated : t)));
      setMaximizedTask(updated);
      setIsMacEditing(false);
      if (editAssigneeId !== maximizedTask.assigned_to_id) {
        const u = await getUserProfile();
        setLuffies(u.luffies || 0);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update task");
    }
  };

  const handleReject = async (id) => {
    const updated = await updateTask(id, { is_rejected: true });
    setTasks(tasks.filter(t => t.id !== id));
    if (maximizedTask?.id === id) {
      setMaximizedTask(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const handlePeerRequest = async (e) => {
    e.preventDefault();
    if (!peerEmail.trim()) return;
    try {
      await requestPeer(peerEmail);
      setPeerEmail("");
      alert("Request sent!");
      const p = await getPeers();
      setPeers(p);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to send request");
    }
  };

  const handlePeerAccept = async (connId) => {
    try {
      await acceptPeer(connId);
      const p = await getPeers();
      setPeers(p);
    } catch (err) {
      alert("Failed to accept request");
    }
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
          <button className="logout-icon-btn" onClick={() => setIsNetworkModalOpen(true)} title="Network">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </button>
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
                      disabled={task.assigned_to_id && task.user_id === currentUserId}
                      onChange={() => handleToggleComplete(task)}
                    />
                    <div className="task-content" onClick={(e) => {
                      setMaximizedTask(task);
                      setEditTitle(task.title);
                      setEditDesc(task.description || "");
                      setEditAssigneeId(task.assigned_to_id || "");
                      setIsMacEditing(false);
                    }} style={{ cursor: 'pointer' }}>
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
                      {task.user_id !== currentUserId ? (
                        <button className="icon-btn delete" onClick={() => handleReject(task.id)} title="Reject">✕</button>
                      ) : (
                        <button className="icon-btn delete" onClick={() => handleDelete(task.id)} title="Delete">✖</button>
                      )}
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
                      {maximizedTask.user_id === currentUserId && (
                        <select 
                          className="mac-desc-input"
                          style={{ marginTop: '16px', background: 'transparent', borderBottom: '1px solid var(--border)', fontSize: '14px', cursor: 'pointer', paddingBottom: '8px' }}
                          value={editAssigneeId} 
                          onChange={(e) => setEditAssigneeId(e.target.value)}
                        >
                          <option value="">Assign to... (Optional)</option>
                          {peers.filter(p => p.status === 'accepted').map(p => (
                            <option key={p.peer_id} value={p.peer_id}>{p.peer_name}</option>
                          ))}
                        </select>
                      )}
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
                <select 
                  className="mac-desc-input"
                  style={{ marginTop: '16px', background: 'transparent', borderBottom: '1px solid var(--border)', fontSize: '14px', cursor: 'pointer', paddingBottom: '8px' }}
                  value={assigneeId} 
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Assign to... (Optional)</option>
                  {peers.filter(p => p.status === 'accepted').map(p => (
                    <option key={p.peer_id} value={p.peer_id}>{p.peer_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
      {isNetworkModalOpen && (
        <div className="mac-modal-overlay">
          <div className="mac-modal" style={{ '--task-color': '61, 90, 128', width: '400px', height: 'auto', minHeight: '300px' }}>
            <div className="mac-header" style={{ justifyContent: 'space-between' }}>
              <h2 className="mac-title" style={{ fontSize: '16px', margin: 0 }}>Peer Network</h2>
              <div className="mac-controls">
                <button className="mac-btn red" onClick={() => setIsNetworkModalOpen(false)} title="Close"></button>
              </div>
            </div>
            <div className="mac-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
              <form onSubmit={handlePeerRequest} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="email"
                  value={peerEmail}
                  onChange={(e) => setPeerEmail(e.target.value)}
                  placeholder="Peer email address"
                  style={{ flexGrow: 1, padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
                />
                <button type="submit" className="icon-btn edit" style={{ padding: '0 12px', fontSize: '12px' }}>Request</button>
              </form>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.5, margin: '8px 0 0' }}>Your Connections</h3>
                {peers.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: '14px' }}>No peers yet.</p>
                ) : (
                  peers.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>{p.peer_name}</div>
                        <div style={{ fontSize: '12px', opacity: 0.5 }}>{p.peer_email}</div>
                      </div>
                      <div>
                        {p.status === 'accepted' ? (
                          <span style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>Accepted</span>
                        ) : p.is_requester ? (
                          <span style={{ fontSize: '12px', opacity: 0.5 }}>Pending</span>
                        ) : (
                          <button className="icon-btn edit" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => handlePeerAccept(p.id)}>Accept</button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
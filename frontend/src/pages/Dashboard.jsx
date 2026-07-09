import { useEffect, useState, useRef } from "react";
import { getTasks, createTask, updateTask, deleteTask, tipTask, getTaskEvents, createSubtask, updateSubtask, deleteSubtask } from "../api/tasks";
import { getUserProfile } from "../api/users";
import { getPeers, requestPeer, acceptPeer, removePeer } from "../api/peers";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import Calendar from "../components/Calendar";
import "./Dashboard.css";

function formatTimestamp(dateString) {
  if (!dateString) return "Unknown";
  const date = new Date(dateString.endsWith('Z') ? dateString : dateString + 'Z');

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

const getDeterministicColorIndex = (uuid) => {
  if (!uuid) return 0;
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [userName, setUserName] = useState("");
  const [luffies, setLuffies] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);

  const [peers, setPeers] = useState([]);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [peerEmail, setPeerEmail] = useState("");
  const [requestBtnText, setRequestBtnText] = useState("Request");

  const [selectedDate, setSelectedDate] = useState(null);

  const [maximizedTask, setMaximizedTask] = useState(null);
  const [isMacEditing, setIsMacEditing] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [taskActivities, setTaskActivities] = useState({});
  const [loadingTasks, setLoadingTasks] = useState(new Set());
  const [taskFilter, setTaskFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [tippingTask, setTippingTask] = useState(null);
  const [tipAmount, setTipAmount] = useState("");
  const [onlinePeers, setOnlinePeers] = useState(new Set());
  const [activeSubtaskTask, setActiveSubtaskTask] = useState(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const subtaskModalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (subtaskModalRef.current && !subtaskModalRef.current.contains(event.target)) {
        setActiveSubtaskTask(null);
      }
    };
    if (activeSubtaskTask) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeSubtaskTask]);

  useEffect(() => {
    if (maximizedTask) {
      const taskId = maximizedTask.id;
      if (!taskActivities[taskId]) {
        getTaskEvents(taskId).then(evts => {
          setTaskActivities(prev => ({ ...prev, [taskId]: evts }));
        }).catch(err => console.error("Failed to fetch events", err));
      }
    }
  }, [maximizedTask]);

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

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const baseUrl = import.meta.env.VITE_API_URL || "https://getitdone-app.onrender.com";
    const wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://") + `/ws/${token}`;

    let ws;
    try {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "online_peers") {
            setOnlinePeers(new Set(msg.peers));
          } else if (msg.type === "peer_online") {
            setOnlinePeers(prev => new Set(prev).add(msg.peer_id));
          } else if (msg.type === "peer_offline") {
            setOnlinePeers(prev => {
              const next = new Set(prev);
              next.delete(msg.peer_id);
              return next;
            });
          } else if (msg.type === "NOTIFICATION") {
            const notifId = Date.now();
            setNotifications(prev => [...prev, { id: notifId, ...msg }]);

            // Auto dismiss after 5s
            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== notifId));
            }, 5000);

            // Auto refresh state
            loadData();
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onerror = (e) => console.error("WebSocket error", e);
    } catch (e) {
      console.error("Failed to setup WebSocket", e);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const handleCreate = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    try {
      const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : undefined;
      const newTask = await createTask(title, description, assigneeId ? assigneeId : undefined, formattedDueDate);
      setTasks([...tasks, newTask]);
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setDueDate("");
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
    if (loadingTasks.has(task.id)) return;
    setLoadingTasks(prev => new Set(prev).add(task.id));

    // Prevent the creator from completing a task they assigned to someone else
    if (task.assigned_to_id && task.user_id === currentUserId) {
      alert("You cannot complete a task you assigned to someone else.");
      setLoadingTasks(prev => { const next = new Set(prev); next.delete(task.id); return next; });
      return;
    }

    const isNowCompleted = !task.is_completed;
    const reward = task.reward_luffies ?? 3;

    // Optimistic update
    setLuffies(prev => isNowCompleted ? prev + reward : Math.max(0, prev - reward));
    setTasks(tasks.map(t => t.id === task.id ? { ...t, is_completed: isNowCompleted } : t));

    try {
      const updated = await updateTask(task.id, { is_completed: isNowCompleted });
      setTasks(tasks => tasks.map(t => (t.id === task.id ? { ...t, ...updated, subtasks: t.subtasks } : t)));
      if (maximizedTask?.id === task.id) {
        setMaximizedTask(prev => ({ ...prev, ...updated, subtasks: prev.subtasks }));
      }
    } catch (err) {
      // Revert optimistic update on failure
      setLuffies(prev => isNowCompleted ? Math.max(0, prev - reward) : prev + reward);
      setTasks(tasks => tasks.map(t => t.id === task.id ? { ...t, is_completed: !isNowCompleted } : t));
      alert(err.response?.data?.detail || "Failed to update task");
    } finally {
      setLoadingTasks(prev => { const next = new Set(prev); next.delete(task.id); return next; });
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
      const formattedDueDate = editDueDate ? new Date(editDueDate).toISOString() : null;
      const updated = await updateTask(maximizedTask.id, {
        title: editTitle,
        description: editDesc,
        assigned_to_id: editAssigneeId ? editAssigneeId : null,
        due_date: formattedDueDate
      });
      setTasks(tasks.map(t => (t.id === maximizedTask.id ? { ...t, ...updated, subtasks: t.subtasks } : t)));
      setMaximizedTask(prev => ({ ...prev, ...updated, subtasks: prev.subtasks }));
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

  const handleCreateSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || !activeSubtaskTask) return;
    
    const tempId = 'temp-' + Date.now();
    const tempSubtask = { id: tempId, title: newSubtaskTitle, is_completed: false, task_id: activeSubtaskTask.id };
    const titleToCreate = newSubtaskTitle;
    setNewSubtaskTitle("");
    
    // Optimistic Update
    setTasks(prevTasks => {
      const newTasks = prevTasks.map(t => {
        if (t.id === activeSubtaskTask.id) {
          const subtasks = t.subtasks ? [...t.subtasks, tempSubtask] : [tempSubtask];
          const updated = { ...t, subtasks };
          if (activeSubtaskTask?.id === t.id) setActiveSubtaskTask(updated);
          return updated;
        }
        return t;
      });
      return newTasks;
    });
    
    try {
      const newSubtask = await createSubtask(activeSubtaskTask.id, titleToCreate);
      
      // Replace temp subtask with real one
      setTasks(prevTasks => {
        const newTasks = prevTasks.map(t => {
          if (t.id === activeSubtaskTask.id && t.subtasks) {
            const subtasks = t.subtasks.map(st => st.id === tempId ? newSubtask : st);
            const replaced = { ...t, subtasks };
            if (activeSubtaskTask?.id === t.id) setActiveSubtaskTask(replaced);
            return replaced;
          }
          return t;
        });
        return newTasks;
      });
    } catch (err) {
      // Revert optimistic update
      setTasks(prevTasks => {
        const newTasks = prevTasks.map(t => {
          if (t.id === activeSubtaskTask.id && t.subtasks) {
            const subtasks = t.subtasks.filter(st => st.id !== tempId);
            const reverted = { ...t, subtasks };
            if (activeSubtaskTask?.id === t.id) setActiveSubtaskTask(reverted);
            return reverted;
          }
          return t;
        });
        return newTasks;
      });
      alert(err.response?.data?.detail || "Failed to create subtask");
    }
  };

  const handleToggleSubtask = async (taskId, subtaskId, currentStatus) => {
    // Prevent toggling temp subtasks while they are saving
    if (subtaskId.toString().startsWith('temp-')) return;

    // Optimistic Update
    setTasks(prevTasks => {
      const newTasks = prevTasks.map(t => {
        if (t.id === taskId && t.subtasks) {
          const subtasks = t.subtasks.map(st => st.id === subtaskId ? { ...st, is_completed: !currentStatus } : st);
          const updated = { ...t, subtasks };
          if (activeSubtaskTask?.id === taskId) setActiveSubtaskTask(updated);
          return updated;
        }
        return t;
      });
      return newTasks;
    });

    try {
      await updateSubtask(subtaskId, { is_completed: !currentStatus });
    } catch (err) {
      // Revert on failure
      setTasks(prevTasks => {
        const newTasks = prevTasks.map(t => {
          if (t.id === taskId && t.subtasks) {
            const subtasks = t.subtasks.map(st => st.id === subtaskId ? { ...st, is_completed: currentStatus } : st);
            const reverted = { ...t, subtasks };
            if (activeSubtaskTask?.id === taskId) setActiveSubtaskTask(reverted);
            return reverted;
          }
          return t;
        });
        return newTasks;
      });
      alert(err.response?.data?.detail || "Failed to update subtask");
    }
  };

  const openTipModal = (task) => {
    if (loadingTasks.has(task.id)) return;
    setTippingTask(task);
    setTipAmount("");
  };

  const submitTip = async (e) => {
    e.preventDefault();
    if (!tippingTask) return;

    const amount = parseInt(tipAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    setLoadingTasks(prev => new Set(prev).add(tippingTask.id));
    const taskObj = tippingTask;
    setTippingTask(null);

    try {
      const updated = await tipTask(taskObj.id, amount);
      setTasks(tasks => tasks.map(t => t.id === taskObj.id ? updated : t));

      const u = await getUserProfile();
      setLuffies(u.luffies || 0);

      // refresh events if open
      if (expandedActivity === taskObj.id) {
        const evts = await getTaskEvents(taskObj.id);
        setTaskActivities(prev => ({ ...prev, [taskObj.id]: evts }));
      }
    } catch (error) {
      alert(error.response?.data?.detail || "Failed to tip");
    } finally {
      setLoadingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskObj.id);
        return next;
      });
    }
  };



  const handlePeerRequest = async (e) => {
    e.preventDefault();
    if (!peerEmail.trim()) return;
    try {
      await requestPeer(peerEmail);
      setPeerEmail("");
      setRequestBtnText("Sent");
      setTimeout(() => setRequestBtnText("Request"), 3000);
      const p = await getPeers();
      setPeers(p);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to send request");
    }
  };

  const handlePeerAccept = async (connId) => {
    try {
      await acceptPeer(connId);
      const peersData = await getPeers();
      setPeers(peersData.peers || []);
    } catch (err) {
      alert("Failed to accept request");
    }
  };

  const handlePeerRemove = async (connId) => {
    if (!window.confirm("Are you sure you want to remove this peer?")) return;
    try {
      await removePeer(connId);
      const peersData = await getPeers();
      setPeers(peersData.peers || []);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to remove peer");
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


      <div style={{ padding: '0 24px', display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {['All', 'To Do', 'Delegated', 'Completed'].map(f => {
          const key = f.toLowerCase().replace(' ', '');
          const isActive = taskFilter === key;
          return (
            <button
              key={key}
              onClick={() => setTaskFilter(key)}
              style={{
                background: isActive ? 'rgba(253, 246, 227, 0.2)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(253, 246, 227, 0.5)' : 'rgba(253, 246, 227, 0.1)'}`,
                color: isActive ? 'var(--text-h)' : 'var(--text-p)',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: isActive ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                whiteSpace: 'nowrap'
              }}
            >
              {f}
            </button>
          )
        })}
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-main" style={{ position: 'relative' }}>
          {activeSubtaskTask && (() => {
            const colors = [
              "162, 178, 150",
              "224, 122, 95",
              "61, 90, 128",
              "129, 178, 154",
              "242, 204, 143",
              "212, 163, 115",
              "157, 129, 137"
            ];
            const colorIndex = getDeterministicColorIndex(activeSubtaskTask.id);
            const taskColorRGB = colors[colorIndex % colors.length];

            return (
              <div className="subtask-modal-overlay">
                <div ref={subtaskModalRef} className="subtask-modal" style={{ '--task-color': taskColorRGB }}>
                  <div className="subtask-header">
                    <h2>{activeSubtaskTask.title}</h2>
                  </div>
                  <div className="subtask-list">
                    {(activeSubtaskTask.subtasks || []).map(st => (
                      <div key={st.id} className="subtask-item">
                        <input 
                          type="checkbox" 
                          className="task-checkbox subtask-checkbox"
                          checked={st.is_completed} 
                          onChange={() => handleToggleSubtask(activeSubtaskTask.id, st.id, st.is_completed)}
                        />
                        <span className={`subtask-title ${st.is_completed ? 'completed' : ''}`}>
                          {st.title}
                        </span>
                        <button className="delete-subtask-btn" onClick={async () => {
                          // Prevent deleting temp subtasks
                          if (st.id.toString().startsWith('temp-')) return;

                          // Save state for revert
                          const taskId = activeSubtaskTask.id;
                          let originalTaskState = null;

                          // Optimistic Delete
                          setTasks(prevTasks => {
                            const newTasks = prevTasks.map(t => {
                              if (t.id === taskId && t.subtasks) {
                                originalTaskState = { ...t };
                                const subtasks = t.subtasks.filter(s => s.id !== st.id);
                                const updated = { ...t, subtasks };
                                if (activeSubtaskTask?.id === taskId) setActiveSubtaskTask(updated);
                                return updated;
                              }
                              return t;
                            });
                            return newTasks;
                          });

                          try {
                            await deleteSubtask(st.id);
                          } catch(err) {
                            // Revert on failure
                            if (originalTaskState) {
                              setTasks(prevTasks => {
                                const newTasks = prevTasks.map(t => {
                                  if (t.id === taskId) {
                                    if (activeSubtaskTask?.id === taskId) setActiveSubtaskTask(originalTaskState);
                                    return originalTaskState;
                                  }
                                  return t;
                                });
                                return newTasks;
                              });
                            }
                            alert("Failed to delete subtask");
                          }
                        }}>✕</button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleCreateSubtask} className="subtask-input-container">
                    <button type="button" onClick={handleCreateSubtask} className="subtask-add-btn">+</button>
                    <input 
                      type="text" 
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add a subtask..." 
                      className="subtask-input"
                      autoFocus
                    />
                  </form>
                </div>
              </div>
            );
          })()}

          <div className="task-list">
            {(() => {
              let filteredTasks = selectedDate
                ? tasks.filter(task => {
                  if (!task.created_at) return false;
                  const taskYMD = task.created_at.substring(0, 10);
                  const selY = selectedDate.getFullYear();
                  const selM = String(selectedDate.getMonth() + 1).padStart(2, '0');
                  const selD = String(selectedDate.getDate()).padStart(2, '0');
                  return taskYMD === `${selY}-${selM}-${selD}`;
                })
                : [...tasks];

              if (taskFilter === 'todo') {
                filteredTasks = filteredTasks.filter(t => !t.is_completed && (!t.assigned_to_id || t.assigned_to_id === currentUserId));
              } else if (taskFilter === 'delegated') {
                filteredTasks = filteredTasks.filter(t => t.user_id === currentUserId && t.assigned_to_id && t.assigned_to_id !== currentUserId);
              } else if (taskFilter === 'completed') {
                filteredTasks = filteredTasks.filter(t => t.is_completed);
              }

              filteredTasks.sort((a, b) => {
                if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
                if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
                if (a.due_date) return -1;
                if (b.due_date) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
              });

              if (filteredTasks.length === 0) {
                return <p style={{ textAlign: "center", color: "var(--text)" }}>{selectedDate ? "No tasks for this date." : "No tasks yet. Create one!"}</p>;
              }

              return filteredTasks.map((task) => {
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

                return (
                  <div key={task.id} className={`task-card ${task.is_completed ? 'completed' : ''}`} style={{ '--task-color': taskColorRGB }}>
                    <input
                      type="checkbox"
                      className="task-checkbox"
                      checked={task.is_completed}
                      disabled={(task.assigned_to_id && task.user_id === currentUserId) || loadingTasks.has(task.id)}
                      onChange={() => handleToggleComplete(task)}
                      style={{ 
                        '--progress': task.subtasks && task.subtasks.length > 0 
                          ? `${(task.subtasks.filter(st => st.is_completed).length / task.subtasks.length) * 100}%` 
                          : '0%' 
                      }}
                    />

                    <div className="task-content" onClick={(e) => {
                      setActiveSubtaskTask(task);
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

                      {task.user_id === currentUserId && task.assigned_to_id && task.is_completed && !task.tipped_amount && (
                        <button className="icon-btn edit" onClick={() => openTipModal(task)} title="Send Tip" style={{ color: '#af9f5d' }} disabled={loadingTasks.has(task.id)}>✦</button>
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
        const colorIndex = getDeterministicColorIndex(maximizedTask.id);
        const taskColorRGB = colors[colorIndex % colors.length];

        return (
          <div className="mac-modal-overlay">
            <div className="mac-modal fullscreen" style={{ '--task-color': taskColorRGB }}>
              <div className="mac-header" style={{ justifyContent: 'space-between' }}>
                <div className="mac-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {isMacEditing ? (
                    <button className="mac-pill-select" style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', fontWeight: 600, padding: '6px 16px', height: '32px', display: 'flex', alignItems: 'center' }} onClick={handleMacSave} title="Save">Save</button>
                  ) : (
                    <>
                      <button className="icon-btn edit" onClick={() => setIsMacEditing(true)} title="Edit">✎</button>
                      <span style={{ fontSize: '13px', opacity: 0.5, fontFamily: 'var(--sans)', marginLeft: '4px' }}>
                        Last modified {formatTimestamp(maximizedTask.updated_at)}
                      </span>
                    </>
                  )}
                </div>
                <div className="mac-controls" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {maximizedTask.user_id === currentUserId ? (
                    <button className="icon-btn delete" onClick={() => { handleDelete(maximizedTask.id); setMaximizedTask(null); }} title="Delete Task" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  ) : (
                    <button className="icon-btn delete" onClick={() => { handleReject(maximizedTask.id); setMaximizedTask(null); }} title="Reject Task" style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    </button>
                  )}
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
                        placeholder="What needs to be done?"
                      />
                      <textarea
                        className="mac-desc-input"
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Add details, links, or notes..."
                        rows={5}
                      />
                      {maximizedTask.user_id === currentUserId && (
                        <select
                          className="mac-pill-select"
                          style={{ marginTop: '24px', width: '250px', display: 'block' }}
                          value={editAssigneeId}
                          onChange={(e) => setEditAssigneeId(e.target.value)}
                        >
                          <option value="">Unassigned</option>
                          {peers.filter(p => p.status === 'accepted').map(p => (
                            <option key={p.peer_id} value={p.peer_id}>Assign to: {p.peer_name}</option>
                          ))}
                        </select>
                      )}
                      <input
                        type="date"
                        className="mac-pill-date"
                        style={{ marginTop: '12px', width: '250px', display: 'block' }}
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                      />
                    </>
                  ) : (
                    <>
                      <h1 className="mac-title">{maximizedTask.title}</h1>
                      
                      {maximizedTask.due_date && (
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-h)', opacity: 0.9, marginTop: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          Due Date: {new Date(maximizedTask.due_date.substring(0, 10)).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                        </div>
                      )}

                      {maximizedTask.description ? (
                        <div className="mac-desc">
                          <ReactMarkdown>{maximizedTask.description}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="mac-desc" style={{ opacity: 0.5 }}>No description provided.</p>
                      )}
                    </>
                  )}
                </div>

                <div className="mac-meta" style={{ marginTop: 'auto', paddingTop: '32px', fontSize: '13px', opacity: 0.5, textAlign: 'right', fontFamily: 'var(--sans)', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>Created on: {maximizedTask.created_at ? new Date(maximizedTask.created_at + 'Z').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}</div>
                </div>

                {!isMacEditing && (
                  <div className="task-activity-panel" style={{ marginTop: '24px', paddingBottom: '32px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-h)', marginBottom: '16px', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Activity History</h3>
                    {taskActivities[maximizedTask.id] ? (
                      taskActivities[maximizedTask.id].length > 0 ? (
                        <div className="activity-list">
                          {taskActivities[maximizedTask.id].map(evt => {
                            let messageNode;
                            if (evt.event_type === "ASSIGNED") {
                              if (evt.details && evt.details.includes("Assigned to peer")) {
                                const peerId = evt.details.replace("Assigned to peer ", "");
                                let peerName = "someone";
                                if (peerId === currentUserId) {
                                  peerName = "you";
                                } else {
                                  const peerObj = peers.find(p => p.peer_id === peerId);
                                  if (peerObj) peerName = peerObj.peer_name;
                                }
                                messageNode = <span className="activity-message"> - {evt.user_name} <strong>assigned</strong> the task to {peerName}.</span>;
                              } else {
                                messageNode = <span className="activity-message"> - {evt.user_name} <strong>assigned</strong> the task{evt.details ? ` - ${evt.details}` : ''}</span>;
                              }
                            } else {
                              messageNode = <span className="activity-message"> - {evt.user_name} <strong>{evt.event_type.toLowerCase()}</strong>{['REOPENED', 'COMPLETED', 'CREATED', 'REJECTED'].includes(evt.event_type) ? ' the task.' : ''}{evt.details && evt.event_type !== 'TIPPED' ? ` - ${evt.details}` : ''}{evt.event_type === 'TIPPED' ? ` ${evt.details.replace('Tipped ', '')}` : ''}</span>;
                            }

                            return (
                              <div key={evt.id} className="activity-item">
                                <span className="activity-time">{formatTimestamp(evt.created_at)}</span>
                                {messageNode}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="activity-empty">No activity recorded.</div>
                      )
                    ) : (
                      <div className="activity-loading">Loading...</div>
                    )}
                  </div>
                )}
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
                <button className="mac-pill-select" style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', fontWeight: 600, padding: '6px 16px', height: '32px', display: 'flex', alignItems: 'center' }} onClick={handleCreate} title="Save">Save</button>
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
                  placeholder="What needs to be done?"
                  autoFocus
                />
                <textarea
                  className="mac-desc-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details, links, or notes..."
                  rows={5}
                />
                <select
                  className="mac-pill-select"
                  style={{ marginTop: '24px', width: '250px', display: 'block' }}
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {peers.filter(p => p.status === 'accepted').map(p => (
                    <option key={p.peer_id} value={p.peer_id}>Assign to: {p.peer_name}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="mac-pill-date"
                  style={{ marginTop: '12px', width: '250px', display: 'block' }}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {isNetworkModalOpen && (
        <div className="mac-modal-overlay">
          <div className="mac-modal" style={{ '--task-color': '253, 246, 227', width: '400px', height: 'auto', minHeight: '300px' }}>
            <div className="mac-header" style={{ justifyContent: 'space-between' }}>
              <h2 className="mac-title" style={{ fontSize: '16px', margin: 0 }}>Peer Network</h2>
              <div className="mac-controls">
                <button className="mac-btn red" onClick={() => setIsNetworkModalOpen(false)} title="Close"></button>
              </div>
            </div>
            <div className="mac-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
              <form onSubmit={handlePeerRequest} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={peerEmail}
                  onChange={(e) => setPeerEmail(e.target.value)}
                  placeholder="Peer username"
                  style={{ flexGrow: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', borderRadius: '6px', color: 'var(--text)' }}
                />
                <button type="submit" className="icon-btn edit" style={{ padding: '0 12px', fontSize: '12px' }}>{requestBtnText}</button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.5, margin: '8px 0 0' }}>Your Connections</h3>
                {peers.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: '14px' }}>No peers yet.</p>
                ) : (
                  peers.map(p => (
                    <div key={p.id} className="peer-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'rgba(253, 246, 227, 0.03)' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {p.peer_name}
                          {p.status === 'accepted' && onlinePeers.has(p.peer_id) && (
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4ade80', boxShadow: '0 0 6px #4ade80' }} title="Online"></span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.5 }}>@{p.peer_email}</div>
                      </div>
                      <div className="peer-status-container">
                        {p.status === 'accepted' ? (
                          <>
                            <span className="peer-status-text" style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 'bold' }}>Accepted</span>
                            <button className="peer-remove-btn" onClick={() => handlePeerRemove(p.id)} title="Remove Peer">✖</button>
                          </>
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

      {tippingTask && (
        <div className="mac-modal-overlay">
          <div className="mac-modal" style={{ '--task-color': '253, 246, 227', width: '320px', height: 'auto' }}>
            <div className="mac-header" style={{ justifyContent: 'space-between' }}>
              <h2 className="mac-title" style={{ fontSize: '16px', margin: 0 }}>Tip Whuffies</h2>
              <div className="mac-controls">
                <button className="mac-btn red" onClick={() => setTippingTask(null)} title="Close"></button>
              </div>
            </div>
            <div className="mac-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
                How many whuffies would you like to tip <strong>{peers.find(p => p.peer_id === tippingTask.assigned_to_id)?.peer_name || 'them'}</strong> for this task?
              </p>
              <form onSubmit={submitTip} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  min="1"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="Amount"
                  autoFocus
                  style={{ flexGrow: 1, padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)' }}
                />
                <button type="submit" className="icon-btn edit" style={{ padding: '0 16px', fontSize: '14px', color: '#af9f5d' }}>Tip</button>
              </form>
            </div>
          </div>
        </div>
      )}





      <div className="mac-toast-container">
        {notifications.map(notif => (
          <div key={notif.id} className="mac-toast" onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}>
            <div className="toast-message">
              <strong>{notif.actor}</strong> {notif.action} <strong>{notif.task_title}</strong>{notif.event === 'TIPPED' ? '!' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
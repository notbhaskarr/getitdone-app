import { useEffect, useState, useRef } from "react";
import { getTasks, createTask, updateTask, deleteTask, tipTask, getTaskEvents, createSubtask, updateSubtask, deleteSubtask } from "../api/tasks";
import { getUserProfile } from "../api/users";
import { getPeers, requestPeer, acceptPeer, removePeer } from "../api/peers";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from 'react-markdown';
import Sidebar from "../components/Sidebar";
import TaskDetailsModal from "../components/TaskDetailsModal";
import NetworkModal from "../components/NetworkModal";
import "./Dashboard.css";

import { formatTimestamp, getDeterministicColorIndex } from "../utils/helpers";
import TaskCard from "../components/TaskCard";
import { useAppContext } from "../context/AppContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    tasks, setTasks,
    userName,
    luffies, setLuffies,
    currentUserId,
    peers, setPeers,
    onlinePeers,
    notifications, setNotifications,
    loadingTasks, setLoadingTasks,
    taskActivities, setTaskActivities,
    loadData,
    logoutUser,
    archivedTasks
  } = useAppContext();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [peerEmail, setPeerEmail] = useState("");
  const [requestBtnText, setRequestBtnText] = useState("Request");

  const [selectedDate, setSelectedDate] = useState(null);

  const [maximizedTask, setMaximizedTask] = useState(null);
  const [isMacEditing, setIsMacEditing] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [taskFilter, setTaskFilter] = useState('all');
  const [tippingTask, setTippingTask] = useState(null);
  const [tipAmount, setTipAmount] = useState("");
  const [isTippingFlying, setIsTippingFlying] = useState(false);
  const [activeSubtaskTask, setActiveSubtaskTask] = useState(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const subtaskModalRef = useRef(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [showMoreTags, setShowMoreTags] = useState(false);

  const [customOrder, setCustomOrder] = useState(null);
  const [draggedTaskId, setDraggedTaskId] = useState(null);

  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetTaskId, currentSortedIds) => {
    e.preventDefault();
    const sourceTaskId = e.dataTransfer.getData("text/plain");
    if (!sourceTaskId || sourceTaskId === targetTaskId) return;

    const sourceIndex = currentSortedIds.indexOf(sourceTaskId);
    const targetIndex = currentSortedIds.indexOf(targetTaskId);

    if (sourceIndex > -1 && targetIndex > -1) {
      const newOrder = [...currentSortedIds];
      newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, sourceTaskId);
      setCustomOrder(newOrder);
    }
    setDraggedTaskId(null);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
  };

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
  }, [maximizedTask, taskActivities, setTaskActivities]);

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
    logoutUser();
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
    if (!tippingTask || isTippingFlying) return;

    const amount = parseInt(tipAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive number.");
      return;
    }

    setIsTippingFlying(true);
    setTimeout(async () => {
      setLoadingTasks(prev => new Set(prev).add(tippingTask.id));
      const taskObj = tippingTask;
      setTippingTask(null);
      setIsTippingFlying(false);

      try {
        const updated = await tipTask(taskObj.id, amount);
        setTasks(tasks => tasks.map(t => t.id === taskObj.id ? updated : t));

        const u = await getUserProfile();
        setLuffies(u.luffies || 0);

        // refresh events if open
        if (maximizedTask?.id === taskObj.id) {
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
    }, 400);
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
      setPeers(peersData || []);
    } catch (err) {
      alert("Failed to accept request");
    }
  };

  const handlePeerRemove = async (connId) => {
    if (!window.confirm("Are you sure you want to remove this peer?")) return;
    try {
      await removePeer(connId);
      const peersData = await getPeers();
      setPeers(peersData || []);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to remove peer");
    }
  };

  // 1. Base Filter (Date & Status)
  let baseTasks = tasks.filter(t => !archivedTasks.has(t.id));
  if (selectedDate) {
    baseTasks = baseTasks.filter(task => {
      if (!task.created_at) return false;
      const taskYMD = task.created_at.substring(0, 10);
      const selY = selectedDate.getFullYear();
      const selM = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const selD = String(selectedDate.getDate()).padStart(2, '0');
      return taskYMD === `${selY}-${selM}-${selD}`;
    });
  }

  if (taskFilter === 'todo') {
    baseTasks = baseTasks.filter(t => !t.is_completed && (!t.assigned_to_id || t.assigned_to_id === currentUserId));
  } else if (taskFilter === 'delegated') {
    baseTasks = baseTasks.filter(t => t.user_id === currentUserId && t.assigned_to_id && t.assigned_to_id !== currentUserId);
  } else if (taskFilter === 'completed') {
    baseTasks = baseTasks.filter(t => t.is_completed);
  }

  // 2. Compute Context-Aware Tags
  const tagCounts = {};
  const tagColors = {};
  const taskColorsList = [
    "162, 178, 150",
    "224, 122, 95",
    "61, 90, 128",
    "129, 178, 154",
    "242, 204, 143",
    "212, 163, 115",
    "157, 129, 137"
  ];

  baseTasks.forEach(t => {
    const text = (t.title + " " + (t.description || "")).toLowerCase();
    const matches = text.match(/(#[a-z0-9_]+)/g) || [];
    const uniqueMatches = Array.from(new Set(matches));
    
    if (uniqueMatches.length > 0) {
      const colorIndex = getDeterministicColorIndex(t.id);
      const color = taskColorsList[colorIndex % taskColorsList.length];
      
      uniqueMatches.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        if (!tagColors[tag]) {
          tagColors[tag] = color;
        }
      });
    }
  });

  const availableTags = Object.keys(tagCounts).sort((a, b) => {
    if (tagCounts[b] !== tagCounts[a]) {
      return tagCounts[b] - tagCounts[a]; // Sort by frequency descending
    }
    return a.localeCompare(b); // Then alphabetically
  });

  const tagsToDisplay = [...availableTags];
  
  [...selectedTags].reverse().forEach(tag => {
    const idx = tagsToDisplay.indexOf(tag);
    if (idx !== -1) {
      tagsToDisplay.splice(idx, 1);
    }
    tagsToDisplay.unshift(tag);
  });

  const visibleTags = tagsToDisplay.slice(0, 2);
  const hiddenTags = tagsToDisplay.slice(2);

  // 3. Apply Tag Filter & Sort
  let finalTasks = [...baseTasks];
  if (selectedTags.length > 0) {
    finalTasks = finalTasks.filter(t => {
      const text = (t.title + " " + (t.description || "")).toLowerCase();
      return selectedTags.some(tag => text.includes(tag));
    });
  }

  if (customOrder) {
    finalTasks.sort((a, b) => {
      const idxA = customOrder.indexOf(a.id);
      const idxB = customOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  } else {
    finalTasks.sort((a, b) => {
      if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
      if (a.due_date && b.due_date) return new Date(a.due_date) - new Date(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  const currentSortedIds = finalTasks.map(t => t.id);

  return (
    <div className="dashboard-wrapper">
      <Sidebar 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        tasks={tasks}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />

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


      <div style={{ position: 'relative' }}>
        <div style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
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

          {tagsToDisplay.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto', position: 'relative' }}>
              <div style={{ width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 }}></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {visibleTags.map(tag => {
                  const isActive = selectedTags.includes(tag);
                  const toggleTag = () => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
                  const tColor = tagColors[tag] || '170, 59, 255';

                  return (
                    <button
                      key={tag}
                      onClick={toggleTag}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isActive ? `rgb(${tColor})` : 'var(--text)',
                        padding: '4px 2px',
                        fontSize: '13px',
                        fontWeight: isActive ? '700' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--mono)'
                      }}
                    >
                      {tag}
                    </button>
                  )
                })}
              {hiddenTags.length > 0 && !showMoreTags && (
                <button
                  onClick={() => setShowMoreTags(true)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--sans)'
                  }}
                >
                  +{hiddenTags.length} more
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invisible overlay to close tags when clicking outside */}
        {showMoreTags && (
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9 }}
            onClick={() => setShowMoreTags(false)}
          />
        )}

        {/* Render expanded tags outside the overflow-x container so they don't get clipped */}
        {showMoreTags && hiddenTags.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: '24px', 
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: '8px',
            zIndex: 10,
            maxWidth: '400px'
          }}>
            {hiddenTags.map(tag => {
              const isActive = selectedTags.includes(tag);
              const toggleTag = () => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
              const tColor = tagColors[tag] || '170, 59, 255';
              
              return (
                <button
                  key={tag}
                  onClick={toggleTag}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isActive ? `rgb(${tColor})` : 'var(--text)',
                    padding: '4px 2px',
                    fontSize: '13px',
                    fontWeight: isActive ? '700' : '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'var(--mono)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        )}
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
              if (finalTasks.length === 0) {
                return <p style={{ textAlign: "center", color: "var(--text)" }}>{selectedDate ? "No tasks for this date." : "No tasks yet. Create one!"}</p>;
              }

              return finalTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentUserId={currentUserId}
                  loadingTasks={loadingTasks}
                  peers={peers}
                  handleToggleComplete={handleToggleComplete}
                  setActiveSubtaskTask={setActiveSubtaskTask}
                  setMaximizedTask={setMaximizedTask}
                  setEditTitle={setEditTitle}
                  setEditDesc={setEditDesc}
                  setEditAssigneeId={setEditAssigneeId}
                  setEditDueDate={setEditDueDate}
                  setIsMacEditing={setIsMacEditing}
                  openTipModal={openTipModal}
                  dragProps={{
                    draggable: true,
                    onDragStart: (e) => handleDragStart(e, task.id),
                    onDragOver: handleDragOver,
                    onDrop: (e) => handleDrop(e, task.id, currentSortedIds),
                    onDragEnd: handleDragEnd,
                    isDragged: draggedTaskId === task.id
                  }}
                />
              ));
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

      {maximizedTask && (
        <TaskDetailsModal
          maximizedTask={maximizedTask}
          setMaximizedTask={setMaximizedTask}
          isMacEditing={isMacEditing}
          setIsMacEditing={setIsMacEditing}
          currentUserId={currentUserId}
          peers={peers}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editDesc={editDesc}
          setEditDesc={setEditDesc}
          editAssigneeId={editAssigneeId}
          setEditAssigneeId={setEditAssigneeId}
          editDueDate={editDueDate}
          setEditDueDate={setEditDueDate}
          handleMacSave={handleMacSave}
          handleDelete={handleDelete}
          handleReject={handleReject}
          taskActivities={taskActivities}
        />
      )}

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
      <NetworkModal 
        isNetworkModalOpen={isNetworkModalOpen}
        setIsNetworkModalOpen={setIsNetworkModalOpen}
        peerEmail={peerEmail}
        setPeerEmail={setPeerEmail}
        requestBtnText={requestBtnText}
        handlePeerRequest={handlePeerRequest}
        peers={peers}
        onlinePeers={onlinePeers}
        handlePeerRemove={handlePeerRemove}
        handlePeerAccept={handlePeerAccept}
      />

      {tippingTask && (
        <div className="subtask-modal-overlay">
          <div className="subtask-modal" style={{ '--task-color': '129, 178, 154', width: '320px', height: 'auto', padding: 0, overflow: 'hidden' }}>
            <div className="mac-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="mac-title" style={{ fontSize: '16px', margin: 0, lineHeight: 1 }}>Appreciate {peers.find(p => p.peer_id === tippingTask.assigned_to_id)?.peer_name || 'Peer'}</h2>
              <div className="mac-controls" style={{ display: 'flex', alignItems: 'center' }}>
                <button className="mac-btn red" onClick={() => setTippingTask(null)} title="Close"></button>
              </div>
            </div>
            <div className="mac-content" style={{ display: 'flex', flexDirection: 'column', padding: '16px', background: 'transparent' }}>
              <form onSubmit={submitTip} style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                <input
                  type="number"
                  min="1"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="Enter whuffies"
                  autoFocus
                  style={{ flexGrow: 1, padding: '10px 12px', background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', borderRadius: '6px', color: 'var(--text)', boxSizing: 'border-box' }}
                />
                <button type="submit" className={`icon-btn edit ${isTippingFlying ? 'fly-away' : ''}`} style={{ width: 'auto', padding: '0 8px', fontSize: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', background: 'transparent' }} title="Send Whuffies">🕊️</button>
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
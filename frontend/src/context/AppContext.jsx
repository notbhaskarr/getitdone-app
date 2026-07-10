import React, { createContext, useState, useEffect, useContext } from 'react';
import { getTasks } from '../api/tasks';
import { getUserProfile } from '../api/users';
import { getPeers } from '../api/peers';
import { useNavigate } from 'react-router-dom';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [userName, setUserName] = useState("");
  const [luffies, setLuffies] = useState(0);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  const [peers, setPeers] = useState([]);
  const [onlinePeers, setOnlinePeers] = useState(new Set());
  const [notifications, setNotifications] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(new Set());
  const [taskActivities, setTaskActivities] = useState({});
  const [archivedTasks, setArchivedTasks] = useState(new Set());
  
  const [authToken, setAuthToken] = useState(localStorage.getItem("token"));

  const navigate = useNavigate();

  const loadData = async () => {
    if (!authToken) return;
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

      const storedArchived = localStorage.getItem('archived_tasks_' + userData.id);
      if (storedArchived) {
        setArchivedTasks(new Set(JSON.parse(storedArchived)));
      } else {
        setArchivedTasks(new Set());
      }
    } catch (error) {
      if (error.response?.status === 401) {
        logoutUser();
      }
    }
  };

  const archiveTask = (taskId) => {
    setArchivedTasks(prev => {
      const next = new Set(prev);
      next.add(taskId);
      if (currentUserId) {
        localStorage.setItem('archived_tasks_' + currentUserId, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const loginUser = (token) => {
    localStorage.setItem("token", token);
    setAuthToken(token);
  };

  const logoutUser = () => {
    localStorage.removeItem("token");
    setAuthToken(null);
    setTasks([]);
    setUserName("");
    setLuffies(0);
    setCurrentUserId(null);
    setPeers([]);
    setOnlinePeers(new Set());
    setNotifications([]);
    setTaskActivities({});
    setArchivedTasks(new Set());
    navigate("/");
  };

  useEffect(() => {
    loadData();
  }, [authToken]);

  useEffect(() => {
    if (!authToken) return;

    const baseUrl = import.meta.env.VITE_API_URL || "https://getitdone-app.onrender.com";
    const wsUrl = baseUrl.replace("http://", "ws://").replace("https://", "wss://") + `/ws/${authToken}`;

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

            setTimeout(() => {
              setNotifications(prev => prev.filter(n => n.id !== notifId));
            }, 5000);

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
  }, [authToken]);

  return (
    <AppContext.Provider value={{
      tasks, setTasks,
      userName, setUserName,
      luffies, setLuffies,
      currentUserId, setCurrentUserId,
      peers, setPeers,
      onlinePeers, setOnlinePeers,
      notifications, setNotifications,
      loadingTasks, setLoadingTasks,
      taskActivities, setTaskActivities,
      archivedTasks, setArchivedTasks,
      archiveTask,
      loadData,
      loginUser,
      logoutUser
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);

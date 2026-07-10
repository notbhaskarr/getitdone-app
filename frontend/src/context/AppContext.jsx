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
  }, []);

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
      loadData
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);

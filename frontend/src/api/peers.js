import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "https://getitdone-app.onrender.com";

const getAuthHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  },
});

export const getPeers = async () => {
  const res = await axios.get(`${BASE_URL}/peers`, getAuthHeaders());
  return res.data;
};

export const requestPeer = async (email) => {
  const res = await axios.post(`${BASE_URL}/peers/request`, { email }, getAuthHeaders());
  return res.data;
};

export const acceptPeer = async (connId) => {
  const res = await axios.put(`${BASE_URL}/peers/accept/${connId}`, {}, getAuthHeaders());
  return res.data;
};

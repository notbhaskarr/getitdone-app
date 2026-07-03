import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "https://getitdone-app.onrender.com";

// -------------------------
// GET TASKS (JWT REQUIRED)
// -------------------------
export const getTasks = async () => {
  const token = localStorage.getItem("token");

  const res = await axios.get(`${BASE_URL}/tasks`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

// -------------------------
// CREATE TASK (JWT REQUIRED)
// -------------------------
export const createTask = async (title, description, assigned_to_id) => {
  const token = localStorage.getItem("token");

  const res = await axios.post(
    `${BASE_URL}/tasks`,
    {
      title,
      description,
      assigned_to_id
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};

// -------------------------
// UPDATE TASK (JWT REQUIRED)
// -------------------------
export const updateTask = async (taskId, updates) => {
  const token = localStorage.getItem("token");

  const res = await axios.put(
    `${BASE_URL}/tasks/${taskId}`,
    updates,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};

// -------------------------
// DELETE TASK (JWT REQUIRED)
// -------------------------
export const deleteTask = async (taskId) => {
  const token = localStorage.getItem("token");

  const res = await axios.delete(`${BASE_URL}/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};
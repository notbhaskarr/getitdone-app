import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

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
export const createTask = async (title, description) => {
  const token = localStorage.getItem("token");

  const res = await axios.post(
    `${BASE_URL}/tasks`,
    {
      title,
      description,
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
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
export const createTask = async (title, description, assigned_to_id, due_date) => {
  const token = localStorage.getItem("token");

  const res = await axios.post(
    `${BASE_URL}/tasks`,
    {
      title,
      description,
      assigned_to_id,
      due_date
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

// -------------------------
// TIP TASK (JWT REQUIRED)
// -------------------------
export const tipTask = async (taskId, amount) => {
  const token = localStorage.getItem("token");

  const res = await axios.post(
    `${BASE_URL}/tasks/${taskId}/tip`,
    { amount },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};

// -------------------------
// GET TASK EVENTS (JWT REQUIRED)
// -------------------------
export const getTaskEvents = async (taskId) => {
  const token = localStorage.getItem("token");

  const res = await axios.get(`${BASE_URL}/tasks/${taskId}/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

// -------------------------
// SUBTASKS
// -------------------------
export const createSubtask = async (taskId, title) => {
  const token = localStorage.getItem("token");
  const res = await axios.post(
    `${BASE_URL}/tasks/${taskId}/subtasks`,
    { title },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const updateSubtask = async (subtaskId, updates) => {
  const token = localStorage.getItem("token");
  const res = await axios.put(
    `${BASE_URL}/subtasks/${subtaskId}`,
    updates,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};

export const deleteSubtask = async (subtaskId) => {
  const token = localStorage.getItem("token");
  const res = await axios.delete(
    `${BASE_URL}/subtasks/${subtaskId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
};
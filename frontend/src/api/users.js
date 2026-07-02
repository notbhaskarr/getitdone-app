import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "https://getitdone-app.onrender.com";

// -------------------------
// GET USER PROFILE (JWT REQUIRED)
// -------------------------
export const getUserProfile = async () => {
  const token = localStorage.getItem("token");

  const res = await axios.get(`${BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.data;
};

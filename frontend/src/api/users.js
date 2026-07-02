import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000";

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

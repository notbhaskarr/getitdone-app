import API from "./api";

export const signup = (name, email, password) => {
  return API.post("/signup", { name, email, password });
};

export const login = async (email, password) => {
  const res = await API.post("/login", { email, password });
  return res.data;
};

export const getUserProfile = async () => {
  const res = await API.get("/users/me");
  return res.data;
};
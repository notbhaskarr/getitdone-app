import { useState } from "react";
import { login } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const data = await login(email, password);

      localStorage.setItem("token", data.access_token);

      navigate("/dashboard");
    } catch (err) {
      alert("Login failed");
      console.log(err?.response?.data || err.message);
    }
  };

  return (
    <div className="auth-wrapper">
      <h2 className="auth-logo">GETitDONE</h2>

      <div className="auth-card">
        <input
          className="auth-input"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="auth-input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="auth-btn" onClick={handleLogin}>Get in</button>

        <p className="auth-link-text">
          Don't have an account? <Link to="/signup">Join in</Link>
        </p>
      </div>
    </div>
  );
}
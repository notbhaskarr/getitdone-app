import { useState } from "react";
import { login } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";

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
    <div style={{ padding: 20 }}>
      <h2>GETitDONE</h2>

      <input
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <br />

      <input
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <br />

      <button onClick={handleLogin}>Login</button>

      <p>
        No account? <Link to="/signup">Signup</Link>
      </p>
    </div>
  );
}
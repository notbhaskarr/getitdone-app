import { useState } from "react";
import { signup } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleSignup = async () => {
    try {
      await signup(name, email, password);

      alert("Signup successful");

      navigate("/login");
    } catch (err) {
      alert("Signup failed");
      console.log(err?.response?.data || err.message);
    }
  };

  return (
    <div className="auth-wrapper">
      <h2 className="auth-logo">GETitDONE</h2>

      <div className="auth-card">
        <input
          className="auth-input"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

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

        <button className="auth-btn" onClick={handleSignup}>Join in</button>

        <p className="auth-link-text">
          Already have an account? <Link to="/">Get in</Link>
        </p>
      </div>
    </div>
  );
}
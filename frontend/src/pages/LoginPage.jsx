import { useState } from "react";
import { login } from "../api/auth";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorField, setErrorField] = useState(null); // 'email', 'password', or 'all'

  const navigate = useNavigate();

  const triggerError = (field) => {
    setErrorField(field);
    setTimeout(() => {
      setErrorField(null);
      setTimeout(() => setErrorField(field), 10);
    }, 0);
  };

  const clearError = (field) => {
    if (errorField === field || errorField === 'all') setErrorField(null);
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      triggerError("email");
      return;
    }
    if (!password.trim()) {
      triggerError("password");
      return;
    }

    try {
      setErrorField(null);
      const data = await login(email, password);
      localStorage.setItem("token", data.access_token);
      navigate("/dashboard");
    } catch (err) {
      triggerError("all");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-logo-container">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
          {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
            <g key={angle} transform={`rotate(${angle} 12 12)`}>
              <path d="M12 8 C14 5 15 3 13.5 1.5 M12.5 5 C15.5 5 16.5 3 17.5 1.5 M12 8 C10 6 9.5 7 7.5 4.5" />
            </g>
          ))}
        </svg>
        <h2 className="auth-logo">GETitDONE</h2>
      </div>

      <div className="auth-card">
        <input
          className={`auth-input${errorField === 'email' || errorField === 'all' ? " error-border shake" : ""}`}
          placeholder="Username"
          value={email}
          onChange={(e) => { setEmail(e.target.value); clearError("email"); }}
          onFocus={() => clearError("email")}
        />

        <input
          className={`auth-input${errorField === 'password' || errorField === 'all' ? " error-border shake" : ""}`}
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); clearError("password"); }}
          onFocus={() => clearError("password")}
        />

        <button className="auth-btn" onClick={handleLogin}>Get in</button>

        <p className="auth-link-text">
          Don't have an account? <Link to="/signup">Join in</Link>
        </p>
      </div>

      <div className="auth-footer">slick .</div>
    </div>
  );
}
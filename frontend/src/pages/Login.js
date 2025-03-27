import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

function Login() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [message, setMessage] = useState({ text: "", type: "" });
  const navigate = useNavigate();

  const handleGoogleLogin = (e) => {
    e.preventDefault();
    
    // Clear ALL existing auth data
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear any existing cookies
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // Force Google to show account selector with additional parameters
    const googleAuthUrl = `${process.env.REACT_APP_BACKEND_URL}/auth/google/new`;
    const randomState = Math.random().toString(36).substring(7);
    
    // Store state to prevent CSRF
    sessionStorage.setItem('googleAuthState', randomState);
    
    // Add prompt and state parameters
    const finalUrl = `${googleAuthUrl}?prompt=select_account&state=${randomState}`;
    window.location.href = finalUrl;
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const error = urlParams.get('error');
    
    if (error) {
      setMessage({ text: "Google authentication failed", type: "error" });
      return;
    }
    
    if (token) {
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Store the token
      localStorage.setItem("token", token);
      
      // Get user details with the token
      axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/auth/me`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        if (response.data && response.data.user) {
          localStorage.setItem("userId", response.data.user._id);
          localStorage.setItem("user", JSON.stringify(response.data.user));
          navigate("/");
        } else {
          setMessage({ text: "Invalid user data received", type: "error" });
        }
      })
      .catch(error => {
        console.error("Error fetching user details:", error);
        setMessage({ 
          text: error.response?.data?.message || "Failed to get user details", 
          type: "error" 
        });
      });
    }
  }, [navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/auth/login`,
        formData
      );
      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("userId", res.data.user._id);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        navigate("/");
      } else {
        setMessage({ text: "Invalid credentials", type: "error" });
      }
    } catch (error) {
      // More specific error message
      setMessage({ 
        text: error.response?.data?.message || "Invalid email or password", 
        type: "error" 
      });
    }
  };

  return (
    <div>
      <header className="header">
        <div className="logo">
          <Link to="/">
            <img
              src="/logo.png"
              alt="Logo"
              style={{ width: "150px", height: "100px" }}
            />
          </Link>
        </div>
        <div className="auth-buttons">
          <Link to="/signup" className="btn signup-btn">
            Sign Up
          </Link>
        </div>
      </header>

      <div className="auth-container">
        <div className="auth-form">
          <h2>Welcome Back</h2>
          <p>Please login to continue</p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                placeholder="Enter your email"
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-options">
              <div className="remember-me">
                <input type="checkbox" id="remember" />
                <label htmlFor="remember">Remember me</label>
              </div>
              <Link to="/forgot-password" className="forgot-password">
                Forgot Password?
              </Link>
            </div>

            <button type="submit" className="btn submit-btn">
              Login
            </button>

            {message.text && (
              <div className={`auth-message ${message.type}`}>
                {message.text}
              </div>
            )}
         <p style = {{textAlign: "center"}}>OR</p>
            <button 
              type="button" 
              onClick={handleGoogleLogin} 
              className="btn submit-btn"
            >
              Sign in with Google
            </button>

            <div className="auth-redirect">
              Don't have an account? <Link to="/signup">Sign Up</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;

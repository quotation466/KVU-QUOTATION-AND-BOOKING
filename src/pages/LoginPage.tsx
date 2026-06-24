import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logoBase64 } from '../assets/logo';
import '../styles/LoginPage.css';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Where to redirect after login (default to dashboard)
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(userId, password);
    setLoading(false);
    if (res.success) {
      navigate(from, { replace: true });
    } else {
      setError(res.error || 'Login failed!');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card-container">
        
        {/* Visual Brand Section */}
        <div className="login-brand-banner">
          <div className="brand-logo-container">
            <img src={logoBase64} alt="Krishi Vikas Udyog Logo" className="login-brand-logo" />
          </div>
          <h1>Krishi Vikas Udyog</h1>
          <p className="brand-subtitle">Enterprise Resource Planning (ERP)</p>
          <div className="brand-features-list">
            <span>⚙️ Booking & Production Ledger</span>
            <span>💳 Payment Ledger Transactions</span>
            <span>📦 Inventory CRM & History Tools</span>
          </div>
        </div>

        {/* Login Form Section */}
        <div className="login-form-content">
          <div className="login-header-text">
            <h2>Welcome Back</h2>
            <p>Enter your login ID and password to continue.</p>
          </div>

          {error && (
            <div className="login-error-banner" role="alert">
              <span className="error-icon">⚠️</span>
              <span className="error-text">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="userId">User ID (Username)</label>
              <div className="input-with-icon">
                <span className="input-icon">👤</span>
                <input
                  id="userId"
                  type="text"
                  placeholder="Enter User ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <span className="input-icon">🔑</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="current-password"
                  style={{ paddingRight: '40px !important' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    padding: '4px',
                    zIndex: 15,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-icon"></span>
                  Logging in...
                </>
              ) : (
                'Login Securely'
              )}
            </button>
          </form>

          <div className="login-footer-info">
            <p>Authorized personnel only. Contact Admin for credentials generation.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

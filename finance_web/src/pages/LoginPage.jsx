import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Lock, Mail, ArrowRight, Eye, EyeOff, AlertCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../api/client';
import './AuthPages.css';

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [coldStartNotice, setColdStartNotice] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    if (emailParam && !email) {
      setEmail(emailParam);
    }
  }, [location.search]);

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => {
        setColdStartNotice(true);
      }, 3500);
    } else {
      setColdStartNotice(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setColdStartNotice(false);

    const cleanEmail = (email || '').trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address format (e.g. name@domain.com).');
      return;
    }

    setLoading(true);
    try {
      await login(cleanEmail, password);
      navigate('/dashboard');
    } catch (err) {
      let msg = 'Login failed. Please verify credentials.';
      if (typeof err === 'string' && err !== '[object Object]') {
        msg = err;
      } else if (err?.message && typeof err.message === 'string' && err.message !== '[object Object]') {
        msg = err.message;
      } else if (err?.data) {
        msg = extractErrorMessage(err.data, msg);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isUnregistered =
    typeof error === 'string' &&
    (error.toLowerCase().includes('no account') ||
      error.toLowerCase().includes('register first') ||
      error.toLowerCase().includes('not found') ||
      error.toLowerCase().includes('invalid email or password'));

  return (
    <div className="auth-page-wrapper">
      <div className="card auth-card">
        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <TrendingUp size={28} />
          </div>
          <h2 className="auth-brand-title">Welcome Back</h2>
          <p className="auth-brand-subtitle">Personal Finance Intelligence Platform</p>
        </div>

        {error && (
          <div className="alert-banner error auth-alert-error">
            <div className="auth-alert-row">
              <AlertCircle size={16} className="auth-alert-icon" />
              <span>{typeof error === 'string' ? error : 'Login failed. Please verify credentials.'}</span>
            </div>
            {isUnregistered && (
              <div className="auth-alert-subtext">
                New user?{' '}
                <Link
                  to={`/register?email=${encodeURIComponent(email)}`}
                  className="auth-alert-action-link"
                >
                  Create an account with this email &rarr;
                </Link>
              </div>
            )}
          </div>
        )}

        {coldStartNotice && (
          <div className="alert-banner info auth-alert-coldstart">
            <Clock size={16} className="animate-spin auth-alert-icon" />
            <span>Render backend server is spinning up (20-30s on free tier). Please hold on...</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-icon-wrap">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                required
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrap has-toggle">
              <Lock size={16} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
              />
              <button
                type="button"
                className="input-icon-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary auth-submit-btn">
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-footer-text">
          Don&apos;t have an account?{' '}
          <Link to={`/register${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="auth-footer-link">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

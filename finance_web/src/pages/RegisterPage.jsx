import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Lock, Mail, User, ArrowRight, Eye, EyeOff, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../api/client';
import './AuthPages.css';

export const RegisterPage = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [coldStartNotice, setColdStartNotice] = useState(false);
  const { register } = useAuth();
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

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, fullName);
      navigate('/dashboard');
    } catch (err) {
      let msg = 'Registration failed.';
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

  const isExistingAccount =
    typeof error === 'string' &&
    (error.toLowerCase().includes('already exists') || error.toLowerCase().includes('duplicate'));

  return (
    <div className="auth-page-wrapper">
      <div className="card auth-card">
        <div className="auth-brand-header">
          <div className="auth-brand-icon">
            <TrendingUp size={28} />
          </div>
          <h2 className="auth-brand-title">Create Account</h2>
          <p className="auth-brand-subtitle">Start tracking your personal finance analytics</p>
        </div>

        {error && (
          <div className="alert-banner error auth-alert-error">
            <div className="auth-alert-row">
              <AlertCircle size={16} className="auth-alert-icon" />
              <span>{typeof error === 'string' ? error : 'Registration failed.'}</span>
            </div>
            {isExistingAccount && (
              <div className="auth-alert-subtext">
                Account already registered.{' '}
                <Link
                  to={`/login?email=${encodeURIComponent(email)}`}
                  className="auth-alert-action-link"
                >
                  Sign in to your account &rarr;
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
            <label className="form-label">Full Name</label>
            <div className="input-icon-wrap">
              <User size={16} className="input-icon" />
              <input
                type="text"
                placeholder="Karuna karan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-icon-wrap">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                required
                placeholder="name@example.com"
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
                placeholder="Min. 8 characters"
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

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div className="input-icon-wrap has-toggle">
              <Lock size={16} className="input-icon" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
              />
              <button
                type="button"
                className="input-icon-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary auth-submit-btn">
            {loading ? 'Creating Account...' : 'Get Started'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-footer-text">
          Already have an account?{' '}
          <Link to={`/login${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="auth-footer-link">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

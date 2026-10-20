import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { TrendingUp, Lock, Mail, User, ArrowRight, Eye, EyeOff, Clock, AlertCircle, ShieldCheck, RotateCcw, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../api/client';
import './AuthPages.css';

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

export const RegisterPage = () => {
  const [step, setStep] = useState('form');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [emailWarning, setEmailWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [coldStartNotice, setColdStartNotice] = useState(false);
  const { register, sendVerificationCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const emailParam = params.get('email');
    if (emailParam && !email) {
      setEmail(emailParam);
      validateEmailFormat(emailParam);
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

  useEffect(() => {
    let interval;
    if (step === 'verification' && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, countdown]);

  const validateEmailFormat = (val) => {
    const trimmed = (val || '').trim();
    if (!trimmed) {
      setEmailWarning('');
      return false;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailWarning('Please enter a valid email format (e.g. name@gmail.com).');
      return false;
    }
    setEmailWarning('');
    return true;
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    validateEmailFormat(val);
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setColdStartNotice(false);

    const cleanEmail = (email || '').trim();
    if (!validateEmailFormat(cleanEmail)) {
      setError(emailWarning || 'Please enter a valid email address format (e.g. name@domain.com).');
      return;
    }

    if (emailWarning) {
      setError(emailWarning);
      return;
    }

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
      const res = await sendVerificationCode(email);
      setInfoMessage(res?.message || 'Verification code sent to your inbox.');
      setStep('verification');
      setCountdown(60);
    } catch (err) {
      let msg = 'Failed to send verification code.';
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

  const handleResendCode = async () => {
    if (countdown > 0 || loading) return;
    setError('');
    setInfoMessage('');
    setLoading(true);
    try {
      const res = await sendVerificationCode(email);
      setInfoMessage(res?.message || 'A new verification code has been dispatched.');
      setCountdown(60);
    } catch (err) {
      let msg = 'Failed to resend verification code.';
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

  const handleVerifyAndRegister = async (e) => {
    e.preventDefault();
    setError('');
    setColdStartNotice(false);

    const cleanEmail = (email || '').trim();
    if (!validateEmailFormat(cleanEmail)) {
      setError(emailWarning || 'Please enter a valid email address format (e.g. name@domain.com).');
      return;
    }

    const cleanCode = (verificationCode || '').trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      await register(cleanEmail, password, fullName, cleanCode);
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
        {step === 'form' ? (
          <>
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

            <form onSubmit={handleSendCode}>
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
                    placeholder="name@gmail.com"
                    value={email}
                    onChange={handleEmailChange}
                    className="form-input"
                  />
                </div>
                {emailWarning && (
                  <div className="auth-email-warning">{emailWarning}</div>
                )}
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
                {loading ? 'Sending Verification Code...' : 'Get Started & Verify Email'}
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="auth-footer-text">
              Already have an account?{' '}
              <Link to={`/login${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="auth-footer-link">
                Sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="verification-header">
              <div className="verification-icon-wrap">
                <ShieldCheck size={32} />
              </div>
              <h2 className="verification-title">Enter Verification Code</h2>
              <p className="verification-subtitle">
                We sent a 6-digit confirmation code to:
                <br />
                <span className="verification-email-badge">{email}</span>
              </p>
            </div>

            {infoMessage && (
              <div className="alert-banner info auth-alert-coldstart">
                <span>{infoMessage}</span>
              </div>
            )}

            {error && (
              <div className="alert-banner error auth-alert-error">
                <div className="auth-alert-row">
                  <AlertCircle size={16} className="auth-alert-icon" />
                  <span>{typeof error === 'string' ? error : 'Verification failed.'}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleVerifyAndRegister}>
              <div className="verification-input-wrap">
                <input
                  type="text"
                  maxLength={6}
                  autoFocus
                  required
                  placeholder="••••••"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  className="verification-code-input"
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length < 6}
                className="btn btn-primary auth-submit-btn"
              >
                {loading ? 'Verifying...' : 'Verify & Create Account'}
                <ArrowRight size={16} />
              </button>

              <div className="verification-meta-actions">
                <button
                  type="button"
                  onClick={() => {
                    setStep('form');
                    setError('');
                    setInfoMessage('');
                  }}
                  className="verification-back-link"
                >
                  <ArrowLeft size={14} className="inline mr-1" />
                  Edit Details
                </button>

                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={countdown > 0 || loading}
                  className="verification-action-link"
                >
                  <RotateCcw size={13} className="inline mr-1" />
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default RegisterPage;

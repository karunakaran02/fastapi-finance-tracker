import React, { useState } from 'react';
import { User, Lock, CheckCircle2, Coins, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import api from '../api/client';
import './SettingsPage.css';

export const SettingsPage = () => {
  const { user, refreshUser } = useAuth();
  const { currency, setCurrency, currencies } = useCurrency();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMessage('');
    setProfileError('');
    setProfileSaving(true);
    try {
      await api.updateProfile({ full_name: fullName.trim() });
      await refreshUser();
      setProfileMessage('Profile details successfully updated.');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword });
      setPasswordMessage('Password successfully changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="content-body">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Settings &amp; Security</h2>
          <p className="page-subtitle">Manage your profile credentials and security preferences</p>
        </div>
      </div>

      <div className="grid-cols-2">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title with-icon">
              <User size={18} /> User Profile
            </h3>
          </div>

          {profileMessage && (
            <div className="alert-banner success">
              <CheckCircle2 size={16} /> {profileMessage}
            </div>
          )}
          {profileError && <div className="alert-banner error">{profileError}</div>}

          <form onSubmit={handleUpdateProfile} className="settings-form">
            <div className="form-group">
              <label className="form-label">Email Address (Read-only)</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Account Created</label>
              <p className="settings-created-text">
                {user?.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}
              </p>
            </div>

            <button type="submit" disabled={profileSaving} className="btn btn-primary">
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title with-icon">
              <Lock size={18} /> Change Password
            </h3>
          </div>

          {passwordMessage && (
            <div className="alert-banner success">
              <CheckCircle2 size={16} /> {passwordMessage}
            </div>
          )}
          {passwordError && <div className="alert-banner error">{passwordError}</div>}

          <form onSubmit={handleChangePassword} className="settings-form">
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <div className="input-icon-wrap has-toggle">
                <Lock size={16} className="input-icon" />
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="input-icon-toggle"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  title={showCurrentPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">New Password (Min. 8 characters)</label>
              <div className="input-icon-wrap has-toggle">
                <Lock size={16} className="input-icon" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                />
                <button
                  type="button"
                  className="input-icon-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  title={showNewPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <div className="input-icon-wrap has-toggle">
                <Lock size={16} className="input-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat new password"
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

            <button type="submit" disabled={passwordSaving} className="btn btn-secondary">
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        <div className="card settings-card-wide">
          <div className="card-header">
            <h3 className="card-title with-icon">
              <Coins size={18} /> Regional Currency Preference
            </h3>
          </div>
          <p className="settings-pref-desc">
            Choose your preferred currency symbol and formatting for your transactions, dashboard metrics, budgets, and reports.
          </p>

          <div className="settings-currency-grid">
            {Object.values(currencies).map((curr) => {
              const isSelected = currency === curr.code;
              return (
                <div
                  key={curr.code}
                  onClick={() => setCurrency(curr.code)}
                  className={`currency-option-card ${isSelected ? 'selected' : ''}`}
                >
                  <div className="currency-symbol-badge">
                    {curr.symbol}
                  </div>
                  <div>
                    <div className="currency-option-label">
                      {curr.label}
                    </div>
                    <div className="currency-option-sample">
                      Code: {curr.code} • Sample: {curr.symbol}1,250.00
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

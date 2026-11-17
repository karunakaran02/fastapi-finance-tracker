import React, { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
  Search,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import SummaryCard from '../components/SummaryCard';
import './AdminPage.css';

export const AdminPage = () => {
  const { user: currentUser } = useAuth();
  const { symbol, activeCurrency } = useCurrency();
  const formatAmt = (val, opts = {}) => Number(val || 0).toLocaleString(activeCurrency.locale, opts);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAdminOverview();
      setOverview(data);
    } catch (err) {
      setError(err.message || 'Failed to load admin overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleToggleActive = async (targetUser) => {
    setActionLoadingId(targetUser.id);
    try {
      await api.updateAdminUser(targetUser.id, { is_active: !targetUser.is_active });
      await fetchOverview();
    } catch (err) {
      alert(err.message || 'Failed to update user status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleAdmin = async (targetUser) => {
    setActionLoadingId(targetUser.id);
    try {
      await api.updateAdminUser(targetUser.id, { is_admin: !targetUser.is_admin });
      await fetchOverview();
    } catch (err) {
      alert(err.message || 'Failed to update user role.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete ${targetUser.email} and all their transactions?`
      )
    ) {
      return;
    }
    setActionLoadingId(targetUser.id);
    try {
      await api.deleteAdminUser(targetUser.id);
      await fetchOverview();
    } catch (err) {
      alert(err.message || 'Failed to delete user.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredUsers = (overview?.users || []).filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name && u.full_name.toLowerCase().includes(q))
    );
  });

  if (loading && !overview) {
    return (
      <div className="page-loading-box">
        <RefreshCw size={24} className="animate-spin page-loading-spinner" />
        Loading platform administration data...
      </div>
    );
  }

  return (
    <div className="content-body">
      <div className="page-header-row">
        <div>
          <div className="admin-title-row">
            <ShieldCheck size={24} className="admin-shield-icon" />
            <h2 className="page-title">Admin Control Center</h2>
          </div>
          <p className="page-subtitle">
            Platform-wide financial volume, user access management, and role governance
          </p>
        </div>
        <button onClick={fetchOverview} className="btn btn-secondary">
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {error && <div className="alert-banner error">{error}</div>}

      <div className="grid-cols-4 admin-kpi-grid">
        <SummaryCard
          title="Registered Users"
          amount={String(overview?.total_users || 0)}
          subtitle={`Active: ${overview?.active_users || 0} | Suspended: ${overview?.inactive_users || 0} | Admins: ${overview?.admin_users || 0}`}
          icon={Users}
          color="purple"
          prefix=""
        />
        <SummaryCard
          title="Platform Income Volume"
          amount={overview?.total_income_volume ? Number(overview.total_income_volume) : 0}
          subtitle="Total inflow across all users"
          icon={TrendingUp}
          color="green"
        />
        <SummaryCard
          title="Platform Expense Volume"
          amount={overview?.total_expense_volume ? Number(overview.total_expense_volume) : 0}
          subtitle="Total outflow across all users"
          icon={TrendingDown}
          color="red"
        />
        <SummaryCard
          title="Total Transactions"
          amount={String(overview?.total_transactions || 0)}
          subtitle={`Categories: ${overview?.system_categories_count || 0} Default / ${overview?.custom_categories_count || 0} Custom`}
          icon={Activity}
          color="blue"
          prefix=""
        />
      </div>

      <div className="card">
        <div className="card-header wrap">
          <div>
            <h3 className="card-title">User Accounts &amp; Access Control ({filteredUsers.length})</h3>
            <p className="card-subtitle">
              Activate or suspend accounts, assign admin privileges, or remove users
            </p>
          </div>
          <div className="input-icon-wrap admin-search-box">
            <Search size={15} className="input-icon" />
            <input
              type="text"
              placeholder="Search user name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="table-container admin-desktop-table">
          <table className="table admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th className="col-center">Transactions</th>
                <th className="col-right">Total Income</th>
                <th className="col-right">Total Expenses</th>
                <th>Joined</th>
                <th className="col-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isBusy = actionLoadingId === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="admin-user-name-row">
                        <span>{u.full_name || 'Unnamed User'}</span>
                        {isSelf && <span className="admin-self-tag">You</span>}
                      </div>
                      <div className="admin-user-email">{u.email}</div>
                    </td>
                    <td>
                      <span
                        className={`badge admin-role-badge ${
                          u.is_admin ? 'is-admin' : 'is-user'
                        }`}
                      >
                        {u.is_admin ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.is_active ? 'badge-income' : 'badge-expense'}`}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="col-center cell-primary">{u.transaction_count}</td>
                    <td className="col-right val-income">
                      {symbol}{formatAmt(u.total_income, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="col-right val-expense">
                      {symbol}{formatAmt(u.total_expenses, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString(activeCurrency.locale) : '—'}
                    </td>
                    <td className="col-right">
                      <div className="admin-actions-wrap">
                        <button
                          onClick={() => handleToggleAdmin(u)}
                          disabled={isSelf || isBusy}
                          className="btn btn-secondary btn-sm admin-action-btn"
                          title={
                            isSelf
                              ? 'Cannot change your own role'
                              : u.is_admin
                              ? 'Revoke Admin'
                              : 'Make Admin'
                          }
                        >
                          {u.is_admin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                          <span>{u.is_admin ? 'Revoke Admin' : 'Make Admin'}</span>
                        </button>

                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={isSelf || isBusy}
                          className={`btn btn-secondary btn-sm admin-action-btn ${
                            u.is_active ? 'suspend' : 'activate'
                          }`}
                          title={
                            isSelf
                              ? 'Cannot suspend your own account'
                              : u.is_active
                              ? 'Suspend User'
                              : 'Activate User'
                          }
                        >
                          {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                          <span>{u.is_active ? 'Suspend' : 'Activate'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={isSelf || isBusy}
                          className="btn btn-secondary btn-sm admin-action-btn delete"
                          title={isSelf ? 'Cannot delete your own account' : 'Delete User'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="admin-mobile-cards">
          {filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No matching user accounts found.
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelf = u.id === currentUser?.id;
              const isBusy = actionLoadingId === u.id;
              return (
                <div key={`m-${u.id}`} className="admin-user-card">
                  <div className="admin-user-card-top">
                    <div>
                      <div className="admin-user-name-row">
                        <span>{u.full_name || 'Unnamed User'}</span>
                        {isSelf && <span className="admin-self-tag">You</span>}
                      </div>
                      <div className="admin-user-email">{u.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className={`badge admin-role-badge ${u.is_admin ? 'is-admin' : 'is-user'}`}>
                        {u.is_admin ? 'Admin' : 'User'}
                      </span>
                      <span className={`badge ${u.is_active ? 'badge-income' : 'badge-expense'}`}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </div>
                  </div>

                  <div className="admin-user-card-meta">
                    <div className="admin-meta-item">
                      <span className="admin-meta-label">Transactions</span>
                      <span className="admin-meta-value">{u.transaction_count}</span>
                    </div>
                    <div className="admin-meta-item">
                      <span className="admin-meta-label">Income</span>
                      <span className="admin-meta-value text-emerald-400">
                        {symbol}{formatAmt(u.total_income)}
                      </span>
                    </div>
                    <div className="admin-meta-item">
                      <span className="admin-meta-label">Expenses</span>
                      <span className="admin-meta-value text-rose-400">
                        {symbol}{formatAmt(u.total_expenses)}
                      </span>
                    </div>
                  </div>

                  <div className="admin-user-card-actions">
                    <button
                      onClick={() => handleToggleAdmin(u)}
                      disabled={isSelf || isBusy}
                      className="btn btn-secondary btn-sm admin-action-btn"
                      title={
                        isSelf
                          ? 'Cannot change your own role'
                          : u.is_admin
                          ? 'Revoke Admin'
                          : 'Make Admin'
                      }
                    >
                      {u.is_admin ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                      <span>{u.is_admin ? 'Revoke Admin' : 'Make Admin'}</span>
                    </button>

                    <button
                      onClick={() => handleToggleActive(u)}
                      disabled={isSelf || isBusy}
                      className={`btn btn-secondary btn-sm admin-action-btn ${
                        u.is_active ? 'suspend' : 'activate'
                      }`}
                      title={
                        isSelf
                          ? 'Cannot suspend your own account'
                          : u.is_active
                          ? 'Suspend User'
                          : 'Activate User'
                      }
                    >
                      {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
                      <span>{u.is_active ? 'Suspend' : 'Activate'}</span>
                    </button>

                    <button
                      onClick={() => handleDeleteUser(u)}
                      disabled={isSelf || isBusy}
                      className="btn btn-secondary btn-sm admin-action-btn delete"
                      title={isSelf ? 'Cannot delete your own account' : 'Delete User'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

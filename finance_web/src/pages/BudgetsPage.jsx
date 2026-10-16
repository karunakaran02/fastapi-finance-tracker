import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Send,
  RefreshCw,
  X,
  TrendingDown,
  TrendingUp,
  ShieldAlert,
  Clock,
  Layers,
  Info,
  ExternalLink,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import CustomSelect from '../components/CustomSelect';
import './BudgetsPage.css';

export const BudgetsPage = () => {
  const { user } = useAuth();
  const { symbol, activeCurrency } = useCurrency();
  const formatAmt = (val, opts = {}) => Number(val || 0).toLocaleString(activeCurrency.locale, opts);
  const [overview, setOverview] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [thresholdAmount, setThresholdAmount] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [alertEmail, setAlertEmail] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [testingId, setTestingId] = useState(null);
  const [selectedNotifForError, setSelectedNotifForError] = useState(null);

  const fetchOverview = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [overviewData, categoriesData] = await Promise.all([
        api.getBudgetOverview(),
        api.getCategories().catch(() => []),
      ]);
      setOverview(overviewData);
      setCategories(categoriesData || []);
    } catch (err) {
      setError(err.message || 'Failed to load budgets and alerts data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 4500);
  };

  const handleOpenAdd = () => {
    setEditingBudget(null);
    setName('');
    setType('expense');
    setCategoryId('');
    setThresholdAmount('');
    setPeriod('monthly');
    setAlertEmail('');
    setIsActive(true);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b) => {
    setEditingBudget(b);
    setName(b.name || '');
    setType(b.type || 'expense');
    setCategoryId(b.category_id ? String(b.category_id) : '');
    setThresholdAmount(b.threshold_amount ? String(b.threshold_amount) : '');
    setPeriod(b.period || 'monthly');
    setAlertEmail(b.alert_email || '');
    setIsActive(b.is_active !== false);
    setModalError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!name.trim()) {
      setModalError('Threshold name is required.');
      return;
    }
    const amt = parseFloat(thresholdAmount);
    if (isNaN(amt) || amt <= 0) {
      setModalError('Please enter a valid threshold amount greater than 0.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        category_id: categoryId ? parseInt(categoryId, 10) : null,
        threshold_amount: amt.toFixed(2),
        period,
        alert_email: alertEmail.trim() ? alertEmail.trim() : null,
        is_active: isActive,
      };

      if (editingBudget) {
        await api.updateBudget(editingBudget.id, payload);
        showToast(`Budget threshold '${name}' updated successfully.`);
      } else {
        await api.createBudget(payload);
        showToast(`Budget threshold '${name}' created. Background alert monitoring active!`);
      }

      setIsModalOpen(false);
      fetchOverview();
    } catch (err) {
      setModalError(err.message || 'Failed to save budget threshold.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Are you sure you want to delete the threshold '${b.name}'?`)) {
      return;
    }
    try {
      await api.deleteBudget(b.id);
      showToast(`Threshold '${b.name}' removed.`);
      fetchOverview();
    } catch (err) {
      alert(err.message || 'Failed to delete threshold.');
    }
  };

  const handleTestAlert = async (b) => {
    setTestingId(b.id);
    try {
      const resp = await api.testBudgetAlert(b.id);
      showToast(resp.message || `Test alert triggered in background for '${b.name}'.`);
      setTimeout(() => {
        fetchOverview();
      }, 1200);
    } catch (err) {
      alert(err.message || 'Failed to trigger test alert.');
    } finally {
      setTestingId(null);
    }
  };

  const categoryOptions = [
    { value: '', label: '🌐 Global Cashflow (All Categories)' },
    ...categories
      .filter((cat) => cat.type === type)
      .map((cat) => ({ value: String(cat.id), label: cat.name })),
  ];

  const typeOptions = [
    { value: 'expense', label: 'Expense Limit (Spending Cap)' },
    { value: 'income', label: 'Income Target (Goal)' },
  ];

  const periodOptions = [
    { value: 'monthly', label: 'Monthly Rolling Cycle' },
    { value: 'per_transaction', label: 'Per-Transaction Limit' },
  ];

  if (loading) {
    return (
      <div className="budgets-container flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-brand-cobalt" />
          <span>Synchronizing budget thresholds & background telemetry...</span>
        </div>
      </div>
    );
  }

  const budgets = overview?.budgets || [];
  const notifications = overview?.recent_notifications || [];

  return (
    <div className="budgets-container">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/95 text-white border border-brand-cobalt/40 shadow-2xl backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-medium">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="text-slate-400 hover:text-white ml-2"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-white">Budgets & Threshold Alerts</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Python Background Worker
            </span>
            {overview?.smtp_configured ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                SMTP Live Delivery Active
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5" title="SMTP credentials not set. Alerts are recorded in database audit log and server logs.">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                Mock SMTP Mode (Audit Log Active)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Define automated spending caps and income targets. Real-time asynchronous email alerts trigger whenever thresholds are breached.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all"
            title="Refresh status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Threshold</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notifications.length > 0 && notifications[0]?.message?.includes('SMTP Delivery Failed') && (
        <div className="p-4 mb-6 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold text-white">Outbound SMTP Relay Delivery Blocked:</span> Background worker evaluated and dispatched threshold alerts, but your email provider rejected authentication (<code className="text-rose-300 font-mono">535 5.7.139 SmtpClientAuthentication is disabled for the Tenant</code>). Microsoft 365 Exchange Online disables SMTP AUTH by default on organizational domains (<code className="text-rose-300">@mitrahsoft.in</code>). Click <strong>"SMTP Failed (Diagnostic)"</strong> in the audit log below for details and instant solutions (e.g. Gmail App Password).
            </div>
          </div>
        </div>
      )}

      {!overview?.smtp_configured && (
        <div className="p-4 mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-white">Live Email Inboxes Notice:</span> Threshold alerts are fully active in Python background worker, and all dispatches are recorded in the <strong>Live Audit Log</strong> below. To transmit real emails to an external inbox (such as Gmail), add your SMTP credentials (<code className="text-amber-300 font-mono">SMTP_HOST</code>, <code className="text-amber-300 font-mono">SMTP_USER</code>, <code className="text-amber-300 font-mono">SMTP_PASSWORD</code>) in <code className="text-amber-300 font-mono">finance_api/.env</code>.
            </div>
          </div>
        </div>
      )}

      <div className="budgets-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Active Thresholds</span>
            <div className="kpi-icon-wrap text-indigo-400">
              <Layers size={18} />
            </div>
          </div>
          <div className="kpi-value">{overview?.active_budgets || 0}</div>
          <div className="kpi-subtext">out of {overview?.total_budgets || 0} total configured</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Budgeted Spending</span>
            <div className="kpi-icon-wrap text-emerald-400">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="kpi-value">{symbol}{formatAmt(overview?.total_budgeted_expense, { minimumFractionDigits: 2 })}</div>
          <div className="kpi-subtext">Sum of active expense caps</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Actual Spend</span>
            <div className="kpi-icon-wrap text-amber-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="kpi-value">{symbol}{formatAmt(overview?.total_spent_in_budgeted, { minimumFractionDigits: 2 })}</div>
          <div className="kpi-subtext">Recorded current period spend</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Breached / At Risk</span>
            <div className="kpi-icon-wrap text-rose-400">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="kpi-value text-rose-400">{overview?.exceeded_budgets || 0}</div>
          <div className="kpi-subtext">
            {overview?.warning_budgets || 0} approaching threshold (&gt;80%)
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <span>Configured Thresholds & Progress</span>
            <span className="text-xs font-normal text-slate-400">({budgets.length})</span>
          </h2>
        </div>

        {budgets.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.1]">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">No thresholds set yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
              Create an expense limit or income target. Our Python background worker will monitor transactions and dispatch automated email alerts when amounts are exceeded.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Threshold</span>
            </button>
          </div>
        ) : (
          <div className="budgets-grid">
            {budgets.map((b) => {
              const statusClass = `status-${b.status}`;
              const fillClass = `fill-${b.status}`;
              const clampedPercent = Math.min(b.percentage_used || 0, 100);

              return (
                <div key={b.id} className={`budget-card ${statusClass}`}>
                  <div>
                    <div className="budget-card-top">
                      <div>
                        <h3 className="budget-card-title">{b.name}</h3>
                        <div className="budget-badges">
                          <span className={`badge ${b.type === 'expense' ? 'badge-expense' : 'badge-income'}`}>
                            {b.type === 'expense' ? 'Expense Cap' : 'Income Goal'}
                          </span>
                          <span className="badge badge-period">
                            {b.period === 'per_transaction' ? 'Per Transaction' : 'Monthly Cycle'}
                          </span>
                          <span className="badge badge-category">
                            {b.category_name || 'Global Cashflow'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
                          title="Edit threshold"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(b)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete threshold"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <div className="budget-progress-section">
                      <div className="progress-labels">
                        <span className="text-slate-400">Utilization</span>
                        <span className="font-semibold text-slate-200">
                          {b.percentage_used}%
                        </span>
                      </div>
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${fillClass}`}
                          style={{ width: `${clampedPercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="budget-metrics-row">
                      <div className="metric-col">
                        <div className="metric-label">Actual</div>
                        <div className="metric-val text-slate-200">
                          {symbol}{formatAmt(b.current_amount, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="metric-col">
                        <div className="metric-label">Threshold</div>
                        <div className="metric-val text-indigo-300">
                          {symbol}{formatAmt(b.threshold_amount, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div className="metric-col">
                        <div className="metric-label">Remaining</div>
                        <div className="metric-val text-emerald-400">
                          {symbol}{formatAmt(b.remaining_amount, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {b.is_exceeded ? (
                      <div className="budget-status-banner status-banner-exceeded">
                        <AlertTriangle size={15} className="shrink-0" />
                        <span>Threshold breached! Alert notifications active.</span>
                      </div>
                    ) : b.status === 'warning' ? (
                      <div className="budget-status-banner status-banner-warning">
                        <AlertTriangle size={15} className="shrink-0" />
                        <span>Approaching limit (&gt;80% utilized).</span>
                      </div>
                    ) : (
                      <div className="budget-status-banner status-banner-safe">
                        <CheckCircle2 size={15} className="shrink-0" />
                        <span>Within defined threshold limits.</span>
                      </div>
                    )}
                  </div>

                  <div className="budget-card-footer">
                    <div className="alert-recipient-info" title={b.alert_email || user?.email}>
                      <Mail size={13} className="shrink-0 text-slate-400" />
                      <span className="truncate">{b.alert_email || user?.email || 'Registered Email'}</span>
                    </div>

                    <div className="budget-action-btns">
                      <button
                        type="button"
                        onClick={() => handleTestAlert(b)}
                        disabled={testingId === b.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-indigo-300 border border-indigo-500/20 transition-all disabled:opacity-50"
                        title="Simulate a threshold breach and trigger background email"
                      >
                        {testingId === b.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send size={11} />
                        )}
                        <span>Test Alert</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="notifications-panel">
        <div className="notifications-panel-header">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock size={16} className="text-indigo-400" />
              <span>Background Alert Dispatches</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live audit record of automated emails evaluated and triggered by the Python background process.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/[0.05] text-slate-300 border border-white/[0.08]">
            {notifications.length} logged
          </span>
        </div>

        <div className="notifications-table-wrap">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No alert emails dispatched yet. Trigger a "Test Alert" or record transactions exceeding a limit to see entries here.
            </div>
          ) : (
            <table className="notif-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Threshold Name</th>
                  <th>Recipient Email</th>
                  <th>Threshold</th>
                  <th>Triggered Amount</th>
                  <th>Exceeded By</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <span className="text-slate-300 font-mono text-[11px]">
                        {new Date(n.sent_at).toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="font-semibold text-white">{n.budget_name || 'Limit Alert'}</span>
                    </td>
                    <td>
                      <span className="text-slate-400">{n.recipient_email}</span>
                    </td>
                    <td>
                      <span className="font-mono text-slate-300">
                        {symbol}{formatAmt(n.threshold_amount, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-rose-400 font-semibold">
                        {symbol}{formatAmt(n.current_amount, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-rose-400">
                        +{symbol}{formatAmt(n.exceeded_by, { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td>
                      {n.message?.includes('SMTP Delivery Failed') ? (
                        <button
                          type="button"
                          onClick={() => setSelectedNotifForError(n)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition-colors shadow-sm"
                          title="Click to view full SMTP relay diagnostic error and solution"
                        >
                          <AlertTriangle size={12} className="text-rose-400" />
                          <span>SMTP Failed (Diagnostic)</span>
                        </button>
                      ) : n.message?.includes('Sent via SMTP') ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-help"
                          title={n.message}
                        >
                          <CheckCircle2 size={11} /> Sent via SMTP
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-help"
                          title={n.message}
                        >
                          <CheckCircle2 size={11} /> Logged (Mock Mode)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="budget-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="budget-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="budget-modal-header">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <span>{editingBudget ? 'Edit Threshold Setting' : 'Create Threshold Alert'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.08]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="budget-modal-body">
                {modalError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                    {modalError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Threshold Label / Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Monthly Dining Cap, Travel Expense Limit"
                    className="form-input"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <CustomSelect
                      value={type}
                      onChange={(val) => {
                        setType(val);
                        setCategoryId('');
                      }}
                      options={typeOptions}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Evaluation Period</label>
                    <CustomSelect
                      value={period}
                      onChange={(val) => setPeriod(val)}
                      options={periodOptions}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Category Scope</label>
                  <CustomSelect
                    value={categoryId}
                    onChange={(val) => setCategoryId(val)}
                    options={categoryOptions}
                    placeholder="Global (All Transactions)"
                  />
                  <span className="form-hint">
                    Choose a specific category or apply globally to all cashflow transactions.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Threshold Amount ({symbol}) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={thresholdAmount}
                    onChange={(e) => setThresholdAmount(e.target.value)}
                    placeholder="e.g. 5000.00"
                    className="form-input font-mono"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Alert Recipient Email (Optional)</label>
                  <input
                    type="email"
                    value={alertEmail}
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder={user?.email || 'Defaults to account email'}
                    className="form-input"
                  />
                  <span className="form-hint">
                    If left blank, notifications are sent to your login email ({user?.email}).
                  </span>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-900 border-slate-700"
                    />
                    <span className="text-sm font-medium text-slate-200">
                      Enable active monitoring and background email alerts
                    </span>
                  </label>
                </div>
              </div>

              <div className="budget-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingBudget ? 'Update Threshold' : 'Create Threshold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {selectedNotifForError && (
        <div className="budget-modal-backdrop" onClick={() => setSelectedNotifForError(null)}>
          <div className="budget-modal-dialog !max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="budget-modal-header bg-rose-500/10 border-b border-rose-500/20">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-base font-bold text-white">SMTP Delivery Diagnostic</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotifForError(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="budget-modal-body space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Alert Subject</span>
                <p className="text-sm font-semibold text-white mt-0.5">{selectedNotifForError.subject}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400 block mb-0.5">Recipient Target</span>
                  <span className="text-slate-200 font-medium font-mono">{selectedNotifForError.recipient_email}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-slate-400 block mb-0.5">Triggered Spending</span>
                  <span className="text-rose-400 font-semibold font-mono">
                    {symbol}{formatAmt(selectedNotifForError.current_amount, { minimumFractionDigits: 2 })} / {symbol}{formatAmt(selectedNotifForError.threshold_amount, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Server Diagnostic Output
                </span>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-rose-300 whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto">
                  {selectedNotifForError.message}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <Info size={14} className="text-amber-400" />
                  <span>Why Did This Happen?</span>
                </div>
                <p className="leading-relaxed">
                  Your Python background worker correctly computed and triggered the alert. However, <strong>Microsoft 365 Exchange Online</strong> rejected SMTP authentication with error <code className="text-amber-300 font-mono">535 5.7.139 SmtpClientAuthentication is disabled for the Tenant</code>. Microsoft disables basic SMTP AUTH by default on organizational domains (<code className="text-amber-300">@mitrahsoft.in</code>).
                </p>
                <div className="font-semibold text-white pt-1">Recommended Fixes:</div>
                <ul className="list-disc pl-5 space-y-1 text-slate-300">
                  <li>
                    <strong>Personal Gmail (Instant):</strong> Generate a 16-character App Password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-indigo-400 underline inline-flex items-center gap-0.5">Google App Passwords <ExternalLink size={10} /></a> and set <code className="text-slate-200 font-mono">SMTP_HOST=smtp.gmail.com</code>.
                  </li>
                  <li>
                    <strong>Free SMTP Relay:</strong> Use Brevo (Sendinblue) or SendGrid which provide instant SMTP keys on port 587.
                  </li>
                  <li>
                    <strong>M365 Admin:</strong> Have your tenant administrator enable Authenticated SMTP for your account using PowerShell: <code className="text-slate-200 font-mono text-[10px]">Set-CASMailbox -Identity {selectedNotifForError.recipient_email} -SmtpClientAuthenticationEnabled $true</code>.
                  </li>
                </ul>
              </div>
            </div>

            <div className="budget-modal-footer">
              <button
                type="button"
                onClick={() => setSelectedNotifForError(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/[0.08] hover:bg-white/[0.12] text-white transition-colors"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetsPage;


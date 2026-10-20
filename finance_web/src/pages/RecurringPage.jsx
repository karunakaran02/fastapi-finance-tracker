import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  X,
  ShieldCheck,
} from 'lucide-react';
import api from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import './RecurringPage.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'yearly', label: 'Yearly' },
];

export const RecurringPage = () => {
  const { symbol, currency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [forecastDays, setForecastDays] = useState(30);
  const [forecast, setForecast] = useState(null);
  const [recurringList, setRecurringList] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'expense',
    amount: '',
    frequency: 'monthly',
    next_due_date: new Date().toISOString().split('T')[0],
    category_id: '',
    notes: '',
  });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fc, recList, sugs, cats] = await Promise.all([
        api.getCashRunwayForecast({ days: forecastDays }),
        api.getRecurringItems(),
        api.getRecurringSuggestions().catch(() => []),
        api.getCategories().catch(() => []),
      ]);
      setForecast(fc);
      setRecurringList(recList || []);
      setSuggestions(sugs || []);
      setCategories(cats || []);
    } catch (err) {
      showToast('error', err.message || 'Failed to load runway forecast.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [forecastDays]);

  const handleOpenAdd = (suggested = null) => {
    if (suggested) {
      setEditingItem(null);
      setFormData({
        name: suggested.name,
        type: 'expense',
        amount: String(suggested.detected_amount),
        frequency: suggested.frequency || 'monthly',
        next_due_date: new Date().toISOString().split('T')[0],
        category_id: suggested.category_id ? String(suggested.category_id) : '',
        notes: `Auto-detected from ${suggested.occurrences_count} previous transactions`,
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        type: 'expense',
        amount: '',
        frequency: 'monthly',
        next_due_date: new Date().toISOString().split('T')[0],
        category_id: categories[0]?.id ? String(categories[0].id) : '',
        notes: '',
      });
    }
    setShowModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    const dateStr = item.next_due_date ? item.next_due_date.split('T')[0] : new Date().toISOString().split('T')[0];
    setFormData({
      name: item.name,
      type: item.type,
      amount: String(item.amount),
      frequency: item.frequency,
      next_due_date: dateStr,
      category_id: item.category_id ? String(item.category_id) : '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.amount || Number(formData.amount) <= 0) {
      showToast('error', 'Please provide a valid title and positive amount.');
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        amount: Number(formData.amount).toFixed(2),
        frequency: formData.frequency,
        next_due_date: new Date(formData.next_due_date).toISOString(),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        notes: formData.notes.trim() || null,
      };

      if (editingItem) {
        await api.updateRecurringItem(editingItem.id, payload);
        showToast('success', 'Recurring item updated successfully.');
      } else {
        await api.createRecurringItem(payload);
        showToast('success', 'New recurring item tracked successfully.');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      showToast('error', err.message || 'Failed to save recurring item.');
    }
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'active' ? 'paused' : 'active';
    try {
      await api.updateRecurringItem(item.id, { status: nextStatus });
      showToast('success', `Subscription status marked as ${nextStatus}.`);
      fetchData();
    } catch (err) {
      showToast('error', err.message || 'Failed to update status.');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.deleteRecurringItem(deleteConfirm.id);
      showToast('success', 'Subscription deleted successfully.');
      setDeleteConfirm(null);
      fetchData();
    } catch (err) {
      showToast('error', err.message || 'Failed to delete recurring item.');
    }
  };

  const chartData = useMemo(() => {
    if (!forecast?.daily_timeline) return null;
    const labels = forecast.daily_timeline.map((pt) => pt.date.slice(5));
    const balances = forecast.daily_timeline.map((pt) => Number(pt.projected_balance));
    return {
      labels,
      datasets: [
        {
          label: 'Projected Balance',
          data: balances,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: balances.length > 40 ? 0 : 2,
          pointHoverRadius: 6,
          pointBackgroundColor: '#06b6d4',
        },
      ],
    };
  }, [forecast]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0f172a',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#f8fafc',
        bodyColor: '#38bdf8',
        padding: 10,
        callbacks: {
          label: (context) => ` Projected: ${symbol}${Number(context.raw || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
          afterLabel: (context) => {
            const idx = context.dataIndex;
            const pt = forecast?.daily_timeline?.[idx];
            if (pt?.events && pt.events.length > 0) {
              return `Events: ${pt.events.join(', ')}`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', maxTicksLimit: 8, font: { size: 10 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: (val) => `${symbol}${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`,
        },
      },
    },
  };

  const runwayStatusBadge = (status, days) => {
    if (status === 'infinite_growth') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <TrendingUp size={13} /> Positive Cash Growth
        </span>
      );
    }
    if (status === 'critical') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <AlertTriangle size={13} /> Runway: {days} Days (Action Needed)
        </span>
      );
    }
    if (status === 'moderate') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <Clock size={13} /> Runway: {days} Days (Moderate)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <ShieldCheck size={13} /> Runway: {days} Days (Healthy)
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-slate-900 border-emerald-500/40 text-emerald-300'
              : 'bg-slate-900 border-rose-500/40 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
              Subscriptions &amp; Cash Runway
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-container/10 text-primary-fixed-dim border border-primary-container/20">
              Predictive AI
            </span>
          </div>
          <p className="text-xs sm:text-sm text-outline mt-0.5">
            Forecast forward-looking runway horizons and manage recurring subscriptions
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="segmented-filter-group">
            {[14, 30, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setForecastDays(d)}
                className={`segmented-filter-btn ${forecastDays === d ? 'active' : ''}`}
              >
                {d}D
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="recurring-refresh-btn p-2 rounded-xl transition-colors hover:opacity-80"
            title="Refresh forecast"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => handleOpenAdd()}
            className="btn btn-add-transaction flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-semibold text-xs"
          >
            <Plus size={15} />
            <span>Add Recurring</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="recurring-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-outline">
              Monthly Recurring Burn
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <TrendingDown size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-on-surface">
              {symbol}
              {Number(forecast?.monthly_recurring_burn || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-outline mt-1">Fixed repeating monthly expenses</p>
          </div>
        </div>

        <div className="recurring-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-outline">
              Monthly Recurring Inflow
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <TrendingUp size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-on-surface">
              {symbol}
              {Number(forecast?.monthly_recurring_income || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-outline mt-1">Predictable salary &amp; retainers</p>
          </div>
        </div>

        <div className="recurring-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-outline">
              Upcoming (Next 7 Days)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-on-surface">
              {symbol}
              {Number(forecast?.upcoming_7_days_total || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[11px] text-outline mt-1">
              {forecast?.upcoming_7_days_count || 0} bills due in next 7 days
            </p>
          </div>
        </div>

        <div className="recurring-card p-5 rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-outline">
              Projected End Balance
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Zap size={16} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-on-surface">
              {symbol}
              {Number(forecast?.projected_end_balance || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="mt-2">{runwayStatusBadge(forecast?.runway_status, forecast?.runway_days)}</div>
          </div>
        </div>
      </div>

      {suggestions && suggestions.length > 0 && (
        <div className="recurring-smart-banner rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-cyan-500 animate-pulse" />
            <h2 className="text-sm font-bold text-on-surface">
              Smart Detection: Found {suggestions.length} recurring patterns in your transaction history
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((sug, idx) => (
              <div
                key={idx}
                className="recurring-suggestion-card rounded-xl p-3 flex items-center justify-between"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-semibold text-xs text-on-surface truncate">{sug.name}</div>
                  <div className="text-[11px] text-outline mt-0.5">
                    {symbol}
                    {Number(sug.detected_amount).toLocaleString()} • {sug.frequency} ({sug.occurrences_count}x detected)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAdd(sug)}
                  className="recurring-track-btn"
                >
                  + Track
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="recurring-card p-5 sm:p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-on-surface">
              {forecastDays}-Day Projected Cashflow Curve
            </h2>
            <p className="text-xs text-outline mt-0.5">
              Simulated cash balance trajectory considering planned bills, subscriptions, and recurring income
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-outline font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <span>Projected Balance</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
              <span>Baseline: {symbol}{Number(forecast?.current_liquid_balance || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full">
          {chartData ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-outline text-xs">
              Calculating runway horizon...
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="recurring-card p-5 rounded-2xl lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-on-surface">Upcoming Milestones</h2>
            <span className="text-xs text-outline font-mono">
              {forecast?.upcoming_milestones?.length || 0} scheduled
            </span>
          </div>

          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {forecast?.upcoming_milestones && forecast.upcoming_milestones.length > 0 ? (
              forecast.upcoming_milestones.map((ms, idx) => {
                const isInc = ms.type === 'income';
                return (
                  <div
                    key={idx}
                    className="recurring-milestone-card p-3 rounded-xl flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-on-surface truncate">{ms.name}</span>
                        {ms.days_until_due <= 3 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-500">
                            Soon
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-outline mt-0.5 flex items-center gap-2">
                        <span>
                          {ms.days_until_due === 0
                            ? 'Today'
                            : ms.days_until_due === 1
                            ? 'Tomorrow'
                            : `In ${ms.days_until_due} days`}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{ms.frequency}</span>
                      </div>
                    </div>
                    <div
                      className={`font-mono text-xs font-bold shrink-0 ${
                        isInc ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {isInc ? '+' : '-'}
                      {symbol}
                      {Number(ms.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-outline text-xs">
                No upcoming commitments in this horizon.
              </div>
            )}
          </div>
        </div>

        <div className="recurring-card p-5 rounded-2xl lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-on-surface">Active Subscriptions &amp; Commitments</h2>
              <p className="text-xs text-outline mt-0.5">Manage fixed monthly subscriptions, leases, and recurring income</p>
            </div>
            <span className="text-xs text-outline font-mono">
              {recurringList.length} items
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="recurring-table w-full text-left text-xs">
              <thead>
                <tr className="uppercase font-semibold text-[10px]">
                  <th className="pb-3 pl-2">Name &amp; Details</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Frequency</th>
                  <th className="pb-3">Next Due</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recurringList.map((item) => {
                  const isInc = item.type === 'income';
                  const isPaused = item.status === 'paused';
                  return (
                    <tr key={item.id} className="recurring-table-row">
                      <td className="py-3 pl-2">
                        <div className="font-semibold text-on-surface">{item.name}</div>
                        <div className="text-[11px] text-outline truncate max-w-[180px]">
                          {item.notes || (item.category_name ? `Category: ${item.category_name}` : 'No notes')}
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            isInc
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                        >
                          {isInc ? 'Inflow' : 'Expense'}
                        </span>
                      </td>
                      <td className="py-3 capitalize text-on-surface font-medium">
                        {item.frequency}
                      </td>
                      <td className="py-3 text-outline">
                        <div>{item.next_due_date ? item.next_due_date.slice(0, 10) : '-'}</div>
                        <div className="text-[10px] opacity-75">
                          {item.days_until_due >= 0 ? `${item.days_until_due}d left` : 'Due today'}
                        </div>
                      </td>
                      <td className={`py-3 text-right font-mono font-bold ${isInc ? 'text-emerald-500' : 'text-on-surface'}`}>
                        {symbol}
                        {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(item)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                            isPaused
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                          }`}
                          title={`Click to ${isPaused ? 'resume' : 'pause'}`}
                        >
                          {isPaused ? 'Paused' : 'Active'}
                        </button>
                      </td>
                      <td className="py-3 text-right pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="recurring-action-btn p-1.5 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(item)}
                            className="recurring-action-btn p-1.5 rounded-lg hover:!text-rose-500"
                            title="Delete"
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
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="recurring-modal-card w-full max-w-md rounded-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-inherit">
              <h3 className="text-base font-bold text-on-surface">
                {editingItem ? 'Edit Recurring Item' : 'New Recurring Subscription'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="recurring-action-btn p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block text-outline font-medium mb-1">Title / Vendor</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS Cloud, Office Rent, Retainer"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="recurring-input w-full px-3 py-2 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-outline font-medium mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="recurring-input w-full px-3 py-2 rounded-xl focus:outline-none"
                  >
                    <option value="expense">Expense (Outflow)</option>
                    <option value="income">Income (Inflow)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-outline font-medium mb-1">Amount ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="recurring-input w-full px-3 py-2 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-outline font-medium mb-1">Frequency</label>
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="recurring-input w-full px-3 py-2 rounded-xl focus:outline-none capitalize"
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-outline font-medium mb-1">Next Due Date</label>
                  <input
                    type="date"
                    required
                    value={formData.next_due_date}
                    onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                    className="recurring-input w-full px-3 py-2 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-outline font-medium mb-1">Category (Optional)</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="recurring-input w-full px-3 py-2 rounded-xl focus:outline-none"
                >
                  <option value="">General / None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-outline font-medium mb-1">Notes / Contract Details</label>
                <textarea
                  rows={2}
                  placeholder="Subscription notes, renewal terms, billing account..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="recurring-input w-full px-3 py-2 rounded-xl focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="recurring-cancel-btn px-4 py-2 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-sm"
                >
                  {editingItem ? 'Save Changes' : 'Create Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="recurring-modal-card w-full max-w-sm rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
              <Trash2 size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-on-surface">Delete Subscription?</h3>
              <p className="text-xs text-outline mt-1">
                Are you sure you want to remove <span className="text-on-surface font-semibold">{deleteConfirm.name}</span>? This will remove it from future cashflow runway projections.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="recurring-cancel-btn px-4 py-2 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecurringPage;


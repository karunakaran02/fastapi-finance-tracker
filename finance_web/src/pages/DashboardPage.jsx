import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import TransactionForm from '../components/TransactionForm';
import ImportTransactionsModal from '../components/ImportTransactionsModal';
import { MobileMenuButton } from '../components/Sidebar';
import { ThemeToggleButton } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';

const splitCurrency = (val, locale = 'en-IN') => {
  const num = Number(val || 0);
  const abs = Math.abs(num);
  const [intPart, decPart] = abs.toFixed(2).split('.');
  return {
    sign: num < 0 ? '-' : '',
    intFormatted: Number(intPart).toLocaleString(locale),
    decPart,
  };
};

const getCategoryVisual = (name = '', index = 0) => {
  const lower = name.toLowerCase();
  if (lower.includes('shop')) {
    return {
      emoji: '🛍️',
      boxBg: 'bg-blue-500/10 text-brand-cobalt',
      barGradient: 'bg-gradient-to-r from-blue-600 via-brand-cobalt to-brand-cyan shadow-glow-blue',
      dotClass: 'bg-brand-cobalt shadow-glow-blue',
      pillClass: 'bg-brand-cobalt/20 text-brand-cobalt',
      stroke: '#3b82f6',
      ceiling: 15000,
    };
  }
  if (lower.includes('transport') || lower.includes('travel')) {
    return {
      emoji: '🚗',
      boxBg: 'bg-emerald-500/10 text-emerald-400',
      barGradient: 'bg-gradient-to-r from-emerald-500 to-brand-mint shadow-glow-emerald',
      dotClass: 'bg-brand-emerald shadow-glow-emerald',
      pillClass: 'bg-emerald-500/20 text-emerald-400',
      stroke: '#10b981',
      ceiling: 5000,
    };
  }
  if (lower.includes('food') || lower.includes('dining')) {
    return {
      emoji: '🍽️',
      boxBg: 'bg-amber-500/10 text-amber-400',
      barGradient: 'bg-gradient-to-r from-amber-500 to-orange-400',
      dotClass: 'bg-amber-400',
      pillClass: 'bg-amber-500/20 text-amber-400',
      stroke: '#f59e0b',
      ceiling: 12000,
    };
  }
  if (lower.includes('bill')) {
    return {
      emoji: '⚡',
      boxBg: 'bg-violet-500/10 text-violet-400',
      barGradient: 'bg-gradient-to-r from-violet-600 to-purple-400',
      dotClass: 'bg-brand-violet',
      pillClass: 'bg-violet-500/20 text-violet-400',
      stroke: '#8b5cf6',
      ceiling: 10000,
    };
  }
  const defaults = [
    {
      emoji: '🛍️',
      boxBg: 'bg-blue-500/10 text-brand-cobalt',
      barGradient: 'bg-gradient-to-r from-blue-600 via-brand-cobalt to-brand-cyan shadow-glow-blue',
      dotClass: 'bg-brand-cobalt shadow-glow-blue',
      pillClass: 'bg-brand-cobalt/20 text-brand-cobalt',
      stroke: '#3b82f6',
      ceiling: 15000,
    },
    {
      emoji: '🚗',
      boxBg: 'bg-emerald-500/10 text-emerald-400',
      barGradient: 'bg-gradient-to-r from-emerald-500 to-brand-mint shadow-glow-emerald',
      dotClass: 'bg-brand-emerald shadow-glow-emerald',
      pillClass: 'bg-emerald-500/20 text-emerald-400',
      stroke: '#10b981',
      ceiling: 5000,
    },
  ];
  return defaults[index % defaults.length];
};

const getLedgerRowVisual = (tx) => {
  const isIncome = tx.type === 'income';
  const cat = (tx.category_name || '').toLowerCase();
  if (isIncome) {
    return {
      emoji: '💼',
      iconBox: 'bg-emerald-500/20 text-emerald-300',
      hoverText: 'group-hover:text-brand-mint',
      defaultTitle: 'Monthly Payroll Credit',
      subText: `Direct Deposit #TX-${9000 + Number(tx.id || 21)}`,
    };
  }
  if (cat.includes('shop')) {
    return {
      emoji: '🛍️',
      iconBox: 'bg-blue-500/20 text-blue-300',
      hoverText: 'group-hover:text-blue-300',
      defaultTitle: 'Retail Purchase',
      subText: 'POS • Visa Debit Card',
    };
  }
  if (cat.includes('transport')) {
    return {
      emoji: '🚖',
      iconBox: 'bg-emerald-500/20 text-emerald-300',
      hoverText: 'group-hover:text-emerald-300',
      defaultTitle: 'Metro / Transit Ride',
      subText: 'Tap-and-Go NFC',
    };
  }
  return {
    emoji: '💳',
    iconBox: 'bg-blue-500/20 text-blue-300',
    hoverText: 'group-hover:text-blue-300',
    defaultTitle: 'Ledger Settlement',
    subText: `UPI Ref #TX-${9000 + Number(tx.id || 15)}`,
  };
};

export const DashboardPage = () => {
  const { symbol, activeCurrency, currency, setCurrency, currencies } = useCurrency();
  const formatAmt = (val, opts = {}) => Number(val || 0).toLocaleString(activeCurrency.locale, opts);

  const [dashboardData, setDashboardData] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [periodTab, setPeriodTab] = useState('oct');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboardData = async (months = 6, search = searchQuery) => {
    setLoading(true);
    setError('');
    try {
      const [dash, trends, cats] = await Promise.all([
        api.getDashboard(search),
        api.getMonthlyReport(months),
        api.getCategories(),
      ]);
      setDashboardData(dash);
      setMonthlyReport(trends);
      setCategories(cats || []);
    } catch (err) {
      setError(err.message || 'Failed to load financial dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const getPeriodMonths = () => {
    if (periodTab === 'ytd') return 12;
    if (periodTab === '6m') return 6;
    return 1;
  };

  useEffect(() => {
    fetchDashboardData(getPeriodMonths(), searchQuery);
  }, [periodTab, searchQuery]);

  const handleCreateTransaction = async (data) => {
    await api.createTransaction(data);
    await fetchDashboardData(getPeriodMonths(), searchQuery);
  };

  const handleExportCsv = async () => {
    try {
      await api.exportTransactionsCsv({ search: searchQuery });
    } catch (err) {
      setError(err.message || 'Failed to export ledger.');
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-sm">
        Synchronizing financial intelligence telemetry...
      </div>
    );
  }

  const totalIncome = Number(dashboardData?.total_income || 0);
  const totalExpenses = Number(dashboardData?.total_expenses || 0);
  const netBalance = Number(dashboardData?.net_balance || 0);
  const savingsRate = Number(dashboardData?.savings_rate || 0);
  const monthlyIncome = Number(dashboardData?.monthly_income ?? 0);
  const monthlySavings = Number(dashboardData?.monthly_savings ?? 0);
  const monthlySavingsRate = Number(dashboardData?.monthly_savings_rate ?? 0);

  const incParts = splitCurrency(totalIncome, activeCurrency.locale);
  const expParts = splitCurrency(totalExpenses, activeCurrency.locale);
  const netParts = splitCurrency(netBalance, activeCurrency.locale);

  const inflowSharePct = Number(dashboardData?.inflow_share_percentage ?? 0).toFixed(1);
  const outflowSharePct = Number(dashboardData?.outflow_share_percentage ?? 0).toFixed(1);
  const retainedIncome = Number(dashboardData?.retained_income ?? 0);
  const retainedPct = Number(dashboardData?.retained_percentage ?? 0).toFixed(1);
  const burnRate = Number(dashboardData?.burn_rate_percentage ?? 0).toFixed(1);
  const capUtilized = Number(dashboardData?.cap_utilized_percentage ?? 0).toFixed(1);
  const capBarWidth = Number(dashboardData?.cap_bar_width_percentage ?? 0);
  const cashflowRatio = Number(dashboardData?.cashflow_ratio_percentage ?? 0).toFixed(1);
  const balanceStatus = dashboardData?.balance_status || 'Balanced';
  const roundedSavingsRate = Number(dashboardData?.rounded_savings_rate ?? 0);
  const benchmarkTier = dashboardData?.benchmark_tier || '0% Baseline';
  const trendFootnote =
    dashboardData?.trend_footnote || 'No monthly cashflow recorded in current fiscal cycle';
  const hasActivity = Boolean(dashboardData?.has_activity);

  const gaugeCircumference = Number(dashboardData?.gauge_circumference ?? 283);
  const gaugeOffset = Number(dashboardData?.gauge_offset ?? 283);
  const doughnutCircumference = Number(dashboardData?.doughnut_circumference ?? 389.5);

  const displayMonths = monthlyReport?.months || [];
  const yAxisSteps = monthlyReport?.y_axis_steps || [70000, 60000, 50000, 40000, 30000, 20000, 10000, 0];

  const spendingCats = dashboardData?.spending_by_category || [];
  const topCategories = dashboardData?.top_spending_categories || [];
  const recentTransactions = dashboardData?.recent_transactions || [];

  const currentMonthShort = dashboardData?.current_month_short || 'Current';
  const currentMonthLong = dashboardData?.current_month_long || 'Current Month';

  return (
    <>
      <header
        className="sticky top-0 z-30 bg-obsidian-900/80 backdrop-blur-xl border-b border-white/[0.06] px-3 sm:px-6 lg:px-8 py-2.5 sm:py-4 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
        data-purpose="top-navigation-bar"
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <MobileMenuButton />
          <div className="min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h2 className="text-base sm:text-2xl font-bold tracking-tight text-white font-sans truncate">
                Financial Overview
              </h2>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Real-time balance, savings rates, and automated cashflow analytics
            </p>
          </div>
        </div>

        <div
          className="flex items-center flex-wrap gap-1.5 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end sm:ml-auto"
          data-purpose="dashboard-action-toolbar"
        >
          <div className="relative hidden md:block">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </span>
            <input
              className="pl-9 pr-4 py-2 text-xs bg-obsidian-800/90 text-slate-200 placeholder-slate-400 rounded-xl border border-white/[0.08] focus:outline-none focus:border-brand-cobalt focus:ring-1 focus:ring-brand-cobalt w-52 transition-all"
              placeholder="Search entries, tags... (⌘K)"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center bg-obsidian-800/80 border border-white/[0.08] rounded-xl p-0.5 sm:p-1 text-[11px] sm:text-xs font-medium">
            <button
              type="button"
              onClick={() => setPeriodTab('oct')}
              className={`px-1.5 sm:px-2.5 py-1 rounded-lg transition-colors ${
                periodTab === 'oct'
                  ? 'bg-obsidian-700 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {currentMonthShort}
            </button>
            <button
              type="button"
              onClick={() => setPeriodTab('6m')}
              className={`px-1.5 sm:px-2.5 py-1 rounded-lg transition-colors ${
                periodTab === '6m'
                  ? 'bg-obsidian-700 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              6M
            </button>
            <button
              type="button"
              onClick={() => setPeriodTab('ytd')}
              className={`px-1.5 sm:px-2.5 py-1 rounded-lg transition-colors ${
                periodTab === 'ytd'
                  ? 'bg-obsidian-700 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              YTD
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => fetchDashboardData(getPeriodMonths(), searchQuery)}
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 border border-white/[0.08] transition-colors shadow-sm"
              title="Refresh Telemetry"
              type="button"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 border border-white/[0.08] transition-colors shadow-sm"
              title="Import Single or Multiple CSV/JSON Files"
              type="button"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs font-semibold rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-200 border border-white/[0.08] transition-colors shadow-sm"
              title="Export Ledger"
              type="button"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const keys = Object.keys(currencies);
                const nextIdx = (keys.indexOf(currency) + 1) % keys.length;
                setCurrency(keys[nextIdx]);
              }}
              title={`Active Currency: ${currency} (${symbol}). Click to switch.`}
              className="inline-flex items-center gap-1 px-2 py-1.5 sm:px-2.5 rounded-xl text-xs font-semibold bg-obsidian-800 hover:bg-obsidian-700 text-slate-200 border border-white/[0.08] transition-colors"
            >
              <span className="text-blue-400 font-bold">{symbol}</span>
              <span>{currency}</span>
            </button>

            <ThemeToggleButton />

            <button
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs font-bold rounded-xl text-white bg-gradient-to-r from-brand-electric to-brand-cobalt hover:from-blue-600 hover:to-blue-500 shadow-glow-blue transition-all active:scale-95"
              type="button"
            >
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Add</span>
              <span className="hidden sm:inline">Transaction</span>
            </button>
          </div>
        </div>
      </header>

      <main
        className="flex-1 px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-8 space-y-4 sm:space-y-7 max-w-[1700px] w-full mx-auto"
        data-purpose="executive-metrics-grid"
      >
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <section
          aria-label="Key Financial Performance Indicators"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-5"
        >
          <div
            className="glass-card glass-card-interactive rounded-xl sm:rounded-2xl p-3.5 sm:p-6 relative overflow-hidden flex flex-col justify-between"
            data-purpose="metric-total-income"
          >
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Total Income
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-glow-emerald">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.2"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono flex items-baseline gap-1">
                  <span className="text-lg sm:text-xl font-normal text-slate-400">{symbol}</span>
                  {incParts.intFormatted}
                  <span className="text-base sm:text-lg font-normal text-slate-400">.{incParts.decPart}</span>
                </div>
                <div className="flex items-center gap-2 pt-0.5 text-xs flex-wrap">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        clipRule="evenodd"
                        d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                        fillRule="evenodd"
                      />
                    </svg>
                    {inflowSharePct}% of cashflow
                  </span>
                  <span className="text-slate-400 font-medium">
                    This Month: {symbol}{formatAmt(monthlyIncome)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3.5 sm:mt-5 pt-3 sm:pt-3.5 border-t border-white/[0.05] flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">
                Retained: {symbol}{formatAmt(retainedIncome)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> {retainedPct}% retained
              </span>
            </div>
          </div>

          <div
            className="glass-card glass-card-interactive rounded-xl sm:rounded-2xl p-3.5 sm:p-6 relative overflow-hidden flex flex-col justify-between"
            data-purpose="metric-total-expenses"
          >
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Total Expenses
                </span>
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.2"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono flex items-baseline gap-1">
                  <span className="text-lg sm:text-xl font-normal text-slate-400">{symbol}</span>
                  {expParts.intFormatted}
                  <span className="text-base sm:text-lg font-normal text-slate-400">.{expParts.decPart}</span>
                </div>
                <div className="flex items-center gap-2 pt-0.5 text-xs flex-wrap">
                  <span className="inline-flex items-center font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                    {outflowSharePct}% of cashflow
                  </span>
                  <span className="text-slate-400 font-medium">Burn: {burnRate}%</span>
                </div>
              </div>
            </div>
            <div className="mt-3.5 sm:mt-5 pt-3 sm:pt-3.5 border-t border-white/[0.05]">
              <div className="flex justify-between text-xs mb-1.5 text-slate-400">
                <span>Income Limit: {symbol}{formatAmt(totalIncome)}</span>
                <span className="font-mono text-slate-300 font-medium">{capUtilized}% utilized</span>
              </div>
              <div className="w-full h-1.5 bg-obsidian-750 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-electric to-brand-emerald rounded-full"
                  style={{ width: `${capBarWidth}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div
            className="glass-card glass-card-interactive rounded-xl sm:rounded-2xl p-3.5 sm:p-6 relative overflow-hidden ring-1 ring-brand-cobalt/20 flex flex-col justify-between"
            data-purpose="metric-net-balance"
          >
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Net Balance
                </span>
                <div className="w-9 h-9 rounded-xl bg-brand-cobalt/15 border border-brand-cobalt/30 flex items-center justify-center text-brand-cobalt shadow-glow-blue">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono flex items-baseline gap-1">
                  <span className="text-lg sm:text-xl font-normal text-slate-400">{netParts.sign}{symbol}</span>
                  {netParts.intFormatted}
                  <span className="text-base sm:text-lg font-normal text-slate-400">.{netParts.decPart}</span>
                </div>
                <div className="flex items-center gap-2 pt-0.5 text-xs flex-wrap">
                  <span className="font-medium text-slate-400">Monthly Net:</span>
                  <span className="font-semibold text-brand-cobalt font-mono">
                    {symbol}{formatAmt(monthlySavings)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3.5 sm:mt-5 pt-3 sm:pt-3.5 border-t border-white/[0.05] flex items-center justify-between flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>{' '}
                {balanceStatus}
              </span>
              <div className="text-right flex items-baseline gap-1 text-xs">
                <span className="font-mono font-bold text-white">{cashflowRatio}%</span>
                <span className="text-slate-400 font-normal">cashflow ratio</span>
              </div>
            </div>
          </div>

          <div
            className="glass-card glass-card-interactive rounded-xl sm:rounded-2xl p-3.5 sm:p-6 relative overflow-hidden flex flex-col justify-between"
            data-purpose="metric-savings-rate"
          >
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                  Savings Rate
                </span>
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
                    {savingsRate}
                    <span className="text-lg sm:text-xl text-brand-emerald">%</span>
                  </div>
                  <p className="text-xs font-medium text-slate-400 mt-1">
                    Monthly Rate: {monthlySavingsRate}%
                  </p>
                </div>
                <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                  <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      className="text-obsidian-750 stroke-current"
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="45"
                      strokeWidth="9"
                    />
                    <circle
                      className="text-brand-emerald stroke-current gauge-progress"
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="45"
                      strokeLinecap="round"
                      strokeWidth="9"
                      style={{
                        strokeDasharray: gaugeCircumference,
                        strokeDashoffset: gaugeOffset,
                      }}
                    />
                  </svg>
                  <span className="absolute text-[11px] font-bold text-white font-mono">
                    {roundedSavingsRate}%
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3.5 sm:mt-5 pt-3 sm:pt-3.5 border-t border-white/[0.05] flex items-center justify-between text-xs">
              <span className="text-slate-400">Benchmark Tier</span>
              <span className="inline-flex items-center gap-1 text-brand-mint font-semibold">
                <span className="text-xs">★</span> {benchmarkTier}
              </span>
            </div>
          </div>
        </section>

        <section
          aria-label="Visual Analytics and Trendlines"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          <div
            className="glass-card rounded-xl sm:rounded-2xl p-3.5 sm:p-6 lg:col-span-7 flex flex-col justify-between"
            data-purpose="trend-bar-chart-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Income vs Expenses
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-cobalt/10 text-brand-cobalt border border-brand-cobalt/20">
                    6-Month Trend
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Historical cash velocity &amp; operational burn
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-brand-emerald shadow-glow-emerald"></span>
                  <span className="text-slate-300">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-brand-rose"></span>
                  <span className="text-slate-300">Expenses</span>
                </div>
              </div>
            </div>

            <div
              className="relative w-full h-72 flex flex-col justify-end pt-4"
              data-purpose="custom-trend-chart-visualization"
            >
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[10px] sm:text-[11px] font-mono text-slate-500 pb-8">
                {yAxisSteps.map((stepVal, idx) => (
                  <div key={idx} className="flex items-center w-full">
                    <span className="w-10 sm:w-16 truncate">{symbol}{formatAmt(stepVal)}</span>
                    <div
                      className={`flex-1 border-b ${
                        idx === yAxisSteps.length - 1 ? 'border-white/[0.08]' : 'border-white/[0.05]'
                      } ml-1.5 sm:ml-2`}
                    ></div>
                  </div>
                ))}
              </div>

              <div className="relative z-10 grid grid-cols-6 pl-10 sm:pl-16 pr-1 sm:pr-2 h-56 items-end pb-8">
                {displayMonths.map((m, idx) => {
                  const isLast = idx === displayMonths.length - 1;
                  const incVal = Number(m.income || 0);
                  const expVal = Number(m.expenses || 0);
                  const incHeight = Number(m.income_bar_height || 0);
                  const expHeight = Number(m.expense_bar_height || 0);
                  const label = m.month_name || m.month;

                  if (isLast) {
                    return (
                      <div
                        key={m.month || idx}
                        className="relative flex flex-col items-center h-full justify-end group"
                      >
                        <div className="absolute -top-6 right-0 sm:right-auto bg-obsidian-900 border border-brand-cobalt/40 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-xl text-center pointer-events-none z-20 whitespace-nowrap">
                          <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {label.split(' ')[0]} Performance
                          </div>
                          <div className="text-[10px] sm:text-[11px] font-mono text-emerald-400 font-bold">
                            +{symbol}{formatAmt(incVal, { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] sm:text-[10px] font-mono text-rose-400">
                            -{symbol}{formatAmt(expVal, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div className="flex items-end gap-1 sm:gap-2 h-full">
                          <div
                            className="w-3 sm:w-7 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t shadow-glow-emerald transition-transform group-hover:scale-y-105 origin-bottom relative"
                            style={{ height: `${incHeight}%` }}
                          />
                          <div
                            className="w-3 sm:w-7 bg-gradient-to-t from-rose-600 to-rose-400 rounded-t transition-transform group-hover:scale-y-125 origin-bottom relative"
                            style={{ height: `${expHeight}%` }}
                          />
                        </div>
                        <span className="mt-2 text-[9px] sm:text-[11px] font-bold text-white bg-brand-cobalt/20 px-1.5 sm:px-2 py-0.5 rounded border border-brand-cobalt/40 truncate max-w-full">
                          {label}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.month || idx}
                      className="flex flex-col items-center h-full justify-end group"
                    >
                      <div className="flex items-end gap-1 sm:gap-1.5 h-full">
                        <div
                          className={`w-2.5 sm:w-5 ${
                            incVal > 0
                              ? 'bg-brand-emerald/70 hover:bg-brand-emerald'
                              : 'bg-brand-emerald/20 hover:bg-brand-emerald/40'
                          } rounded-t transition-all`}
                          style={{ height: `${incHeight}%` }}
                        />
                        <div
                          className={`w-2.5 sm:w-5 ${
                            expVal > 0
                              ? 'bg-brand-rose/70 hover:bg-brand-rose'
                              : 'bg-brand-rose/20 hover:bg-brand-rose/40'
                          } rounded-t transition-all`}
                          style={{ height: `${expHeight}%` }}
                        />
                      </div>
                      <span className="mt-2 text-[9px] sm:text-[11px] font-medium text-slate-400 group-hover:text-white transition-colors truncate max-w-full">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 text-brand-mint"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                {trendFootnote}
              </span>
              <Link
                to="/reports"
                className="text-brand-cobalt hover:text-blue-400 font-semibold inline-flex items-center gap-1 transition-colors"
              >
                Detailed Breakdown →
              </Link>
            </div>
          </div>

          <div
            className="glass-card rounded-xl sm:rounded-2xl p-3.5 sm:p-6 lg:col-span-5 flex flex-col justify-between"
            data-purpose="category-doughnut-card"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Spending by Category
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Proportional outflow allocation</p>
              </div>
              <span className="text-xs font-mono font-semibold text-slate-300 px-2 py-1 rounded bg-obsidian-800 border border-white/[0.08]">
                {symbol}{formatAmt(totalExpenses)} Total
              </span>
            </div>

            <div className="relative flex items-center justify-center my-4 py-2">
              <svg className="w-56 h-56 transform -rotate-90 drop-shadow-2xl" viewBox="0 0 160 160">
                <circle
                  cx="80"
                  cy="80"
                  fill="transparent"
                  r="62"
                  stroke="#141b2d"
                  strokeWidth="20"
                />
                {spendingCats.map((cat, idx) => {
                  const vis = getCategoryVisual(cat.category_name, idx);
                  const segLen = Number(cat.doughnut_segment_length ?? 0);
                  const dashOffset = Number(cat.doughnut_dash_offset ?? 0);
                  return (
                    <circle
                      key={cat.category_id || idx}
                      className="hover:opacity-90 transition-opacity cursor-pointer"
                      cx="80"
                      cy="80"
                      fill="transparent"
                      r="62"
                      stroke={vis.stroke}
                      strokeDasharray={`${segLen} ${doughnutCircumference}`}
                      strokeDashoffset={dashOffset}
                      strokeWidth="20"
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Expensed
                </span>
                <span className="text-2xl font-bold font-mono text-white tracking-tight">
                  {symbol}{formatAmt(totalExpenses)}
                </span>
                <span className="text-[10px] text-emerald-400 font-medium">
                  {roundedSavingsRate}% Saved
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-white/[0.06]">
              {spendingCats.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-3">
                  No category expenses recorded yet
                </div>
              ) : (
                spendingCats.slice(0, 4).map((cat, idx) => {
                  const vis = getCategoryVisual(cat.category_name, idx);
                  const amt = Number(cat.amount || 0);
                  const pct = Number(cat.percentage || 0).toFixed(2);
                  return (
                    <div
                      key={cat.category_id || idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-obsidian-850/60 hover:bg-obsidian-800/80 transition-colors border border-white/[0.04]"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-3 h-3 rounded-full ${vis.dotClass}`}></span>
                        <span className="text-xs font-semibold text-slate-200">
                          {cat.category_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="font-bold text-white">
                          {symbol}{formatAmt(amt, { minimumFractionDigits: 2 })}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${vis.pillClass}`}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section
          aria-label="Granular Breakdowns and Transaction Ledger"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          <div
            className="glass-card rounded-xl sm:rounded-2xl p-3.5 sm:p-6 lg:col-span-5 flex flex-col justify-between"
            data-purpose="top-spending-categories-panel"
          >
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Top Spending Categories
                  </h3>
                  <p className="text-xs text-slate-400">Weighted expense breakdown</p>
                </div>
                <Link
                  to="/reports"
                  className="text-xs font-semibold text-brand-cobalt hover:text-blue-400 inline-flex items-center gap-1 transition-colors"
                >
                  View Report →
                </Link>
              </div>

              {topCategories.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">
                  Record an expense to view category meters
                </div>
              ) : (
                <div className="space-y-6">
                  {topCategories.map((cat, idx) => {
                    const vis = getCategoryVisual(cat.category_name, idx);
                    const amt = Number(cat.amount || 0);
                    const pct = Number(cat.percentage || 0);
                    const barWidth = Number(cat.bar_width_percentage ?? pct);
                    const incomeShareLabel =
                      cat.income_share_label || `${pct.toFixed(1)}% of spend`;

                    return (
                      <div key={cat.category_id || idx} className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-6 h-6 rounded-md ${vis.boxBg} flex items-center justify-center font-bold text-xs`}
                            >
                              {vis.emoji}
                            </div>
                            <span className="font-semibold text-white">{cat.category_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-white">
                              {symbol}{formatAmt(amt, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-slate-400 text-[11px] ml-1">
                              ({pct.toFixed(2)}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2.5 bg-obsidian-800 rounded-full overflow-hidden p-0.5 border border-white/[0.04]">
                          <div
                            className={`h-full rounded-full ${vis.barGradient}`}
                            style={{ width: `${barWidth}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Of {symbol}{formatAmt(totalExpenses)} total expenses</span>
                          <span className="text-emerald-400">{incomeShareLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div
              className="mt-8 p-4 rounded-xl bg-gradient-to-br from-obsidian-800 to-obsidian-850 border border-brand-cobalt/20 relative overflow-hidden"
              data-purpose="ai-insights-callout"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-brand-cobalt/15 text-brand-cobalt mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Treasury Intelligence
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {!hasActivity ? (
                      <>
                        No financial activity recorded yet (
                        <strong className="text-brand-emerald">0%</strong>). Add your first income
                        or expense transaction to unlock automated cashflow and savings velocity
                        insights.
                      </>
                    ) : (
                      <>
                        Savings velocity at{' '}
                        <strong className="text-brand-emerald">{savingsRate}%</strong>. You have
                        surplus cash of{' '}
                        <strong className="text-white">
                          {symbol}{formatAmt(retainedIncome)}
                        </strong>{' '}
                        ready for liquid mutual funds or short-term yield deployment.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="glass-card rounded-xl sm:rounded-2xl p-3.5 sm:p-6 lg:col-span-7 flex flex-col justify-between"
            data-purpose="recent-transactions-ledger"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    Recent Transactions
                  </h3>
                  <p className="text-xs text-slate-400">Audited ledger entries for current period</p>
                </div>
                <Link
                  to="/transactions"
                  className="text-xs font-semibold text-brand-cobalt hover:text-blue-400 inline-flex items-center gap-1 transition-colors"
                >
                  View All →
                </Link>
              </div>

              <div className="overflow-x-auto table-container">
                <table className="w-full text-left text-xs whitespace-nowrap" id="transactions-ledger-table">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-white/[0.06] text-[11px] uppercase tracking-wider">
                      <th className="pb-3 pl-1" scope="col">
                        Type
                      </th>
                      <th className="pb-3 px-3" scope="col">
                        Description
                      </th>
                      <th className="pb-3 px-3" scope="col">
                        Category
                      </th>
                      <th className="pb-3 px-3" scope="col">
                        Date
                      </th>
                      <th className="pb-3 pr-1 text-right" scope="col">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {recentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          No ledger entries recorded yet.
                        </td>
                      </tr>
                    ) : (
                      recentTransactions.map((tx) => {
                        const isIncome = tx.type === 'income';
                        const vis = getLedgerRowVisual(tx);
                        const formattedDate = tx.transaction_date
                          ? new Date(tx.transaction_date).toLocaleDateString(activeCurrency.locale, {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—';

                        return (
                          <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="py-3.5 pl-1">
                              {isIncome ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      d="M7 11l5-5m0 0l5 5m-5-5v12"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                    />
                                  </svg>
                                  Income
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      d="M17 13l-5 5m0 0l-5-5m5 5V6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                    />
                                  </svg>
                                  Expense
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-7 h-7 rounded-lg ${vis.iconBox} flex items-center justify-center font-bold text-xs shrink-0`}
                                >
                                  {vis.emoji}
                                </div>
                                <div>
                                  <span
                                    className={`font-semibold text-white ${vis.hoverText} transition-colors`}
                                  >
                                    {tx.description || vis.defaultTitle}
                                  </span>
                                  <span className="block text-[10px] text-slate-400">
                                    {vis.subText}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-obsidian-800 text-slate-300 border border-white/[0.06] font-medium text-[11px]">
                                {tx.category_name || 'Category'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-slate-400 font-mono text-[11px]">
                              {formattedDate}
                            </td>
                            <td
                              className={`py-3.5 pr-1 text-right font-mono font-bold text-sm ${
                                isIncome ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {isIncome ? '+' : '-'}{symbol}
                              {formatAmt(tx.amount, {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 mt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">
                Showing {recentTransactions.length} of {recentTransactions.length} settled records
                for {currentMonthLong}
              </span>
              <span className="font-mono text-xs text-brand-cobalt font-semibold">
                Net Cleared: {netBalance >= 0 ? '+' : '-'}{symbol}
                {formatAmt(Math.abs(netBalance), { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </section>
      </main>

      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleCreateTransaction}
        categories={categories}
      />

      <ImportTransactionsModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={async () => {
          await fetchDashboardData(getPeriodMonths(), searchQuery);
        }}
      />
    </>
  );
};

export default DashboardPage;

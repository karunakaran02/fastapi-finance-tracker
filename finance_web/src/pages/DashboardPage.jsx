import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Car,
  Utensils,
  Zap,
  Briefcase,
  Tag,
  CreditCard,
} from 'lucide-react';
import api from '../api/client';
import TransactionForm from '../components/TransactionForm';
import ImportTransactionsModal from '../components/ImportTransactionsModal';
import KpiCard from '../components/KpiCard';
import { MobileMenuButton } from '../components/Sidebar';
import { ThemeToggleButton, useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import './DashboardPage.css';

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
  if (lower.includes('shop') || lower.includes('cloud') || lower.includes('tech') || lower.includes('infra')) {
    return {
      icon: ShoppingBag,
      dotClass: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]',
      boxBg: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
      pillClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
      stroke: '#06B6D4',
      barGradient: 'bg-gradient-to-r from-cyan-500 to-sky-400',
    };
  }
  if (lower.includes('transport') || lower.includes('travel') || lower.includes('op') || lower.includes('tool')) {
    return {
      icon: Car,
      dotClass: 'bg-indigo-400 shadow-[0_0_8px_#818cf8]',
      boxBg: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
      pillClass: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
      stroke: '#818CF8',
      barGradient: 'bg-gradient-to-r from-indigo-500 to-violet-400',
    };
  }
  if (lower.includes('food') || lower.includes('dining') || lower.includes('market') || lower.includes('growth')) {
    return {
      icon: Utensils,
      dotClass: 'bg-rose-400 shadow-[0_0_8px_#f43f5e]',
      boxBg: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      pillClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      stroke: '#F43F5E',
      barGradient: 'bg-gradient-to-r from-rose-500 to-pink-400',
    };
  }
  if (lower.includes('bill') || lower.includes('util') || lower.includes('sub') || lower.includes('office')) {
    return {
      icon: Zap,
      dotClass: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
      boxBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      pillClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      stroke: '#F59E0B',
      barGradient: 'bg-gradient-to-r from-amber-500 to-orange-400',
    };
  }
  const palette = [
    {
      icon: ShoppingBag,
      dotClass: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]',
      boxBg: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
      pillClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
      stroke: '#06B6D4',
      barGradient: 'bg-gradient-to-r from-cyan-500 to-sky-400',
    },
    {
      icon: Car,
      dotClass: 'bg-indigo-400 shadow-[0_0_8px_#818cf8]',
      boxBg: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
      pillClass: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
      stroke: '#818CF8',
      barGradient: 'bg-gradient-to-r from-indigo-500 to-violet-400',
    },
    {
      icon: Tag,
      dotClass: 'bg-rose-400 shadow-[0_0_8px_#f43f5e]',
      boxBg: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
      pillClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
      stroke: '#F43F5E',
      barGradient: 'bg-gradient-to-r from-rose-500 to-pink-400',
    },
    {
      icon: Zap,
      dotClass: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
      boxBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
      pillClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      stroke: '#F59E0B',
      barGradient: 'bg-gradient-to-r from-amber-500 to-orange-400',
    },
  ];
  return palette[index % palette.length];
};

const getLedgerRowVisual = (tx) => {
  const isIncome = tx.type === 'income';
  const cat = (tx.category_name || '').toLowerCase();
  if (isIncome) {
    return {
      icon: Briefcase,
      iconBox: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      hoverText: 'group-hover:text-emerald-300',
    };
  }
  if (cat.includes('shop') || cat.includes('cloud') || cat.includes('infra')) {
    return {
      icon: ShoppingBag,
      iconBox: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
      hoverText: 'group-hover:text-cyan-300',
    };
  }
  if (cat.includes('transport') || cat.includes('travel') || cat.includes('op')) {
    return {
      icon: Car,
      iconBox: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
      hoverText: 'group-hover:text-indigo-300',
    };
  }
  if (cat.includes('food') || cat.includes('dining') || cat.includes('market')) {
    return {
      icon: Utensils,
      iconBox: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
      hoverText: 'group-hover:text-amber-300',
    };
  }
  return {
    icon: CreditCard,
    iconBox: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
    hoverText: 'group-hover:text-sky-300',
  };
};

export const DashboardPage = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const { symbol, activeCurrency, currency, setCurrency, currencies } = useCurrency();
  const { theme } = useTheme();
  const formatAmt = (val, opts = {}) => Number(val || 0).toLocaleString(activeCurrency.locale, opts);

  const [dashboardData, setDashboardData] = useState(null);
  const [monthlyReport, setMonthlyReport] = useState(null);
  const [categories, setCategories] = useState([]);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [periodTab, setPeriodTab] = useState('1m');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const months = periodTab === 'ytd' ? 12 : periodTab === '6m' ? 6 : 1;
      const [dash, trends, cats, fcData] = await Promise.all([
        api.getDashboard(),
        api.getMonthlyReport(months),
        api.getCategories().catch(() => []),
        api.getCashRunwayForecast({ days: 30 }).catch(() => null),
      ]);
      setDashboardData(dash);
      setMonthlyReport(trends);
      setCategories(cats || []);
      setForecastData(fcData);
    } catch (err) {
      setError(err.message || 'Failed to load financial dashboard.');
    } finally {
      setLoading(false);
    }
  }, [periodTab]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePeriodChange = async (tab) => {
    setPeriodTab(tab);
    try {
      const months = tab === 'ytd' ? 12 : tab === '6m' ? 6 : 1;
      const trends = await api.getMonthlyReport(months);
      setMonthlyReport(trends);
    } catch (err) {
      setError(err.message || 'Failed to load monthly trends.');
    }
  };

  const handleCreateTransaction = async (data) => {
    await api.createTransaction(data);
    await fetchDashboardData();
  };

  const handleExportCsv = async () => {
    try {
      await api.exportTransactionsCsv({ search: searchQuery });
    } catch (err) {
      setError(err.message || 'Failed to export ledger.');
    }
  };

  const recentTransactions = dashboardData?.recent_transactions || [];
  const displayedRecentTransactions = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return recentTransactions;
    const q = searchQuery.toLowerCase().trim();
    return recentTransactions.filter((tx) =>
      (tx.description || '').toLowerCase().includes(q) ||
      (tx.category_name || '').toLowerCase().includes(q) ||
      String(tx.amount || '').includes(q)
    );
  }, [recentTransactions, searchQuery]);

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
  const cashflowRatio = Number(dashboardData?.cashflow_ratio_percentage ?? 0).toFixed(1);
  const balanceStatus = dashboardData?.balance_status || 'Balanced';
  const roundedSavingsRate = Number(dashboardData?.rounded_savings_rate ?? 0);
  const benchmarkTier = dashboardData?.benchmark_tier || 'Top 5% Tier';
  const hasActivity = Boolean(dashboardData?.has_activity);

  const displayMonths = monthlyReport?.months || [];
  const yAxisSteps = monthlyReport?.y_axis_steps || [70000, 50000, 30000, 10000, 0];

  const spendingCats = dashboardData?.spending_by_category || [];
  const topCategories = dashboardData?.top_spending_categories || [];

  const currentMonthShort = dashboardData?.current_month_short || 'Nov 2026';
  const currentMonthLong = dashboardData?.current_month_long || 'Current Month';

  const arcCircumference = 88;
  const targetSavingsRate = 50;
  const arcDashOffset = arcCircumference - (arcCircumference * Math.min(Math.max(roundedSavingsRate, 0), 100)) / 100;

  return (
    <div className="dashboard-page-root flex-1 flex flex-col min-w-0">
      <header
        className="top-navbar-safe glacier-header sticky top-0 z-30 flex-shrink-0 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sm:gap-4 transition-colors duration-200"
        data-purpose="top-navigation-bar"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <MobileMenuButton />
          <div className="min-w-0">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-wrap">
              <h1 className="text-base sm:text-2xl font-bold tracking-tight text-white header-title font-sans truncate">
                Financial Overview
              </h1>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]"></span>
                <span className="hidden xs:inline">Live Sync</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 header-subtitle mt-0.5 hidden sm:block">
              Real-time balance, savings rates, and automated cashflow analytics
            </p>
          </div>
        </div>

        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative flex items-center">
            <svg
              className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
            </svg>
            <input
              ref={searchInputRef}
              className="w-full pl-10 pr-12 py-1.5 text-xs bg-white/[0.05] border border-white/[0.1] rounded-xl placeholder-slate-400 text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/50 transition-all backdrop-blur-md"
              placeholder="Search entries, tags, receipts..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-white/[0.08] border border-white/10 rounded pointer-events-none">
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 min-w-max ml-auto">
          <div className="flex items-center p-0.5 bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/[0.08] text-xs">
            <button
              type="button"
              onClick={() => handlePeriodChange('1m')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                periodTab === '1m'
                  ? 'glacier-period-active bg-cyan-500/20 font-medium text-cyan-300 border border-cyan-400/20 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {currentMonthShort}
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('6m')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                periodTab === '6m'
                  ? 'glacier-period-active bg-cyan-500/20 font-medium text-cyan-300 border border-cyan-400/20 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              6M
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('ytd')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                periodTab === 'ytd'
                  ? 'glacier-period-active bg-cyan-500/20 font-medium text-cyan-300 border border-cyan-400/20 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              YTD
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={fetchDashboardData}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-slate-200 shadow-glacier-sm transition-all"
              title="Refresh Telemetry"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-slate-200 shadow-glacier-sm transition-all"
              title="Import Records"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
              <span className="hidden sm:inline">Import</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-slate-200 shadow-glacier-sm transition-all"
              title="Export Report"
            >
              <svg
                className="w-3.5 h-3.5 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                ></path>
              </svg>
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>

          <div className="flex items-center space-x-1 pl-1">
            <button
              type="button"
              onClick={() => {
                const keys = Object.keys(currencies);
                const nextIdx = (keys.indexOf(currency) + 1) % keys.length;
                setCurrency(keys[nextIdx]);
              }}
              title={`Active Currency: ${currency} (${symbol}). Click to switch.`}
              className="px-2 py-1 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] rounded-xl text-xs font-medium text-slate-300 shadow-xs transition-colors"
            >
              <span className="text-cyan-400 font-bold mr-1">{symbol}</span>
              <span>{currency}</span>
            </button>

            <ThemeToggleButton />
          </div>

          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="frost-sheen glacier-add-btn flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white text-xs font-semibold shadow-glacier-btn transition-all duration-200 active:scale-95"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round"></path>
            </svg>
            <span>Add Transaction</span>
          </button>
        </div>
      </header>

      <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {error && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <section
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
          data-purpose="kpi-metrics-grid"
        >
          <KpiCard className="dashboard-kpi-income">
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Income
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-xs">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M7 17l9.2-9.2M17 17V8H8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-slate-400 text-lg font-light">{symbol}</span>
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">
                    {incParts.intFormatted}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">.{incParts.decPart}</span>
                </div>
                <div className="mt-2.5 flex items-center space-x-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ↑ {inflowSharePct}% of cashflow
                  </span>
                  <span className="text-[11px] text-slate-400">
                    This Month: {symbol}{formatAmt(monthlyIncome)}
                  </span>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs kpi-footer-divider">
                <span className="text-slate-400 font-medium">
                  Retained: {symbol}{formatAmt(retainedIncome)}
                </span>
                <span className="inline-flex items-center text-emerald-400 font-semibold text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 shadow-[0_0_6px_#10b981]"></span>
                  {retainedPct}% retained
                </span>
              </div>
            </div>
          </KpiCard>

          <KpiCard className="dashboard-kpi-expense">
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Total Expenses
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-xs">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M17 7L7.8 16.2M7.8 7v9.2h9.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-slate-400 text-lg font-light">{symbol}</span>
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">
                    {expParts.intFormatted}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">.{expParts.decPart}</span>
                </div>
                <div className="mt-2.5 flex items-center space-x-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {outflowSharePct}% of cashflow
                  </span>
                  <span className="text-[11px] text-slate-400">Burn: {burnRate}%</span>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs kpi-footer-divider">
                <span className="text-slate-400 font-medium">
                  Income Limit: {symbol}{formatAmt(totalIncome)}
                </span>
                <span className="text-slate-400 font-semibold text-[11px]">
                  {capUtilized}% utilized
                </span>
              </div>
            </div>
          </KpiCard>

          <KpiCard className="dashboard-kpi-balance">
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Net Balance
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shadow-xs">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <rect height="14" rx="3" width="20" x="2" y="5"></rect>
                      <line x1="2" x2="22" y1="10" y2="10"></line>
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-slate-400 text-lg font-light">{netParts.sign}{symbol}</span>
                  <span className="text-2xl font-bold tracking-tight text-white font-mono">
                    {netParts.intFormatted}
                  </span>
                  <span className="text-slate-400 text-sm font-medium">.{netParts.decPart}</span>
                </div>
                <div className="mt-2.5 flex items-center space-x-2">
                  <span className="text-[11px] text-slate-400">Monthly Net:</span>
                  <span className="text-[11px] font-semibold text-emerald-400 font-mono">
                    +{symbol}{formatAmt(monthlySavings)}
                  </span>
                </div>
              </div>
              <div className="mt-5 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs kpi-footer-divider">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mr-1.5 shadow-[0_0_6px_#22d3ee]"></span>
                  {balanceStatus}
                </span>
                <span className="text-slate-400 font-semibold text-[11px]">
                  {cashflowRatio}% ratio
                </span>
              </div>
            </div>
          </KpiCard>

          <KpiCard className="dashboard-kpi-savings">
            <div className="flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Savings Rate
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-xs">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      ></path>
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-3xl font-bold tracking-tight text-white font-mono">
                        {savingsRate}
                      </span>
                      <span className="text-xl font-bold text-slate-400">%</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Target Rate: {targetSavingsRate}%
                    </p>
                  </div>
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 36 36">
                      <circle
                        className="glacier-ring-track stroke-slate-800"
                        cx="18"
                        cy="18"
                        fill="none"
                        r="14"
                        strokeWidth="3.5"
                      ></circle>
                      <circle
                        className="stroke-cyan-400 gauge-progress"
                        cx="18"
                        cy="18"
                        fill="none"
                        r="14"
                        strokeDasharray={arcCircumference}
                        strokeDashoffset={arcDashOffset}
                        strokeLinecap="round"
                        strokeWidth="3.5"
                      ></circle>
                    </svg>
                    <span className="absolute text-[11px] font-bold text-white font-mono">
                      {roundedSavingsRate}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs kpi-footer-divider">
                <span className="text-slate-400 font-medium">Benchmark Tier</span>
                <span className="text-emerald-400 font-bold text-[11px]">
                  ★ {benchmarkTier}
                </span>
              </div>
            </div>
          </KpiCard>
        </section>

        {forecastData && (
          <section
            className="frost-sheen glacier-runway-banner rounded-3xl p-4 bg-gradient-to-r from-[#0F172A]/80 via-[#101D36]/70 to-[#0F172A]/80 backdrop-blur-2xl border border-white/[0.08] border-t-cyan-400/30 shadow-glacier-card flex flex-col md:flex-row items-center justify-between gap-4"
            data-purpose="runway-forecast-banner"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400/20 to-sky-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-inner shrink-0">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-white">30-Day Cash Runway Forecast</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {forecastData.runway_status === 'infinite_growth' || forecastData.runway_days == null ? 'Positive Growth' : `${forecastData.runway_days}d Runway`}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Projected Net:{' '}
                  <span className="font-semibold text-white font-mono">
                    {symbol}{formatAmt(forecastData.projected_end_balance)}
                  </span>{' '}
                  • Monthly fixed operational burn:{' '}
                  <span className="font-medium text-rose-400 font-mono">
                    {symbol}{formatAmt(forecastData.monthly_recurring_burn)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-[11px] text-slate-400 font-medium">Est. Resilience</span>
                <span className="text-xs font-bold text-cyan-300">
                  {forecastData.runway_days != null ? (forecastData.runway_days > 365 ? '18+ Months Runway' : `${forecastData.runway_days} Days Runway`) : 'Infinite Runway'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/recurring')}
                className="frost-sheen flex items-center space-x-2 px-4 py-2 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 transition-all shrink-0"
              >
                <span>Runway Forecaster</span>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </button>
            </div>
          </section>
        )}

        <section
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          data-purpose="analytics-charts"
        >
          <div className="lg:col-span-7 glacier-card-surface rounded-3xl p-6 bg-[#0F172A]/70 backdrop-blur-2xl border border-white/[0.08] border-t-cyan-400/25 shadow-glacier-card flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/[0.08] gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-bold text-white">Income vs Expenses</h3>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-white/[0.08] text-slate-300">
                      {periodTab === 'ytd' ? 'YTD Trend' : periodTab === '6m' ? '6-Month Trend' : 'Monthly Trend'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Historical cash velocity &amp; operational burn
                  </p>
                </div>
                <div className="flex items-center space-x-4 text-xs font-medium">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]"></span>
                    <span className="text-slate-300">Income</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_#f43f5e]"></span>
                    <span className="text-slate-300">Expenses</span>
                  </div>
                </div>
              </div>

              <div className="relative w-full h-72 pt-6">
                <div className="glacier-tooltip-card absolute top-8 left-1/2 transform -translate-x-1/2 p-2.5 rounded-xl bg-[#0D1527]/95 backdrop-blur-md shadow-2xl border border-cyan-400/30 pointer-events-none z-20">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {currentMonthShort} Performance
                  </p>
                  <div className="flex items-center justify-between space-x-3 text-xs mt-1">
                    <span className="text-emerald-400 font-bold font-mono">
                      +{symbol}{formatAmt(totalIncome)}
                    </span>
                    <span className="text-rose-400 font-semibold font-mono">
                      -{symbol}{formatAmt(totalExpenses)}
                    </span>
                  </div>
                </div>

                <svg className="w-full h-full overflow-visible" fill="none" viewBox="0 0 600 240">
                  <defs>
                    <linearGradient id="cyanGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.3"></stop>
                      <stop offset="100%" stopColor="#0284C7" stopOpacity="0.0"></stop>
                    </linearGradient>
                    <linearGradient id="roseGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                      <stop offset="0%" stopColor="#FB7185" stopOpacity="0.2"></stop>
                      <stop offset="100%" stopColor="#FB7185" stopOpacity="0.0"></stop>
                    </linearGradient>
                  </defs>

                  {yAxisSteps.map((step, idx) => {
                    const y = 20 + idx * 48;
                    return (
                      <g key={idx}>
                        <line
                          className="glacier-grid-line"
                          stroke="rgba(255, 255, 255, 0.07)"
                          strokeDasharray="4"
                          x1="0"
                          x2="600"
                          y1={y}
                          y2={y}
                        ></line>
                        <text
                          className="glacier-chart-axis-text"
                          fill="#64748b"
                          fontSize="10"
                          textAnchor="end"
                          x="-6"
                          y={y + 4}
                        >
                          {symbol}{formatAmt(step)}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    className="glacier-grid-line"
                    stroke="rgba(255, 255, 255, 0.12)"
                    x1="0"
                    x2="600"
                    y1="210"
                    y2="210"
                  ></line>

                  {displayMonths.length > 0 ? (
                    displayMonths.map((m, idx) => {
                      const totalM = displayMonths.length;
                      const x = totalM > 1 ? 50 + (idx * 500) / (totalM - 1) : 300;
                      const label = m.month_name || m.month || '';
                      const isCurrent = idx === totalM - 1;
                      return (
                        <text
                          key={idx}
                          fill={isCurrent ? '#38bdf8' : '#94a3b8'}
                          fontSize="11"
                          fontWeight={isCurrent ? 'bold' : 'normal'}
                          textAnchor="middle"
                          x={x}
                          y="230"
                        >
                          {label}
                        </text>
                      );
                    })
                  ) : (
                    <>
                      <text fill="#94a3b8" fontSize="11" textAnchor="middle" x="50" y="230">Jul</text>
                      <text fill="#94a3b8" fontSize="11" textAnchor="middle" x="150" y="230">Aug</text>
                      <text fill="#94a3b8" fontSize="11" textAnchor="middle" x="250" y="230">Sep</text>
                      <text fill="#94a3b8" fontSize="11" textAnchor="middle" x="350" y="230">Oct</text>
                      <text fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle" x="450" y="230">{currentMonthShort}</text>
                      <text fill="#94a3b8" fontSize="11" textAnchor="middle" x="550" y="230">Next (Proj)</text>
                    </>
                  )}

                  <path
                    d="M 50 140 C 100 130, 120 90, 150 85 C 200 80, 220 110, 250 95 C 300 70, 320 60, 350 45 C 400 20, 420 50, 450 35 C 500 15, 520 40, 550 30 L 550 210 L 50 210 Z"
                    fill="url(#cyanGradient)"
                  ></path>
                  <path
                    d="M 50 140 C 100 130, 120 90, 150 85 C 200 80, 220 110, 250 95 C 300 70, 320 60, 350 45 C 400 20, 420 50, 450 35 C 500 15, 520 40, 550 30"
                    fill="none"
                    stroke="#38BDF8"
                    strokeLinecap="round"
                    strokeWidth="3"
                  ></path>

                  <path
                    d="M 50 170 C 100 160, 120 150, 150 140 C 200 130, 220 150, 250 135 C 300 110, 320 125, 350 120 C 400 110, 420 100, 450 95 C 500 90, 520 85, 550 80 L 550 210 L 50 210 Z"
                    fill="url(#roseGradient)"
                  ></path>
                  <path
                    d="M 50 170 C 100 160, 120 150, 150 140 C 200 130, 220 150, 250 135 C 300 110, 320 125, 350 120 C 400 110, 420 100, 450 95 C 500 90, 520 85, 550 80"
                    fill="none"
                    stroke="#FB7185"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  ></path>

                  <circle cx="450" cy="35" fill="#38BDF8" r="5" stroke="#0F172A" strokeWidth="2.5"></circle>
                  <circle cx="450" cy="95" fill="#FB7185" r="5" stroke="#0F172A" strokeWidth="2.5"></circle>
                  <line
                    opacity="0.6"
                    stroke="#38BDF8"
                    strokeDasharray="3"
                    strokeWidth="1.5"
                    x1="450"
                    x2="450"
                    y1="35"
                    y2="210"
                  ></line>
                </svg>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center text-emerald-400 font-semibold">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
                {hasActivity ? 'Healthy velocity across all operational accounts' : 'Awaiting baseline transaction activity'}
              </span>
              <Link to="/reports" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                Detailed Breakdown →
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 glacier-card-surface rounded-3xl p-6 bg-[#0F172A]/70 backdrop-blur-2xl border border-white/[0.08] border-t-cyan-400/25 shadow-glacier-card flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <div>
                  <h3 className="text-sm font-bold text-white">Spending by Category</h3>
                  <p className="text-xs text-slate-400">Proportional outflow allocation</p>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs font-semibold text-slate-300 font-mono">
                  {symbol}{formatAmt(totalExpenses)} Total
                </span>
              </div>

              <div className="flex flex-col items-center justify-center pt-5 pb-3">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg className="w-44 h-44 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      className="glacier-ring-track"
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="rgba(255, 255, 255, 0.05)"
                      strokeWidth="12"
                    ></circle>
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="#06B6D4"
                      strokeDasharray="85 240"
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      strokeWidth="12"
                    ></circle>
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="#818CF8"
                      strokeDasharray="60 240"
                      strokeDashoffset="-90"
                      strokeLinecap="round"
                      strokeWidth="12"
                    ></circle>
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="#F43F5E"
                      strokeDasharray="48 240"
                      strokeDashoffset="-155"
                      strokeLinecap="round"
                      strokeWidth="12"
                    ></circle>
                    <circle
                      cx="50"
                      cy="50"
                      fill="none"
                      r="38"
                      stroke="#F59E0B"
                      strokeDasharray="32 240"
                      strokeDashoffset="-208"
                      strokeLinecap="round"
                      strokeWidth="12"
                    ></circle>
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      EXPENSED
                    </span>
                    <span className="text-xl font-extrabold text-white tracking-tight font-mono">
                      {symbol} {formatAmt(totalExpenses)}
                    </span>
                    <span className="text-[11px] font-semibold text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 px-2 py-0.5 rounded-full mt-0.5">
                      {roundedSavingsRate}% Saved
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mt-2">
                {spendingCats.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-500">
                    No categorical expenses recorded yet
                  </div>
                ) : (
                  spendingCats.slice(0, 4).map((cat, idx) => {
                    const vis = getCategoryVisual(cat.category_name, idx);
                    const amt = Number(cat.amount || 0);
                    const pct = Number(cat.percentage || 0).toFixed(0);
                    return (
                      <div
                        key={cat.category_id || idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${vis.dotClass}`}></span>
                          <span className="font-medium text-slate-300 truncate max-w-[140px] sm:max-w-none">
                            {cat.category_name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 font-semibold">
                          <span className="text-white font-mono">
                            {symbol} {formatAmt(amt)}
                          </span>
                          <span className="text-slate-400 text-[10px] font-mono">
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
              <span>Audited telemetry feed</span>
              <Link to="/categories" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                Manage Rules →
              </Link>
            </div>
          </div>
        </section>

        <section
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          data-purpose="granular-breakdown-ledger"
        >
          <div className="glacier-card-surface rounded-3xl p-6 lg:col-span-5 flex flex-col justify-between bg-[#0F172A]/70 backdrop-blur-2xl border border-white/[0.08] border-t-cyan-400/25 shadow-glacier-card">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-bold text-white">Top Spending Categories</h3>
                  <p className="text-xs text-slate-400">Weighted expense breakdown</p>
                </div>
                <Link
                  to="/reports"
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors"
                >
                  View Report →
                </Link>
              </div>

              {topCategories.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">
                  Record an expense to view category meters
                </div>
              ) : (
                <div className="space-y-5">
                  {topCategories.map((cat, idx) => {
                    const vis = getCategoryVisual(cat.category_name, idx);
                    const amt = Number(cat.amount || 0);
                    const pct = Number(cat.percentage || 0);
                    const barWidth = Number(cat.bar_width_percentage ?? pct);
                    const incomeShareLabel = cat.income_share_label || `${pct.toFixed(1)}% of spend`;

                    return (
                      <div key={cat.category_id || idx} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-md ${vis.boxBg} flex items-center justify-center font-bold text-xs`}>
                              <vis.icon size={13} />
                            </div>
                            <span className="font-semibold text-white">{cat.category_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-white">
                              {symbol}{formatAmt(amt, { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-slate-400 text-[11px] ml-1 font-mono">
                              ({pct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-obsidian-800 rounded-full overflow-hidden p-0.5 border border-white/[0.04]">
                          <div
                            className={`h-full rounded-full ${vis.barGradient} dash-progress-fill`}
                            style={{ '--dash-progress-width': `${barWidth}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Of {symbol}{formatAmt(totalExpenses)} total</span>
                          <span className="text-emerald-400">{incomeShareLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-white/[0.04] border border-cyan-400/20 relative overflow-hidden backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 mt-0.5 border border-cyan-500/30">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    ></path>
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Treasury Intelligence
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {!hasActivity ? (
                      <>
                        <span>No financial activity recorded yet (</span>
                        <strong className="text-emerald-400">0%</strong>
                        <span>). Record your income and expenses to unlock analytics and runway forecasting.</span>
                      </>
                    ) : (
                      <>
                        Savings velocity at <strong className="text-emerald-400 font-mono">{savingsRate}%</strong>. You have retained cash of{' '}
                        <strong className="text-white font-mono">{symbol}{formatAmt(retainedIncome)}</strong> ready for liquid mutual funds or short-term yield deployment.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="glacier-card-surface rounded-3xl p-6 lg:col-span-7 flex flex-col justify-between bg-[#0F172A]/70 backdrop-blur-2xl border border-white/[0.08] border-t-cyan-400/25 shadow-glacier-card">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Recent Transactions</h3>
                  <p className="text-xs text-slate-400">Audited ledger entries for current period</p>
                </div>
                <Link
                  to="/transactions"
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors"
                >
                  View All →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-white/[0.06] text-[11px] uppercase tracking-wider">
                      <th className="pb-3 pl-1" scope="col">Type</th>
                      <th className="pb-3 px-3" scope="col">Description</th>
                      <th className="pb-3 px-3" scope="col">Category</th>
                      <th className="pb-3 px-3" scope="col">Date</th>
                      <th className="pb-3 pr-1 text-right" scope="col">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {displayedRecentTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          <div>No ledger entries recorded yet.</div>
                        </td>
                      </tr>
                    ) : (
                      displayedRecentTransactions.map((tx) => {
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
                          <tr key={tx.id} className="hover:bg-white/[0.03] transition-colors group">
                            <td className="py-3 pl-1">
                              {isIncome ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M7 11l5-5m0 0l5 5m-5-5v12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                  </svg>
                                  Income
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path d="M17 13l-5 5m0 0l-5-5m5 5V6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                                  </svg>
                                  Expense
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-xl ${vis.iconBox} flex items-center justify-center font-bold text-xs shrink-0`}>
                                  <vis.icon size={13} />
                                </div>
                                <span className={`font-semibold text-white ${vis.hoverText} transition-colors truncate max-w-[140px] sm:max-w-[200px]`}>
                                  {tx.description || tx.category_name || 'Transaction'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded-lg bg-white/[0.05] text-slate-300 border border-white/[0.08] font-medium text-[11px]">
                                {tx.category_name || 'Category'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                              {formattedDate}
                            </td>
                            <td className={`py-3 pr-1 text-right font-mono font-bold text-xs sm:text-sm ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isIncome ? '+' : '-'}{symbol}
                              {formatAmt(tx.amount, { minimumFractionDigits: 2 })}
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
                Showing {displayedRecentTransactions.length} records for {currentMonthLong}
              </span>
              <span className="font-mono text-xs text-cyan-400 font-semibold">
                Net Cleared: {netBalance >= 0 ? '+' : '-'}{symbol}
                {formatAmt(Math.abs(netBalance), { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </section>
      </div>

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
          await fetchDashboardData();
        }}
      />
    </div>
  );
};

export default DashboardPage;

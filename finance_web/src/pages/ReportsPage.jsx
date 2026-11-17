import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Percent } from 'lucide-react';
import api from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import KpiCard from '../components/KpiCard';
import ParticleChart from '../components/ParticleChart';
import SpendingChart from '../components/SpendingChart';
import CustomSelect from '../components/CustomSelect';
import './ReportsPage.css';

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

export const ReportsPage = () => {
  const { symbol, activeCurrency } = useCurrency();
  const { theme } = useTheme();
  const formatAmt = (val, opts = {}) => Number(val || 0).toLocaleString(activeCurrency.locale, opts);
  const [monthsCount, setMonthsCount] = useState(6);
  const [monthlyData, setMonthlyData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [reportType, setReportType] = useState('expense');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [, setLoading] = useState(true);
  const [error, setError] = useState('');

  const incParts = splitCurrency(monthlyData?.summary_income, activeCurrency.locale);
  const expParts = splitCurrency(monthlyData?.summary_expenses, activeCurrency.locale);
  const netParts = splitCurrency(monthlyData?.summary_net, activeCurrency.locale);
  const savingsRate = Number(monthlyData?.average_savings_rate || 0);
  const monthlyAvgIncome = Math.round(Number(monthlyData?.summary_income || 0) / (monthsCount || 1));
  const monthlyAvgExpense = Math.round(Number(monthlyData?.summary_expenses || 0) / (monthsCount || 1));
  const isNetPositive = Number(monthlyData?.summary_net || 0) >= 0;
  const savingsTier = savingsRate >= 30 ? 'High Surplus' : savingsRate >= 15 ? 'Solid Buffer' : savingsRate >= 0 ? 'Moderate Buffer' : 'Critical Deficit';

  const particleSeries = useMemo(() => {
    const months = monthlyData?.months || [];
    if (!months.length) return [];
    return [
      {
        name: 'Expenses',
        color: '#f43f5e',
        data: months.map((m) => ({
          label: m.month_name || m.month,
          value: Math.round(Number(m.expenses || 0)),
        })),
      },
      {
        name: 'Income',
        color: '#10b981',
        data: months.map((m) => ({
          label: m.month_name || m.month,
          value: Math.round(Number(m.income || 0)),
        })),
      },
      {
        name: 'Net Savings',
        color: '#10b981',
        data: months.map((m) => ({
          label: m.month_name || m.month,
          value: Math.max(0, Math.round(Number(m.net_savings || 0))),
        })),
      },
    ];
  }, [monthlyData?.months]);

  const fetchReports = async () => {
    setLoading(true);
    setError('');
    let s = startDate;
    let e = endDate;
    if (s && e && s > e) {
      const temp = s;
      s = e;
      e = temp;
    }
    try {
      const [monthly, cats] = await Promise.all([
        api.getMonthlyReport(monthsCount),
        api.getCategoryReport(
          s ? `${s}T00:00:00Z` : undefined,
          e ? `${e}T23:59:59Z` : undefined,
          reportType
        ),
      ]);
      setMonthlyData(monthly);
      setCategoryData(cats);
    } catch (err) {
      setError(err.message || 'Failed to generate financial reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [monthsCount, reportType, startDate, endDate]);

  return (
    <div className="content-body">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Financial Intelligence Reports</h2>
          <p className="page-subtitle">
            Deterministic multi-month trend analysis and categorical distribution
          </p>
        </div>
        <div className="page-actions">
          <div className="reports-period-select">
            <CustomSelect
              value={monthsCount}
              onChange={(val) => setMonthsCount(Number(val))}
              options={[
                { value: 3, label: 'Last 3 Months' },
                { value: 6, label: 'Last 6 Months' },
                { value: 12, label: 'Last 12 Months' },
              ]}
            />
          </div>
          <button onClick={fetchReports} className="btn btn-secondary">
            <RefreshCw size={16} />
            <span>Regenerate</span>
          </button>
        </div>
      </div>

      {error && <div className="alert-banner error">{error}</div>}

      <div className="grid-cols-4 reports-kpi-grid">
        <KpiCard className="dashboard-kpi-income">
          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Period Total Income
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-xs">
                  <TrendingUp className="w-4 h-4" />
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
                  Total Credited Inflow
                </span>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs kpi-footer-divider">
              <span className="text-slate-400 font-medium">Monthly Avg</span>
              <span className="text-emerald-400 font-semibold font-mono text-[11px]">
                {symbol}{formatAmt(monthlyAvgIncome)}/mo
              </span>
            </div>
          </div>
        </KpiCard>

        <KpiCard className="dashboard-kpi-expense">
          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Period Total Expenses
                </span>
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-xs">
                  <TrendingDown className="w-4 h-4" />
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
                  Total Debited Outflow
                </span>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs kpi-footer-divider">
              <span className="text-slate-400 font-medium">Monthly Avg</span>
              <span className="text-rose-400 font-semibold font-mono text-[11px]">
                {symbol}{formatAmt(monthlyAvgExpense)}/mo
              </span>
            </div>
          </div>
        </KpiCard>

        <KpiCard className={isNetPositive ? 'dashboard-kpi-balance' : 'dashboard-kpi-expense'}>
          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Period Net Savings
                </span>
                <div className={`w-8 h-8 rounded-xl ${isNetPositive ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' : 'bg-rose-500/15 border-rose-500/30 text-rose-400'} border flex items-center justify-center shadow-xs`}>
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-slate-400 text-lg font-light">{netParts.sign}{symbol}</span>
                <span className="text-2xl font-bold tracking-tight text-white font-mono">
                  {netParts.intFormatted}
                </span>
                <span className="text-slate-400 text-sm font-medium">.{netParts.decPart}</span>
              </div>
              <div className="mt-2.5 flex items-center space-x-2 flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${isNetPositive ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30'} border`}>
                  {isNetPositive ? 'Net Surplus' : 'Net Deficit'}
                </span>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs kpi-footer-divider">
              <span className="text-slate-400 font-medium">Fiscal Position</span>
              <span className={`font-semibold text-[11px] ${isNetPositive ? 'text-cyan-400' : 'text-rose-400'}`}>
                {isNetPositive ? 'Accumulating Wealth' : 'Deficit Drain'}
              </span>
            </div>
          </div>
        </KpiCard>

        <KpiCard className="dashboard-kpi-savings">
          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Average Savings Rate
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-xs">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-bold tracking-tight text-white font-mono">
                      {savingsRate}
                    </span>
                    <span className="text-purple-400 text-sm font-semibold">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Rolling {monthsCount}-Month Average</p>
                </div>
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      className="glacier-ring-track text-slate-800"
                      strokeWidth="3.5"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      className="text-purple-500"
                      strokeWidth="3.5"
                      strokeDasharray={113}
                      strokeDashoffset={113 - (113 * Math.min(Math.max(savingsRate, 0), 100)) / 100}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-bold font-mono text-white">
                    {savingsRate}%
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs kpi-footer-divider">
              <span className="text-slate-400 font-medium">Efficiency Tier</span>
              <span className="text-purple-400 font-semibold text-[11px]">
                {savingsTier}
              </span>
            </div>
          </div>
        </KpiCard>
      </div>

      <div className="glacier-card-surface rounded-3xl p-6 bg-[#0F172A]/70 backdrop-blur-2xl border border-white/[0.08] border-t-cyan-400/25 shadow-glacier-card reports-section-card">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
          <h3 className="text-base font-bold text-white">Monthly Trend Breakdown</h3>
        </div>
        <div className="reports-chart-wrap">
          {particleSeries.length > 0 ? (
            <ParticleChart
              series={particleSeries}
              prefix={symbol}
              suffix=""
              summary={true}
              summaryLabel="Period Cumulative Volume"
              height={260}
              barWidth={64}
              grain={2.2}
              spacing={2.8}
              shape="circle"
              pour="stream"
              arc={0.5}
              interactive={true}
              surface={false}
              baseline={true}
              autoplay={false}
              accentColor={(idx, s) => (s?.name === 'Expenses' ? '#f43f5e' : '#10b981')}
              theme={theme === 'light' ? 'light' : 'dark'}
            />
          ) : (
            <div className="chart-empty-state">No trend data available</div>
          )}
        </div>

        <div className="table-container rounded-2xl border border-white/[0.06] overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="col-right">Income</th>
                <th className="col-right">Expenses</th>
                <th className="col-right">Net Savings</th>
                <th className="col-right">Savings Rate</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData?.months?.map((m) => (
                <tr key={m.month}>
                  <td className="cell-primary font-medium">{m.month_name}</td>
                  <td className="col-right val-income font-mono">
                    {symbol}{formatAmt(m.income, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="col-right val-expense font-mono">
                    {symbol}{formatAmt(m.expenses, { minimumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`col-right font-mono ${
                      Number(m.net_savings) >= 0 ? 'reports-net-pos' : 'val-expense'
                    }`}
                  >
                    {Number(m.net_savings) < 0 ? '-' : ''}{symbol}
                    {formatAmt(Math.abs(m.net_savings), { minimumFractionDigits: 2 })}
                  </td>
                  <td className="col-right reports-rate font-mono">{m.savings_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glacier-card-surface rounded-3xl p-6 bg-[#0F172A]/70 backdrop-blur-2xl border border-white/[0.08] border-t-cyan-400/25 shadow-glacier-card reports-section-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.08] mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-white">Categorical Analytics Breakdown</h3>
              <span className="px-2.5 py-0.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-xs font-semibold text-slate-300 font-mono">
                {symbol}{formatAmt(categoryData?.total_amount, { minimumFractionDigits: 2 })} Total
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Proportional inflow &amp; outflow distribution allocation
            </p>
          </div>

          <div className="reports-filter-controls">
            <div className="reports-type-toggle">
              <button
                type="button"
                onClick={() => setReportType('expense')}
                className={`btn btn-sm ${reportType === 'expense' ? 'btn-primary' : ''}`}
              >
                Expenses
              </button>
              <button
                type="button"
                onClick={() => setReportType('income')}
                className={`btn btn-sm ${reportType === 'income' ? 'btn-primary' : ''}`}
              >
                Income
              </button>
            </div>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
              placeholder="End Date"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="btn btn-secondary btn-sm"
                title="Clear date filter"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center reports-cat-grid">
          <div className="lg:col-span-5">
            <SpendingChart
              categories={categoryData?.categories || []}
              type={reportType}
              totalAmount={categoryData?.total_amount}
              savingsRate={monthlyData?.average_savings_rate}
            />
          </div>

          <div className="lg:col-span-7">
            <div className="table-container rounded-2xl border border-white/[0.06] overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="col-center">Transactions</th>
                    <th className="col-right">Amount</th>
                    <th className="col-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData?.categories?.map((cat) => (
                    <tr key={cat.category_id}>
                      <td className="cell-primary font-medium">{cat.category_name}</td>
                      <td className="col-center font-mono">{cat.transaction_count}</td>
                      <td
                        className={`col-right font-mono ${
                          cat.type === 'income' ? 'val-income' : 'val-expense'
                        }`}
                      >
                        {symbol}{formatAmt(cat.amount, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="col-right font-mono font-semibold">{cat.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Percent } from 'lucide-react';
import api from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import SummaryCard from '../components/SummaryCard';
import IncomeExpenseChart from '../components/IncomeExpenseChart';
import SpendingChart from '../components/SpendingChart';
import CustomSelect from '../components/CustomSelect';
import './ReportsPage.css';

export const ReportsPage = () => {
  const { symbol, activeCurrency } = useCurrency();
  const formatAmt = (val, opts = {}) => Number(val || 0).toLocaleString(activeCurrency.locale, opts);
  const [monthsCount, setMonthsCount] = useState(6);
  const [monthlyData, setMonthlyData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [reportType, setReportType] = useState('expense');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        <SummaryCard
          title="Period Total Income"
          amount={monthlyData?.summary_income ? Number(monthlyData.summary_income) : 0}
          icon={TrendingUp}
          color="green"
        />
        <SummaryCard
          title="Period Total Expenses"
          amount={monthlyData?.summary_expenses ? Number(monthlyData.summary_expenses) : 0}
          icon={TrendingDown}
          color="red"
        />
        <SummaryCard
          title="Period Net Savings"
          amount={monthlyData?.summary_net ? Number(monthlyData.summary_net) : 0}
          icon={Wallet}
          color={Number(monthlyData?.summary_net || 0) >= 0 ? 'blue' : 'red'}
        />
        <SummaryCard
          title="Average Savings Rate"
          amount={`${monthlyData?.average_savings_rate || 0}%`}
          icon={Percent}
          color="purple"
          prefix=""
        />
      </div>

      <div className="card reports-section-card">
        <div className="card-header">
          <h3 className="card-title">Monthly Trend Breakdown</h3>
        </div>
        <div className="reports-chart-wrap">
          <IncomeExpenseChart data={monthlyData?.months || []} />
        </div>

        <div className="table-container">
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
                  <td className="cell-primary">{m.month_name}</td>
                  <td className="col-right val-income">
                    {symbol}{formatAmt(m.income, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="col-right val-expense">
                    {symbol}{formatAmt(m.expenses, { minimumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`col-right ${
                      Number(m.net_savings) >= 0 ? 'reports-net-pos' : 'val-expense'
                    }`}
                  >
                    {Number(m.net_savings) < 0 ? '-' : ''}{symbol}
                    {formatAmt(Math.abs(m.net_savings), { minimumFractionDigits: 2 })}
                  </td>
                  <td className="col-right reports-rate">{m.savings_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header wrap">
          <div>
            <h3 className="card-title">Categorical Analytics Breakdown</h3>
            <p className="card-subtitle">
              Total Volume: {symbol}
              {formatAmt(categoryData?.total_amount, {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>

          <div className="reports-filter-controls">
            <div className="reports-type-toggle">
              <button
                onClick={() => setReportType('expense')}
                className={`btn btn-sm ${reportType === 'expense' ? 'btn-primary' : ''}`}
              >
                Expenses
              </button>
              <button
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

        <div className="grid-cols-2 reports-cat-grid">
          <div>
            <SpendingChart categories={categoryData?.categories || []} />
          </div>

          <div className="table-container">
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
                    <td className="cell-primary">{cat.category_name}</td>
                    <td className="col-center">{cat.transaction_count}</td>
                    <td
                      className={`col-right ${
                        cat.type === 'income' ? 'val-income' : 'val-expense'
                      }`}
                    >
                      {symbol}{formatAmt(cat.amount, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="col-right">{cat.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

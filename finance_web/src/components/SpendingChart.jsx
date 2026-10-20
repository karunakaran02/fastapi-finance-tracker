import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useCurrency } from '../context/CurrencyContext';
import './Charts.css';

ChartJS.register(ArcElement, Tooltip, Legend);

const PALETTE = [
  '#3b82f6',
  '#10b981',
  '#8b5cf6',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#f43f5e',
  '#14b8a6',
  '#6366f1',
];

export const SpendingChart = ({ categories = [], savingsRate = 0, showLegendPills = true }) => {
  const { symbol, activeCurrency } = useCurrency();
  if (!categories || categories.length === 0) {
    return <div className="doughnut-empty-state">No category spending recorded yet</div>;
  }

  const labels = categories.map((c) => c.category_name);
  const dataValues = categories.map((c) => Number(c.amount));
  const totalAmount = dataValues.reduce((a, b) => a + b, 0);

  const chartData = {
    labels,
    datasets: [
      {
        data: dataValues,
        backgroundColor: PALETTE.slice(0, categories.length),
        borderColor: '#0d1321',
        borderWidth: 3,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: !showLegendPills,
        position: 'right',
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 11 },
          usePointStyle: true,
          boxWidth: 8,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: '#0b111e',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        bodyFont: { family: 'JetBrains Mono', size: 12 },
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context) => {
            const val = Number(context.raw);
            const pct = totalAmount > 0 ? ((val / totalAmount) * 100).toFixed(2) : 0;
            return ` ${symbol}${val.toLocaleString(activeCurrency.locale, { minimumFractionDigits: 2 })} (${pct}%)`;
          },
        },
      },
    },
    cutout: '74%',
  };

  return (
    <div>
      <div className="doughnut-ring-wrapper">
        <Doughnut data={chartData} options={options} />
        <div className="doughnut-center-overlay">
          <span className="doughnut-center-label">EXPENSED</span>
          <span className="doughnut-center-value">
            {symbol}{totalAmount.toLocaleString(activeCurrency.locale, { maximumFractionDigits: 0 })}
          </span>
          {savingsRate !== undefined && (
            <span className="font-mono doughnut-center-saved">
              {Math.round(Number(savingsRate) || 0)}% Saved
            </span>
          )}
        </div>
      </div>

      {showLegendPills && (
        <div className="doughnut-legend-list">
          {categories.slice(0, 4).map((cat, idx) => {
            const color = PALETTE[idx % PALETTE.length];
            const amt = Number(cat.amount || 0);
            const pct =
              cat.percentage !== undefined
                ? Number(cat.percentage).toFixed(2)
                : totalAmount > 0
                ? ((amt / totalAmount) * 100).toFixed(2)
                : '0.00';

            return (
              <div key={cat.category_id || idx} className="doughnut-legend-item">
                <div className="doughnut-legend-left">
                  <span className={`doughnut-legend-dot color-${idx % 9}`} />
                  <span className="doughnut-legend-name">{cat.category_name}</span>
                </div>

                <div className="doughnut-legend-right">
                  <span className="font-mono doughnut-legend-amt">
                    {symbol}{amt.toLocaleString(activeCurrency.locale, { minimumFractionDigits: 2 })}
                  </span>
                  <span
                    className={`font-mono doughnut-legend-pct ${
                      idx === 0 ? 'primary' : 'secondary'
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SpendingChart;

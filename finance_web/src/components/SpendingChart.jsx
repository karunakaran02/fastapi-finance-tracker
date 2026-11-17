import React, { useState } from 'react';
import { useCurrency } from '../context/CurrencyContext';

const CIRCUMFERENCE = 238.761;

const PALETTE = [
  { stroke: '#06B6D4', dotClass: 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' },
  { stroke: '#818CF8', dotClass: 'bg-indigo-400 shadow-[0_0_8px_#818cf8]' },
  { stroke: '#F43F5E', dotClass: 'bg-rose-400 shadow-[0_0_8px_#f43f5e]' },
  { stroke: '#F59E0B', dotClass: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' },
  { stroke: '#10B981', dotClass: 'bg-emerald-400 shadow-[0_0_8px_#10b981]' },
  { stroke: '#A855F7', dotClass: 'bg-purple-400 shadow-[0_0_8px_#a855f7]' },
  { stroke: '#EC4899', dotClass: 'bg-pink-400 shadow-[0_0_8px_#ec4899]' },
  { stroke: '#3B82F6', dotClass: 'bg-blue-400 shadow-[0_0_8px_#3b82f6]' },
  { stroke: '#14B8A6', dotClass: 'bg-teal-400 shadow-[0_0_8px_#14b8a6]' },
  { stroke: '#FB923C', dotClass: 'bg-orange-400 shadow-[0_0_8px_#fb923c]' },
];

export const SpendingChart = ({
  categories = [],
  savingsRate,
  showLegendPills = true,
  type = 'expense',
  totalAmount: propTotalAmount,
}) => {
  const { symbol, activeCurrency } = useCurrency();
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const formatAmt = (val, opts = {}) => Number(val || 0).toLocaleString(activeCurrency.locale, opts);

  if (!categories || categories.length === 0) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 font-medium">
        No categorical {type === 'income' ? 'income' : 'expenses'} recorded for this period
      </div>
    );
  }

  const computedTotal = categories.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const totalAmount = propTotalAmount != null && Number(propTotalAmount) > 0 ? Number(propTotalAmount) : computedTotal;

  let accumulatedOffset = 0;
  const segments = categories.map((cat, idx) => {
    const amt = Number(cat.amount || 0);
    const pct = totalAmount > 0 ? (amt / totalAmount) * 100 : 0;
    const rawDash = (pct / 100) * CIRCUMFERENCE;
    const gapWidth = categories.length > 1 ? 4 : 0;
    const dash = Math.max(rawDash - gapWidth, 1);
    const offset = -accumulatedOffset;
    accumulatedOffset += rawDash;
    const color = PALETTE[idx % PALETTE.length];
    return {
      cat,
      amt,
      pct,
      dash,
      offset,
      color,
    };
  });

  const activeSegment = hoveredIndex != null ? segments[hoveredIndex] : null;

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="flex flex-col items-center justify-center pt-3 pb-3">
        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              className="glacier-ring-track"
              cx="50"
              cy="50"
              fill="none"
              r="38"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="12"
            />
            {segments.map((seg, idx) => {
              const isHovered = hoveredIndex === idx;
              return (
                <circle
                  key={seg.cat.category_id || idx}
                  cx="50"
                  cy="50"
                  fill="none"
                  r="38"
                  stroke={seg.color.stroke}
                  strokeDasharray={`${seg.dash.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
                  strokeDashoffset={seg.offset.toFixed(2)}
                  strokeLinecap="round"
                  strokeWidth={isHovered ? 14 : 12}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase truncate max-w-[120px]">
              {activeSegment ? activeSegment.cat.category_name : type === 'income' ? 'CREDITED' : 'EXPENSED'}
            </span>
            <span className="text-xl font-extrabold text-white tracking-tight font-mono">
              {symbol} {formatAmt(activeSegment ? activeSegment.amt : totalAmount)}
            </span>
            <span className="text-[11px] font-semibold text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 px-2 py-0.5 rounded-full mt-0.5">
              {activeSegment
                ? `${activeSegment.pct.toFixed(1)}% of total`
                : savingsRate != null
                ? `${Math.round(Number(savingsRate))}% Saved`
                : `${categories.length} Categories`}
            </span>
          </div>
        </div>
      </div>

      {showLegendPills && (
        <div className="w-full space-y-2 mt-3 max-h-56 overflow-y-auto pr-1">
          {categories.slice(0, 5).map((cat, idx) => {
            const vis = PALETTE[idx % PALETTE.length];
            const amt = Number(cat.amount || 0);
            const pct =
              cat.percentage !== undefined
                ? Number(cat.percentage).toFixed(1)
                : totalAmount > 0
                ? ((amt / totalAmount) * 100).toFixed(1)
                : '0.0';
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={cat.category_id || idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`flex items-center justify-between p-2 rounded-xl bg-white/[0.04] border ${
                  isHovered ? 'border-cyan-400/50 bg-white/[0.08]' : 'border-white/[0.07]'
                } text-xs transition-all cursor-pointer`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${vis.dotClass}`}></span>
                  <span className="font-medium text-slate-300 truncate max-w-[140px] sm:max-w-none">
                    {cat.category_name}
                  </span>
                </div>
                <div className="flex items-center space-x-2 font-semibold flex-shrink-0">
                  <span className="text-white font-mono">
                    {symbol} {formatAmt(amt)}
                  </span>
                  <span className="text-slate-400 text-[10px] font-mono">
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

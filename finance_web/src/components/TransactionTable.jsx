import React from 'react';
import {
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Briefcase,
  ShoppingBag,
  Car,
  Utensils,
  Receipt,
  CreditCard,
  Plus,
} from 'lucide-react';
import { useCurrency } from '../context/CurrencyContext';
import { getAppropriateBookIcon } from '../utils/bookIcons';
import './TransactionTable.css';

const getLedgerMeta = (tx) => {
  const isIncome = tx.type === 'income';
  const cat = (tx.category_name || '').toLowerCase();
  if (isIncome) {
    return {
      icon: Briefcase,
      tone: 'amber',
    };
  }
  if (cat.includes('shop')) {
    return {
      icon: ShoppingBag,
      tone: 'blue',
    };
  }
  if (cat.includes('transport') || cat.includes('travel')) {
    return {
      icon: Car,
      tone: 'emerald',
    };
  }
  if (cat.includes('food') || cat.includes('dining')) {
    return {
      icon: Utensils,
      tone: 'yellow',
    };
  }
  if (cat.includes('bill') || cat.includes('util')) {
    return {
      icon: Receipt,
      tone: 'purple',
    };
  }
  return {
    icon: CreditCard,
    tone: 'slate',
  };
};

export const TransactionTable = ({
  transactions = [],
  onEdit,
  onDelete,
  showActions = true,
  hasActiveFilters = false,
  onResetFilters,
  onAddTransaction,
}) => {
  const { symbol, activeCurrency } = useCurrency();

  if (!transactions || transactions.length === 0) {
    return (
      <div className="tx-empty-state-card">
        <div className="tx-empty-state-icon-box">
          <Receipt size={28} />
        </div>
        <h3 className="tx-empty-state-title">
          {hasActiveFilters ? 'No matching transactions found' : 'No transactions recorded yet'}
        </h3>
        <p className="tx-empty-state-desc">
          {hasActiveFilters
            ? 'No records match your selected filters. Try adjusting your search query, category, or date range.'
            : 'Start building your financial ledger by recording your income credits or daily expense purchases.'}
        </p>
        <div className="tx-empty-state-actions">
          {hasActiveFilters && onResetFilters && (
            <button type="button" onClick={onResetFilters} className="btn btn-secondary">
              Reset Filters
            </button>
          )}
          {onAddTransaction && (
            <button type="button" onClick={onAddTransaction} className="btn btn-add-transaction">
              <Plus size={15} />
              <span>Add Transaction</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(activeCurrency.locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>TYPE</th>
            <th>DESCRIPTION</th>
            <th>BOOK</th>
            <th>CATEGORY</th>
            <th>DATE</th>
            <th className="col-right">AMOUNT</th>
            {showActions && <th className="col-center">ACTIONS</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const isIncome = tx.type === 'income';
            const meta = getLedgerMeta(tx);
            const IconComp = meta.icon;

            return (
              <tr key={tx.id}>
                <td>
                  <span className={`badge ${isIncome ? 'badge-income' : 'badge-expense'}`}>
                    {isIncome ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                    {isIncome ? 'Income' : 'Expense'}
                  </span>
                </td>
                <td>
                  <div className="tx-desc-cell">
                    <div className={`tx-icon-box ${meta.tone}`}>
                      <IconComp size={15} />
                    </div>
                    <div className="tx-title">{tx.description || tx.category_name || 'Transaction'}</div>
                  </div>
                </td>
                <td>
                  <span className="tx-book-pill">
                    <span className="material-symbols-outlined text-[13px] text-secondary">
                      {getAppropriateBookIcon(tx.book_title, tx.book_icon)}
                    </span>
                    <span>{tx.book_title || 'General'}</span>
                  </span>
                </td>
                <td>
                  <span className="tx-category-pill">{tx.category_name || 'General'}</span>
                </td>
                <td className="font-mono tx-date-cell">{formatDate(tx.transaction_date)}</td>
                <td
                  className={`font-mono col-right ${
                    isIncome ? 'val-income' : 'val-expense'
                  }`}
                >
                  {isIncome ? '+' : '-'}{symbol}
                  {Number(tx.amount).toLocaleString(activeCurrency.locale, { minimumFractionDigits: 2 })}
                </td>
                {showActions && (
                  <td className="col-center">
                    <div className="tx-actions-group">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(tx)}
                          title="Edit transaction"
                          className="icon-btn edit"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(tx.id)}
                          title="Delete transaction"
                          className="icon-btn delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;

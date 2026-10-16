import React, { useState, useEffect } from 'react';
import CustomSelect from './CustomSelect';
import { useCurrency } from '../context/CurrencyContext';

export const TransactionForm = ({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  categories = [],
}) => {
  const { symbol } = useCurrency();
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || 'expense');
      setCategoryId(initialData.category_id ? String(initialData.category_id) : '');
      setAmount(initialData.amount ? String(initialData.amount) : '');
      setDescription(initialData.description || '');
      setTransactionDate(
        initialData.transaction_date
          ? new Date(initialData.transaction_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
    } else {
      setType('expense');
      setCategoryId('');
      setAmount('');
      setDescription('');
      setTransactionDate(new Date().toISOString().split('T')[0]);
    }
    setError('');
  }, [initialData, isOpen]);

  const availableCategories = categories.filter((c) => c.type === type);

  useEffect(() => {
    if (
      availableCategories.length > 0 &&
      (!categoryId || !availableCategories.some((c) => String(c.id) === categoryId))
    ) {
      setCategoryId(String(availableCategories[0].id));
    }
  }, [type, categories]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        type,
        category_id: Number(categoryId),
        amount: Number(amount).toFixed(2),
        description: description.trim(),
        transaction_date: new Date(transactionDate).toISOString(),
      };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save transaction.');
    } finally {
      setLoading(false);
    }
  };

  const categoryOptions = availableCategories.map((c) => ({
    value: String(c.id),
    label: `${c.name} ${c.is_system ? '(Default)' : '(Custom)'}`,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-obsidian-950/80 backdrop-blur-sm"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="glass-card rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-white/10 shadow-2xl text-slate-100 max-w-lg w-full max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <h3 className="text-base font-bold text-white">
            {initialData ? 'Edit Transaction' : 'Add New Transaction'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('income')}
                className={`py-2.5 rounded-xl font-bold transition-all ${
                  type === 'income'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-obsidian-800 text-slate-400 border border-white/[0.06]'
                }`}
              >
                Income (+)
              </button>
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`py-2.5 rounded-xl font-bold transition-all ${
                  type === 'expense'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-obsidian-800 text-slate-400 border border-white/[0.06]'
                }`}
              >
                Expense (-)
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">
              Amount ({symbol})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="form-input w-full bg-obsidian-800 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-sm focus:outline-none focus:border-brand-cobalt"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">
              Category
            </label>
            <CustomSelect
              value={categoryId}
              onChange={(val) => setCategoryId(String(val))}
              options={categoryOptions}
              placeholder="Select Category"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">
              Transaction Date
            </label>
            <input
              type="date"
              required
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="form-input w-full bg-obsidian-800 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white font-mono text-base sm:text-xs focus:outline-none focus:border-brand-cobalt"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Monthly Payroll Credit, Retail Purchase"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="form-input w-full bg-obsidian-800 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs focus:outline-none focus:border-brand-cobalt"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 font-semibold border border-white/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-brand-cobalt hover:bg-blue-500 text-white font-bold shadow-glow-blue transition-all"
            >
              {loading ? 'Saving...' : initialData ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;

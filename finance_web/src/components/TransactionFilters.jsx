import React, { useState, useEffect } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import CustomSelect from './CustomSelect';
import { getAppropriateBookIcon } from '../utils/bookIcons';
import './TransactionFilters.css';

export const TransactionFilters = ({
  filters,
  onChange,
  onReset,
  categories = [],
  books = [],
}) => {
  const [localSearch, setLocalSearch] = useState(filters.search || '');

  useEffect(() => {
    setLocalSearch(filters.search || '');
  }, [filters.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters.search || '')) {
        handleChange('search', localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const handleChange = (field, value) => {
    const nextFilters = { ...filters, [field]: value, page: 1 };
    if (field === 'type' && value && nextFilters.category_id) {
      const selectedCat = categories.find((c) => String(c.id) === String(nextFilters.category_id));
      if (selectedCat && selectedCat.type !== value) {
        nextFilters.category_id = '';
      }
    }
    onChange(nextFilters);
  };

  const handleReset = () => {
    setLocalSearch('');
    onReset();
  };

  const typeOptions = [
    { value: '', label: 'All Types' },
    { value: 'income', label: 'Income' },
    { value: 'expense', label: 'Expense' },
  ];

  const bookOptions = [
    { value: '', label: 'All Stream Books' },
    ...books.map((b) => ({
      value: String(b.id),
      label: b.title,
      icon: getAppropriateBookIcon(b.title, b.icon),
    })),
  ];

  const filteredCategories = categories.filter((c) => {
    if (!filters.type) return true;
    return c.type === filters.type;
  });

  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...filteredCategories.map((c) => ({
      value: String(c.id),
      label: filters.type ? c.name : `${c.name} (${c.type === 'income' ? 'Income' : 'Expense'})`,
    })),
  ];

  const sortOptions = [
    { value: 'date_desc', label: 'Newest First' },
    { value: 'date_asc', label: 'Oldest First' },
    { value: 'amount_desc', label: 'Highest Amount' },
    { value: 'amount_asc', label: 'Lowest Amount' },
  ];

  const getPresetDates = (preset) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start_date: toYMD(start), end_date: toYMD(end) };
    }
    if (preset === 'last_30_days') {
      const start = new Date();
      start.setDate(now.getDate() - 30);
      return { start_date: toYMD(start), end_date: toYMD(now) };
    }
    if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start_date: toYMD(start), end_date: toYMD(end) };
    }
    if (preset === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { start_date: toYMD(start), end_date: toYMD(end) };
    }
    return { start_date: '', end_date: '' };
  };

  const presetList = [
    { id: 'all', label: 'All Time' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_30_days', label: 'Last 30 Days' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_year', label: 'This Year' },
  ];

  const getCurrentPresetId = () => {
    if (!filters.start_date && !filters.end_date) return 'all';
    for (const p of presetList) {
      if (p.id === 'all') continue;
      const dates = getPresetDates(p.id);
      if (dates.start_date === filters.start_date && dates.end_date === filters.end_date) {
        return p.id;
      }
    }
    return null;
  };

  const activePreset = getCurrentPresetId();

  const handlePresetClick = (presetId) => {
    const dates = getPresetDates(presetId);
    onChange({
      ...filters,
      start_date: dates.start_date,
      end_date: dates.end_date,
      page: 1,
    });
  };

  return (
    <div className="card tx-filters-card">
      <div className="tx-presets-row">
        <span className="tx-presets-label">
          Date Range:
        </span>
        {presetList.map((preset) => {
          const isActive = activePreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetClick(preset.id)}
              className={`preset-pill-btn ${isActive ? 'active' : ''}`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="tx-filters-grid">
        <div className="tx-filter-col tx-filters-search-col">
          <label className="form-label">Search</label>
          <div className="input-icon-wrap">
            <Search size={15} className="input-icon" />
            <input
              type="text"
              placeholder="Search description, category, amount..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        <div className="tx-filter-col">
          <label className="form-label">Type</label>
          <CustomSelect
            value={filters.type || ''}
            onChange={(val) => handleChange('type', val)}
            options={typeOptions}
            placeholder="All Types"
          />
        </div>

        <div className="tx-filter-col">
          <label className="form-label">Stream Book</label>
          <CustomSelect
            value={filters.book_id ? String(filters.book_id) : ''}
            onChange={(val) => handleChange('book_id', val)}
            options={bookOptions}
            placeholder="All Stream Books"
          />
        </div>

        <div className="tx-filter-col">
          <label className="form-label">Category</label>
          <CustomSelect
            value={filters.category_id ? String(filters.category_id) : ''}
            onChange={(val) => handleChange('category_id', val)}
            options={categoryOptions}
            placeholder="All Categories"
          />
        </div>

        <div className="tx-filter-col">
          <label className="form-label">Start Date</label>
          <input
            type="date"
            value={filters.start_date || ''}
            onChange={(e) => handleChange('start_date', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="tx-filter-col">
          <label className="form-label">End Date</label>
          <input
            type="date"
            value={filters.end_date || ''}
            onChange={(e) => handleChange('end_date', e.target.value)}
            className="form-input"
          />
        </div>

        <div className="tx-filter-col">
          <label className="form-label">Sort By</label>
          <CustomSelect
            value={filters.sort || 'date_desc'}
            onChange={(val) => handleChange('sort', val)}
            options={sortOptions}
            placeholder="Newest First"
          />
        </div>

        <div className="tx-filter-col tx-filters-reset-col">
          <label className="form-label tx-filters-reset-label" aria-hidden="true">&nbsp;</label>
          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary tx-filters-reset-btn"
            title="Reset all filters"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionFilters;

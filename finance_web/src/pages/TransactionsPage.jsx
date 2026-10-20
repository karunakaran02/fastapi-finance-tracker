import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Upload, Download, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../api/client';
import TransactionTable from '../components/TransactionTable';
import TransactionFilters from '../components/TransactionFilters';
import TransactionForm from '../components/TransactionForm';
import ImportTransactionsModal from '../components/ImportTransactionsModal';
import Pagination from '../components/Pagination';
import './TransactionsPage.css';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [coldStartNotice, setColdStartNotice] = useState(false);

  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const [filters, setFilters] = useState({
    page: 1,
    page_size: 15,
    type: '',
    book_id: '',
    category_id: '',
    search: '',
    start_date: '',
    end_date: '',
    sort: 'date_desc',
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);

  const fetchCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data || []);
    } catch {
    }
  };

  const fetchBooks = async () => {
    try {
      const data = await api.getStreamBooks();
      setBooks(Array.isArray(data) ? data : (data?.items || []));
    } catch {
    }
  };

  const buildFilterParams = () => {
    const params = {
      page: filters.page,
      page_size: filters.page_size,
      sort: filters.sort,
    };
    if (filters.type) params.type = filters.type;
    if (filters.book_id) params.book_id = filters.book_id;
    if (filters.category_id) params.category_id = filters.category_id;
    if (filters.search && filters.search.trim()) params.search = filters.search.trim();

    let sDate = filters.start_date;
    let eDate = filters.end_date;
    if (sDate && eDate && sDate > eDate) {
      const temp = sDate;
      sDate = eDate;
      eDate = temp;
    }
    if (sDate) params.start_date = `${sDate}T00:00:00Z`;
    if (eDate) params.end_date = `${eDate}T23:59:59Z`;
    return params;
  };

  const fetchTransactions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTransactions(buildFilterParams());
      setTransactions(res.items || []);
      setTotal(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      setError(err.message || 'Failed to fetch transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer;
    if (loading) {
      timer = setTimeout(() => setColdStartNotice(true), 3500);
    } else {
      setColdStartNotice(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    fetchCategories();
    fetchBooks();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const handleCreateOrUpdate = async (data) => {
    if (selectedTx) {
      await api.updateTransaction(selectedTx.id, data);
    } else {
      await api.createTransaction(data);
    }
    setSelectedTx(null);
    fetchTransactions();
  };

  const handleEdit = (tx) => {
    setSelectedTx(tx);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await api.deleteTransaction(id);
      fetchTransactions();
    } catch (err) {
      alert(err.message || 'Failed to delete transaction.');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      await api.exportTransactionsCsv(buildFilterParams());
    } catch (err) {
      setError(err.message || 'Failed to export transactions.');
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmClearAll = async () => {
    setClearing(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await api.clearAllTransactions();
      setIsClearModalOpen(false);
      setSuccessMessage(res.message || 'All transactions have been successfully cleared.');
      await fetchTransactions();
    } catch (err) {
      setError(err.message || 'Failed to clear transactions.');
      setIsClearModalOpen(false);
    } finally {
      setClearing(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({
      page: 1,
      page_size: 15,
      type: '',
      book_id: '',
      category_id: '',
      search: '',
      start_date: '',
      end_date: '',
      sort: 'date_desc',
    });
  };

  return (
    <div className="content-body">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Transactions</h2>
          <p className="page-subtitle">
            Filter, search, import, and manage all your income and expenses
          </p>
        </div>
        <div className="page-actions">
          <button onClick={fetchTransactions} className="btn btn-secondary" title="Refresh">
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <button onClick={() => setIsImportOpen(true)} className="btn btn-secondary" title="Import CSV/JSON">
            <Upload size={16} />
            <span>Import</span>
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="btn btn-secondary"
            title={total === 0 ? 'No transactions to export' : 'Export transactions as CSV'}
          >
            <Download size={16} />
            <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
          </button>
          <button
            onClick={() => {
              setError('');
              setSuccessMessage('');
              setIsClearModalOpen(true);
            }}
            disabled={total === 0 || loading || clearing}
            className="btn btn-danger-outline"
            title={total === 0 ? 'No transactions to clear' : 'Clear all transactions'}
          >
            <Trash2 size={16} />
            <span>Clear All</span>
          </button>
          <button
            onClick={() => {
              setSelectedTx(null);
              setIsFormOpen(true);
            }}
            className="btn btn-add-transaction"
          >
            <Plus size={16} />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {error && <div className="alert-banner error">{error}</div>}
      {successMessage && (
        <div className="alert-banner success tx-alert-banner">
          <CheckCircle2 size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {coldStartNotice && loading && (
        <div className="alert-banner info tx-coldstart-banner">
          <RefreshCw size={14} className="animate-spin" />
          <span>Render backend server is waking up (20-30s on free tier). Please wait...</span>
        </div>
      )}

      <TransactionFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        categories={categories}
        books={books}
      />

      <div className="card">
        {loading ? (
          <div className="page-loading-box">
            <RefreshCw size={20} className="animate-spin page-loading-spinner" />
            Loading transactions...
          </div>
        ) : (
          <>
            <TransactionTable
              transactions={transactions}
              onEdit={handleEdit}
              onDelete={handleDelete}
              showActions={true}
              hasActiveFilters={Boolean(filters.type || filters.book_id || filters.category_id || filters.search || filters.start_date || filters.end_date)}
              onResetFilters={handleResetFilters}
              onAddTransaction={() => {
                setSelectedTx(null);
                setIsFormOpen(true);
              }}
            />
            {total > 0 && (
              <Pagination
                currentPage={filters.page}
                totalPages={totalPages}
                totalItems={total}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
              />
            )}
          </>
        )}
      </div>

      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedTx(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialData={selectedTx}
        categories={categories}
        books={books}
      />

      <ImportTransactionsModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={async () => {
          await Promise.all([fetchCategories(), fetchBooks(), fetchTransactions()]);
        }}
      />

      {isClearModalOpen && (
        <div className="modal-overlay" onClick={() => !clearing && setIsClearModalOpen(false)}>
          <div className="modal-content tx-clear-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="tx-clear-modal-header">
              <div className="tx-clear-modal-icon-badge">
                <AlertTriangle size={22} />
              </div>
              <div className="tx-clear-modal-header-body">
                <h3 className="tx-clear-modal-title">
                  Clear All Transactions?
                </h3>
                <p className="tx-clear-modal-subtitle">
                  This action is permanent and cannot be undone.
                </p>
              </div>
            </div>

            <p className="tx-clear-modal-desc">
              Are you sure you want to permanently delete all <strong>{total} transaction(s)</strong> recorded under your account?
            </p>

            <div className="tx-clear-modal-warning-box">
              Warning: All income and expense entries will be erased. Your dashboard calculations, percentage indicators, and financial charts will be reset to initial zero state.
            </div>

            <div className="tx-clear-modal-actions">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                disabled={clearing}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                disabled={clearing}
                className="btn btn-danger"
              >
                {clearing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Clearing Ledger...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Yes, Clear All Transactions</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;

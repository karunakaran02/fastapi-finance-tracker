import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Plus,
  Minus,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Download,
  Edit2,
  Trash2,
  ArrowLeft,
  BookOpen,
  Layers,
  ChevronDown,
  Lock,
  Printer,
  CheckCircle2,
  AlertCircle,
  X,
  MoreVertical,
  Activity,
  ChevronRight,
  Receipt,
  FileText,
  Clock,
  Tag,
  Wrench,
  DollarSign,
  Package,
} from 'lucide-react';
import api, { extractErrorMessage } from '../api/client';
import { useCurrency } from '../context/CurrencyContext';
import { useAuth } from '../context/AuthContext';
import { PRESET_BOOK_ICONS, inferIconFromTitle, getAppropriateBookIcon } from '../utils/bookIcons';
import './StreamsPage.css';

const PRESET_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];
const QUICK_TAGS = ['Income', 'Sales', 'Advance', 'Salary', 'Maintenance', 'Supplies', 'Fuel', 'Labor & Wages', 'Other'];

const getBookColorClass = (color) => {
  switch (color) {
    case '#3b82f6': return 'stream-book-avatar-blue';
    case '#8b5cf6': return 'stream-book-avatar-purple';
    case '#f59e0b': return 'stream-book-avatar-amber';
    case '#ef4444': return 'stream-book-avatar-red';
    case '#06b6d4': return 'stream-book-avatar-cyan';
    default: return 'stream-book-avatar-emerald';
  }
};

const getSwatchColorClass = (color) => {
  switch (color) {
    case '#3b82f6': return 'stream-color-blue';
    case '#8b5cf6': return 'stream-color-purple';
    case '#f59e0b': return 'stream-color-amber';
    case '#ef4444': return 'stream-color-red';
    case '#06b6d4': return 'stream-color-cyan';
    default: return 'stream-color-emerald';
  }
};

export const StreamsPage = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const { formatAmount, currency, symbol } = useCurrency();
  const { user } = useAuth();
  const searchInputRef = useRef(null);

  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [activeBook, setActiveBook] = useState(null);

  const [entries, setEntries] = useState([]);
  const [entriesMeta, setEntriesMeta] = useState({
    total: 0,
    page: 1,
    page_size: 50,
    total_pages: 1,
    total_income: 0,
    total_expense: 0,
    net_balance: 0,
  });
  const [loadingEntries, setLoadingEntries] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('latest');

  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookForm, setBookForm] = useState({
    title: '',
    description: '',
    color: '#10b981',
    icon: 'agriculture',
    isCustomIcon: false,
  });

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryForm, setEntryForm] = useState({
    type: 'IN',
    amount: '',
    remarks: '',
    category: 'Income',
    entry_date: new Date().toISOString().slice(0, 10),
  });

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);

  const showToast = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadBooks = useCallback(async () => {
    try {
      setLoadingBooks(true);
      const data = await api.getStreamBooks();
      setBooks(data || []);
      window.dispatchEvent(new CustomEvent('streams-updated'));
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to load streams'));
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    const handleOpenModal = () => {
      setEditingBook(null);
      setBookForm({ title: '', description: '', color: '#10b981', icon: 'agriculture', isCustomIcon: false });
      setShowBookModal(true);
    };
    window.addEventListener('open-new-stream-modal', handleOpenModal);
    return () => window.removeEventListener('open-new-stream-modal', handleOpenModal);
  }, []);

  useEffect(() => {
    if (bookId && books.length > 0) {
      const found = books.find((b) => String(b.id) === String(bookId));
      if (found) {
        setActiveBook(found);
      } else {
        api
          .getStreamBook(bookId)
          .then((res) => setActiveBook(res))
          .catch(() => {
            navigate('/streams', { replace: true });
          });
      }
    } else if (!bookId) {
      setActiveBook(null);
    }
  }, [bookId, books, navigate]);

  const loadEntries = useCallback(async () => {
    if (!activeBook) return;
    try {
      setLoadingEntries(true);
      const params = {
        page: 1,
        page_size: 100,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (typeFilter) params.type = typeFilter;

      const res = await api.getStreamEntries(activeBook.id, params);
      if (res) {
        let items = res.items || [];
        if (sortOrder === 'oldest') {
          items = [...items].reverse();
        }
        setEntries(items);
        setEntriesMeta({
          total: res.total,
          page: res.page,
          page_size: res.page_size,
          total_pages: res.total_pages,
          total_income: parseFloat(res.total_income || 0),
          total_expense: parseFloat(res.total_expense || 0),
          net_balance: parseFloat(res.net_balance || 0),
        });
      }
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to fetch book transactions'));
    } finally {
      setLoadingEntries(false);
    }
  }, [activeBook, searchQuery, typeFilter, sortOrder]);

  useEffect(() => {
    if (activeBook) {
      loadEntries();
    }
  }, [activeBook, loadEntries]);

  const hubStats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let totalBalance = 0;
    let totalEntries = 0;

    books.forEach((b) => {
      totalIn += parseFloat(b.total_income || 0);
      totalOut += parseFloat(b.total_expense || 0);
      totalBalance += parseFloat(b.net_balance || 0);
      totalEntries += b.entries_count || 0;
    });

    return {
      totalBooks: books.length,
      totalIn,
      totalOut,
      totalBalance,
      totalEntries,
    };
  }, [books]);

  const { inflowCount, outflowCount } = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    entries.forEach((e) => {
      if (e.type === 'IN') inCount++;
      else outCount++;
    });
    return { inflowCount: inCount, outflowCount: outCount };
  }, [entries]);

  const netMarginPercent = useMemo(() => {
    if (entriesMeta.total_income <= 0) return 0;
    const margin = (entriesMeta.net_balance / entriesMeta.total_income) * 100;
    return margin.toFixed(1);
  }, [entriesMeta]);

  const handleOpenCreateBook = () => {
    setEditingBook(null);
    setBookForm({ title: '', description: '', color: '#10b981', icon: 'agriculture', isCustomIcon: false });
    setShowBookModal(true);
  };

  const handleOpenEditBook = (book, e) => {
    if (e) e.stopPropagation();
    setEditingBook(book);
    setBookForm({
      title: book.title,
      description: book.description || '',
      color: book.color || '#10b981',
      icon: getAppropriateBookIcon(book.title, book.icon),
      isCustomIcon: true,
    });
    setShowBookModal(true);
  };

  const handleSaveBook = async (e) => {
    e.preventDefault();
    if (!bookForm.title.trim()) {
      showToast('error', 'Book title is required');
      return;
    }
    try {
      const resolvedIcon = bookForm.icon || getAppropriateBookIcon(bookForm.title);
      const payload = {
        title: bookForm.title.trim(),
        description: bookForm.description ? bookForm.description.trim() : '',
        color: bookForm.color || '#10b981',
        icon: resolvedIcon,
      };
      if (editingBook) {
        const updated = await api.updateStreamBook(editingBook.id, payload);
        showToast('success', `"${updated.title}" updated successfully!`);
        if (activeBook && activeBook.id === editingBook.id) {
          setActiveBook(updated);
        }
      } else {
        const created = await api.createStreamBook(payload);
        showToast('success', `Book "${created.title}" created successfully!`);
        navigate(`/streams/${created.id}`);
      }
      setShowBookModal(false);
      await loadBooks();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to save book'));
    }
  };

  const handleDeleteBook = async (bookIdToDelete) => {
    try {
      await api.deleteStreamBook(bookIdToDelete);
      showToast('success', 'Book and all its records deleted successfully.');
      setDeleteConfirm(null);
      if (activeBook && activeBook.id === bookIdToDelete) {
        navigate('/streams');
      }
      await loadBooks();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to delete book'));
    }
  };

  const handleOpenCreateEntry = (type = 'IN') => {
    setEditingEntry(null);
    setEntryForm({
      type,
      amount: '',
      remarks: '',
      category: type === 'IN' ? 'Income' : 'Maintenance',
      entry_date: new Date().toISOString().slice(0, 10),
    });
    setShowEntryModal(true);
  };

  const handleOpenEditEntry = (entry) => {
    setEditingEntry(entry);
    const dateStr = entry.entry_date
      ? new Date(entry.entry_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setEntryForm({
      type: entry.type,
      amount: String(entry.amount),
      remarks: entry.remarks || '',
      category: entry.category || (entry.type === 'IN' ? 'Income' : 'Maintenance'),
      entry_date: dateStr,
    });
    setShowEntryModal(true);
  };

  const handleSaveEntry = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(entryForm.amount);
    if (!numAmount || numAmount <= 0) {
      showToast('error', 'Please enter a valid amount greater than 0');
      return;
    }
    try {
      const payload = {
        type: entryForm.type,
        amount: numAmount.toFixed(2),
        remarks: entryForm.remarks.trim() || null,
        category: entryForm.category.trim() || null,
        entry_date: new Date(entryForm.entry_date).toISOString(),
      };

      if (editingEntry) {
        await api.updateStreamEntry(activeBook.id, editingEntry.id, payload);
        showToast('success', 'Transaction updated!');
      } else {
        await api.createStreamEntry(activeBook.id, payload);
        showToast('success', `${payload.type === 'IN' ? 'Cash In' : 'Cash Out'} recorded!`);
      }
      setShowEntryModal(false);
      await loadEntries();
      await loadBooks();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to record entry'));
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      await api.deleteStreamEntry(activeBook.id, entryId);
      showToast('success', 'Transaction deleted');
      await loadEntries();
      await loadBooks();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to delete transaction'));
    }
  };

  const handleExportPdf = async () => {
    if (!activeBook) return;
    try {
      await api.downloadStreamExport(activeBook.id, activeBook.title, 'pdf');
      showToast('success', 'Book PDF statement downloaded successfully!');
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to download statement'));
    }
  };

  const handlePrintView = () => {
    window.print();
  };

  const getCategoryBadgeClass = (cat, type) => {
    if (type === 'IN') {
      return 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/20';
    }
    const lower = (cat || '').toLowerCase();
    if (lower.includes('supplies') || lower.includes('fertilizer')) {
      return 'bg-cyan-950/70 text-cyan-300 border border-cyan-500/20';
    }
    if (lower.includes('maintenance') || lower.includes('repair')) {
      return 'bg-amber-950/70 text-amber-300 border border-amber-500/20';
    }
    if (lower.includes('fuel') || lower.includes('diesel')) {
      return 'bg-rose-950/70 text-rose-300 border border-rose-500/20';
    }
    return 'bg-slate-800 text-slate-300 border border-slate-700';
  };

  const getCategoryIcon = (cat, type) => {
    if (type === 'IN') {
      return <DollarSign size={15} className="text-emerald-400" />;
    }
    const lower = (cat || '').toLowerCase();
    if (lower.includes('maintenance') || lower.includes('machine') || lower.includes('repair')) {
      return <Wrench size={15} className="text-amber-400" />;
    }
    if (lower.includes('supplies') || lower.includes('fertilizer') || lower.includes('nutrient')) {
      return <Package size={15} className="text-cyan-400" />;
    }
    return <Receipt size={15} className="text-rose-400" />;
  };

  return (
    <div className="streams-page-wrapper bg-grid-pattern">

      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-xl transition-all ${
            feedback.type === 'error'
              ? 'bg-rose-950/95 text-rose-200 border-rose-800 shadow-glow-rose'
              : 'bg-emerald-950/95 text-emerald-200 border-emerald-800 shadow-glow-emerald'
          }`}
        >
          {feedback.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {!activeBook ? (
        <div className="streams-inner-container">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-electric via-brand-cobalt to-brand-cyan flex items-center justify-center text-white shadow-glow-blue">
                <Layers size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                    Streams &amp; Financial Books
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live Sync
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Independent financial records &amp; cash flows for every purpose
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateBook}
              className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm shadow-glow-emerald transition-all"
            >
              <Plus size={16} />
              <span>Create New Book</span>
            </button>
          </div>

          <div className="kpi-pillar-grid mb-8">

            <div className="kpi-pillar-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Total Active Books
                </span>
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <BookOpen size={16} />
                </div>
              </div>
              <div className="my-3 flex flex-col">
                <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                  {hubStats.totalBooks}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  {hubStats.totalEntries} total ledger transactions recorded
                </span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] text-xs text-slate-400 flex items-center justify-between">
                <span>Multi-book ledger</span>
                <span className="text-emerald-400 font-medium">100% Isolated</span>
              </div>
            </div>

            <div className="kpi-pillar-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Combined Cash In
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <ArrowUpRight size={16} />
                </div>
              </div>
              <div className="my-3 flex flex-col">
                <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                  {formatAmount(hubStats.totalIn)}
                </span>
                <span className="text-xs text-slate-400 mt-1">All credited entries across books</span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] text-xs text-slate-400 flex items-center justify-between">
                <span>Total inflows</span>
                <span className="text-emerald-400 font-medium font-mono">Active Streams</span>
              </div>
            </div>

            <div className="kpi-pillar-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Combined Net Balance
                </span>
                <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                  <Layers size={16} />
                </div>
              </div>
              <div className="my-3 flex flex-col">
                <span
                  className={`text-3xl font-extrabold font-mono tracking-tight ${
                    hubStats.totalBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatAmount(hubStats.totalBalance)}
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  Combined outflow: {formatAmount(hubStats.totalOut)}
                </span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] text-xs text-slate-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Solvent Position
                </span>
                <span className="font-mono text-slate-300">Net Standing</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Your Financial Books</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 border border-white/[0.08] text-slate-300 font-mono">
                  {books.length}
                </span>
              </h2>
            </div>

            {loadingBooks ? (
              <div className="p-12 text-center text-slate-400 text-sm">Loading your books...</div>
            ) : books.length === 0 ? (
              <div className="border border-dashed border-white/[0.1] rounded-2xl p-12 text-center bg-slate-900/40">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <BookOpen size={26} />
                </div>
                <h3 className="text-base font-bold text-white mb-1">No Books Created Yet</h3>
                <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-5">
                  Create your first book (e.g. <i>Samba – 2026</i>, <i>Sundareswar</i>, <i>Karunakaran</i>, or <i>Office Petty Cash</i>) to start recording isolated cash flows.
                </p>
                <button
                  type="button"
                  onClick={handleOpenCreateBook}
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-sm shadow-glow-emerald"
                >
                  <Plus size={16} />
                  <span>Create Your First Book</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map((b) => {
                  const net = parseFloat(b.net_balance || 0);
                  const isPositive = net >= 0;
                  return (
                    <div
                      key={b.id}
                      onClick={() => navigate(`/streams/${b.id}`)}
                      className="group p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 hover:bg-slate-850/90 transition-all cursor-pointer flex flex-col justify-between shadow-sm relative overflow-hidden"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border ${getBookColorClass(b.color)}`}
                            >
                              <span className="material-symbols-outlined text-[24px]">
                                {getAppropriateBookIcon(b.title, b.icon)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                {b.title}
                              </h3>
                              <p className="text-xs text-slate-400 truncate mt-0.5">
                                {b.description || 'Isolated financial book ledger'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditBook(b, e)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.08] transition-colors"
                            title="Edit Book"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>

                        <div className="my-3">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block mb-1">
                            Current Net Balance
                          </span>
                          <span
                            className={`text-2xl font-bold font-mono tracking-tight ${
                              isPositive ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {formatAmount(net)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                          <span className="flex items-center gap-1 text-emerald-400 font-mono">
                            <ArrowUpRight size={13} /> {formatAmount(b.total_income || 0)}
                          </span>
                          <span className="flex items-center gap-1 text-rose-400 font-mono">
                            <ArrowDownLeft size={13} /> {formatAmount(b.total_expense || 0)}
                          </span>
                          <span className="text-slate-400 text-[11px]">
                            {b.entries_count || 0} entries
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-xs text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                          <span>Open Book Ledger</span>
                          <ChevronRight size={15} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (

        <div className="streams-inner-container">

          <div className="desktop-only-view flex flex-col gap-5 mb-6">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => navigate('/streams')}
                  className="inline-flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors w-fit text-xs font-medium group"
                >
                  <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                  <span>All Streams Hub</span>
                </button>

                <div className="flex items-center gap-3 mt-1">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-sm border ${getBookColorClass(activeBook.color)}`}
                  >
                    <span className="material-symbols-outlined text-[24px]">
                      {getAppropriateBookIcon(activeBook.title, activeBook.icon)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2.5">
                      <h1 className="text-2xl font-bold tracking-tight text-white">{activeBook.title}</h1>
                      <button
                        type="button"
                        onClick={() => handleOpenEditBook(activeBook)}
                        className="w-7 h-7 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        title="Rename Book"
                      >
                        <Edit2 size={15} />
                      </button>
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-emerald-500/25">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Isolated Ledger</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {activeBook.description || 'Isolated financial book ledger • CashBook stream'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <select
                    value={activeBook.id}
                    onChange={(e) => navigate(`/streams/${e.target.value}`)}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 px-3.5 py-2 rounded-xl text-white text-xs font-semibold border border-white/[0.08] focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleOpenCreateBook}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-white px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/[0.08] transition-colors"
                >
                  <Plus size={15} className="text-emerald-400" />
                  <span>New Book</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/[0.08] transition-colors"
                  title="Download Book Statement (PDF)"
                >
                  <Download size={15} />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteConfirm(activeBook)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 flex items-center justify-center text-slate-400 border border-white/[0.08] transition-colors"
                  title="Archive / Delete Stream"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="kpi-pillar-grid">

              <div className="kpi-pillar-card">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Total Cash In
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                    <ArrowUpRight size={17} />
                  </div>
                </div>
                <div className="my-3 flex flex-col">
                  <span className="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                    {formatAmount(entriesMeta.total_income)}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    All credited entries for {activeBook.title}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-mono text-xs">
                    <ArrowUpRight size={13} className="text-emerald-400" /> {inflowCount} Inflow batches
                  </span>
                  <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    100% Verified
                  </span>
                </div>
              </div>

              <div className="kpi-pillar-card">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Total Cash Out
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center">
                    <ArrowDownLeft size={17} />
                  </div>
                </div>
                <div className="my-3 flex flex-col">
                  <span className="text-3xl font-extrabold text-rose-400 font-mono tracking-tight">
                    {formatAmount(entriesMeta.total_expense)}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Debited expenses &amp; operational vouchers
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs text-slate-400">
                  <span className="flex items-center gap-1 font-mono text-xs">
                    <ArrowDownLeft size={13} className="text-rose-400" /> {outflowCount} Debit vouchers
                  </span>
                  <span className="text-[10px] font-bold uppercase text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    Operational Exp
                  </span>
                </div>
              </div>

              <div className="kpi-pillar-card">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Current Net Balance
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
                    <BookOpen size={17} />
                  </div>
                </div>
                <div className="my-3 flex flex-col">
                  <span
                    className={`text-3xl font-extrabold font-mono tracking-tight ${
                      entriesMeta.net_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatAmount(entriesMeta.net_balance)}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {entriesMeta.total} recorded entries • Realized balance
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span className="text-emerald-400 font-medium">Solvent Position</span>
                  </div>
                  <span className="font-mono text-xs text-slate-400">
                    Net {entriesMeta.net_balance >= 0 ? `+${netMarginPercent}%` : `${netMarginPercent}%`}
                  </span>
                </div>
              </div>
            </div>

            <div className="desktop-cta-grid">
              <button
                type="button"
                onClick={() => handleOpenCreateEntry('IN')}
                className="btn-primary-cash-in group"
              >
                <Plus size={22} className="group-hover:rotate-90 transition-transform" />
                <span>Cash In</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateEntry('OUT')}
                className="btn-primary-cash-out group"
              >
                <Minus size={22} className="group-hover:-translate-x-0.5 transition-transform" />
                <span>Cash Out</span>
              </button>
            </div>
          </div>

          <div className="mobile-only-view flex flex-col gap-4 mb-4">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/streams')}
                  className="w-8 h-8 rounded-full bg-slate-800/80 active:scale-95 flex items-center justify-center text-slate-300 transition-all"
                  title="Back to All Streams"
                >
                  <ArrowLeft size={16} />
                </button>
                <div className="flex items-center gap-1 bg-slate-800/60 px-2.5 py-1 rounded-full border border-slate-700/60">
                  <span className="text-xs font-medium text-slate-300">All Streams Hub</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Live</span>
                </div>
                <div className="text-[11px] font-mono font-medium px-2 py-1 bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                  {symbol} {currency}
                </div>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="w-8 h-8 rounded-full bg-slate-800 active:bg-slate-700 flex items-center justify-center text-slate-300"
                  title="Download Book Statement (PDF)"
                >
                  <Download size={15} />
                </button>
              </div>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner border ${getBookColorClass(activeBook.color)}`}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {getAppropriateBookIcon(activeBook.title, activeBook.icon)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold tracking-tight text-white">{activeBook.title}</h1>
                    <button
                      type="button"
                      onClick={() => handleOpenEditBook(activeBook)}
                      className="text-slate-400 hover:text-white"
                      title="Rename book"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">Isolated financial book ledger</p>
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowActionsDropdown((prev) => !prev)}
                  className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800/50 border border-slate-800"
                >
                  <MoreVertical size={16} />
                </button>
                {showActionsDropdown && (
                  <div className="absolute right-0 top-10 w-44 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-30 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsDropdown(false);
                        handleOpenEditBook(activeBook);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Edit2 size={13} /> Rename Book
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsDropdown(false);
                        handleExportPdf();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                    >
                      <Download size={13} /> Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowActionsDropdown(false);
                        setDeleteConfirm(activeBook);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                    >
                      <Trash2 size={13} /> Delete Book
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mobile-hero-balance">
              <div className="absolute -right-8 -top-8 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute -left-8 -bottom-8 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BookOpen size={14} className="text-cyan-400" />
                  <span>Current Net Balance</span>
                </span>
                <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Active Stream
                </span>
              </div>
              <div
                className={`text-3xl font-extrabold tracking-tight font-mono ${
                  entriesMeta.net_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatAmount(entriesMeta.net_balance)}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span>{entriesMeta.total} recorded transactions</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Book ID: #{activeBook.id}</span>
              </div>
            </div>

            <div className="mobile-quick-stats-grid">

              <div className="mobile-quick-stat-card border-emerald-950/60">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-medium">Total Cash In</span>
                  <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                    <ArrowUpRight size={14} />
                  </div>
                </div>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  {formatAmount(entriesMeta.total_income)}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 truncate">All credited entries</p>
              </div>

              <div className="mobile-quick-stat-card border-rose-950/60">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-medium">Total Cash Out</span>
                  <div className="w-5 h-5 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400">
                    <ArrowDownLeft size={14} />
                  </div>
                </div>
                <div className="text-base font-bold text-rose-400 font-mono">
                  {formatAmount(entriesMeta.total_expense)}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 truncate">All debited entries</p>
              </div>
            </div>

            <div className="mobile-action-bar">
              <button
                type="button"
                onClick={() => handleOpenCreateEntry('IN')}
                className="btn-mobile-cash-in"
              >
                <Plus size={16} />
                <span>Cash In</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenCreateEntry('OUT')}
                className="btn-mobile-cash-out"
              >
                <Minus size={16} />
                <span>Cash Out</span>
              </button>
            </div>
          </div>

          <div className="filter-strip-container mb-4">

            <div className="search-input-wrap">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search remarks, tag, amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-0.5 pointer-events-none">
                <kbd className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">⌘</kbd>
                <kbd className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">K</kbd>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="segmented-pill-box">
                <button
                  type="button"
                  onClick={() => setTypeFilter('')}
                  className={`segmented-pill-btn ${typeFilter === '' ? 'active' : ''}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('IN')}
                  className={`segmented-pill-btn ${typeFilter === 'IN' ? 'active text-emerald-400' : ''}`}
                >
                  Cash In Only
                </button>
                <button
                  type="button"
                  onClick={() => setTypeFilter('OUT')}
                  className={`segmented-pill-btn ${typeFilter === 'OUT' ? 'active text-rose-400' : ''}`}
                >
                  Cash Out Only
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'latest' ? 'oldest' : 'latest'))}
                className="hidden sm:flex items-center gap-1.5 bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-medium border border-white/[0.06] transition-colors"
                title="Toggle sort order"
              >
                <Clock size={13} className="text-slate-400" />
                <span>{sortOrder === 'latest' ? 'Latest First' : 'Oldest First'}</span>
              </button>
            </div>
          </div>

          <div className="desktop-only-view">
            <div className="desktop-table-container">
              {loadingEntries ? (
                <div className="p-16 text-center text-slate-400 text-sm">Loading transactions...</div>
              ) : entries.length === 0 ? (
                <div className="p-16 text-center text-slate-400">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                    <FileText size={22} />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">No Ledger Entries Found</h4>
                  <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
                    {searchQuery || typeFilter
                      ? 'No transactions matched your search or filters.'
                      : `Record your first entry in ${activeBook.title} using the + Cash In or − Cash Out buttons.`}
                  </p>
                  {!searchQuery && !typeFilter && (
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenCreateEntry('IN')}
                        className="btn-primary-cash-in text-xs px-4 py-2"
                      >
                        Cash In
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateEntry('OUT')}
                        className="btn-primary-cash-out text-xs px-4 py-2"
                      >
                        Cash Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="desktop-ledger-table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Remarks / Details</th>
                        <th>Category</th>
                        <th className="text-right">Cash In (+)</th>
                        <th className="text-right">Cash Out (−)</th>
                        <th className="text-right">Running Balance</th>
                        <th className="text-center w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const isIn = entry.type === 'IN';
                        const amt = parseFloat(entry.amount);
                        const d = new Date(entry.entry_date);
                        const dateStr = d.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        });
                        const timeStr = d.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={entry.id}>
                            <td className="whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs font-semibold text-white">{dateStr}</span>
                                <span className="font-mono text-[11px] text-slate-400">{timeStr}</span>
                              </div>
                            </td>
                            <td>
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0 border border-white/[0.06]">
                                  {getCategoryIcon(entry.category, entry.type)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-white text-sm truncate">
                                    {entry.remarks || <span className="text-slate-500 italic">No remarks</span>}
                                  </span>
                                  <span className="text-[11px] text-slate-400 truncate">
                                    Entry #{entry.id} • {entry.type === 'IN' ? 'Credited' : 'Debited'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryBadgeClass(
                                  entry.category,
                                  entry.type
                                )}`}
                              >
                                {entry.category || 'General'}
                              </span>
                            </td>
                            <td className="text-right whitespace-nowrap">
                              {isIn ? (
                                <span className="font-mono text-sm font-bold text-emerald-400">
                                  +{formatAmount(amt)}
                                </span>
                              ) : (
                                <span className="font-mono text-sm text-slate-600">—</span>
                              )}
                            </td>
                            <td className="text-right whitespace-nowrap">
                              {!isIn ? (
                                <span className="font-mono text-sm font-bold text-rose-400">
                                  −{formatAmount(amt)}
                                </span>
                              ) : (
                                <span className="font-mono text-sm text-slate-600">—</span>
                              )}
                            </td>
                            <td className="text-right whitespace-nowrap">
                              <span className="font-mono text-sm font-bold text-white">
                                {formatAmount(entry.running_balance ?? 0)}
                              </span>
                            </td>
                            <td className="text-center whitespace-nowrap">
                              <div className="inline-flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditEntry(entry)}
                                  className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
                                  title="Edit entry"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  className="w-7 h-7 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors"
                                  title="Delete entry"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 bg-slate-950 border-t border-white/[0.06] gap-3 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-300">
                    Showing {entries.length} of {entriesMeta.total} ledger entries
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Lock size={13} />
                    <span>Tamper-proof Logged</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Download size={14} />
                    <span>PDF Statement</span>
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={handlePrintView}
                    className="hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <Printer size={14} />
                    <span>Print View</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 bg-slate-900/60 rounded-xl border border-white/[0.06] gap-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center flex-shrink-0 border border-cyan-500/20">
                  <Activity size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-white text-sm">
                    Cashflow Telemetry Synchronized
                  </span>
                  <span className="text-xs text-slate-400">
                    {activeBook.title} cashflow is active with {entriesMeta.total} entries and {formatAmount(entriesMeta.net_balance)} net balance.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 self-end md:self-auto">
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  Audit: Verified
                </span>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-white/[0.06] transition-colors"
                >
                  Download PDF Statement
                </button>
              </div>
            </div>
          </div>

          <div className="mobile-only-view space-y-3">
            <div className="flex items-center justify-between text-xs px-1 text-slate-400">
              <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">
                Ledger History ({entries.length})
              </span>
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'latest' ? 'oldest' : 'latest'))}
                className="text-cyan-400 font-medium flex items-center gap-1 hover:underline text-xs"
              >
                <span>Sort: {sortOrder === 'latest' ? 'Latest' : 'Oldest'}</span>
                <ChevronDown size={13} />
              </button>
            </div>

            {loadingEntries ? (
              <div className="p-8 text-center text-slate-400 text-xs">Loading transactions...</div>
            ) : entries.length === 0 ? (
              <div className="p-8 text-center text-slate-400 border border-dashed border-white/[0.1] rounded-2xl bg-slate-900/40">
                <p className="text-sm font-semibold text-white mb-1">No transactions recorded</p>
                <p className="text-xs text-slate-400 mb-3">
                  Tap Cash In or Cash Out above to log your first transaction in {activeBook.title}.
                </p>
              </div>
            ) : (
              entries.map((entry) => {
                const isIn = entry.type === 'IN';
                const amt = parseFloat(entry.amount);
                const d = new Date(entry.entry_date);
                const dateStr = d.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                });
                const timeStr = d.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div key={entry.id} className="mobile-tx-card">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-100 text-sm truncate">
                            {entry.remarks || 'No remarks'}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getCategoryBadgeClass(
                              entry.category,
                              entry.type
                            )}`}
                          >
                            {entry.category || 'General'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span>{timeStr}</span>
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <div
                          className={`text-sm font-bold font-mono ${
                            isIn ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isIn ? `+${formatAmount(amt)}` : `−${formatAmount(amt)}`}
                        </div>
                        <span
                          className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 ${
                            isIn
                              ? 'text-emerald-400/90 bg-emerald-500/10'
                              : 'text-rose-400/90 bg-rose-500/10'
                          }`}
                        >
                          {isIn ? 'Cash In' : 'Cash Out'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="text-slate-400 text-xs">
                        Running Bal:{' '}
                        <span className="font-semibold text-slate-200 font-mono">
                          {formatAmount(entry.running_balance ?? 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-400">
                        <button
                          type="button"
                          onClick={() => handleOpenEditEntry(entry)}
                          className="hover:text-slate-200 active:scale-95 transition-transform"
                          title="Edit transaction"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="hover:text-rose-400 active:scale-95 transition-transform"
                          title="Delete transaction"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            <div className="pt-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold flex items-center justify-center text-xs">
                    {user?.full_name?.slice(0, 2).toUpperCase() || 'FI'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200">{user?.full_name || 'Active User'}</p>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Active Vault • Finance Intel PRO</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEntryModal && (
        <div className="streams-modal-overlay" onClick={() => setShowEntryModal(false)}>
          <div className="streams-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="streams-modal-header">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                    entryForm.type === 'IN'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {entryForm.type === 'IN' ? '+' : '−'}
                </span>
                <span className="text-base font-bold text-white">
                  {editingEntry
                    ? 'Edit Transaction'
                    : entryForm.type === 'IN'
                    ? 'Record Cash In'
                    : 'Record Cash Out'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/[0.08]">
                  {activeBook?.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowEntryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEntry}>
              <div className="streams-modal-body space-y-4">

                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setEntryForm({ ...entryForm, type: 'IN' })}
                    className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      entryForm.type === 'IN'
                        ? 'bg-emerald-500 text-slate-950 shadow-glow-emerald'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Plus size={14} /> Cash In
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryForm({ ...entryForm, type: 'OUT' })}
                    className={`py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                      entryForm.type === 'OUT'
                        ? 'bg-rose-500 text-white shadow-glow-rose'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Minus size={14} /> Cash Out
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Amount ({symbol} {currency}) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={entryForm.amount}
                    onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                    className="w-full bg-slate-950 text-white font-mono text-2xl font-bold px-3.5 py-2.5 rounded-xl border border-white/[0.1] focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Remarks / Particulars
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grain dispatch, Seed expenditure, Diesel refuel"
                    value={entryForm.remarks}
                    onChange={(e) => setEntryForm({ ...entryForm, remarks: e.target.value })}
                    className="w-full bg-slate-950 text-white text-sm px-3.5 py-2.5 rounded-xl border border-white/[0.1] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Category Tag
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Income, Maintenance, Supplies"
                      value={entryForm.category}
                      onChange={(e) => setEntryForm({ ...entryForm, category: e.target.value })}
                      className="w-full bg-slate-950 text-white text-sm px-3.5 py-2 rounded-xl border border-white/[0.1] focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Date
                    </label>
                    <input
                      type="date"
                      required
                      value={entryForm.entry_date}
                      onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })}
                      className="w-full bg-slate-950 text-white text-sm font-mono px-3.5 py-2 rounded-xl border border-white/[0.1] focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400">Quick Tags:</span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {QUICK_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setEntryForm({ ...entryForm, category: tag })}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                          entryForm.category === tag
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold'
                            : 'border-white/[0.08] bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="streams-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowEntryModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    entryForm.type === 'IN'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-glow-emerald'
                      : 'bg-rose-500 hover:bg-rose-400 text-white shadow-glow-rose'
                  }`}
                >
                  {editingEntry ? 'Update Entry' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBookModal && (
        <div className="streams-modal-overlay" onClick={() => setShowBookModal(false)}>
          <div className="streams-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="streams-modal-header">
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {editingBook ? 'Edit Book Settings' : 'Create New Book'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBookModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBook}>
              <div className="streams-modal-body space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Book Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Samba – 2026, Sundareswar, Karunakaran..."
                    value={bookForm.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setBookForm((prev) => ({
                        ...prev,
                        title: newTitle,
                        icon: prev.isCustomIcon ? prev.icon : inferIconFromTitle(newTitle),
                      }));
                    }}
                    className="w-full bg-slate-950 text-white font-medium text-sm px-3.5 py-2.5 rounded-xl border border-white/[0.1] focus:outline-none focus:border-cyan-500"
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Description / Purpose (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Kharif Agri Yield • FY 26-27, Daily office operations"
                    value={bookForm.description}
                    onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })}
                    className="w-full bg-slate-950 text-white text-sm px-3.5 py-2.5 rounded-xl border border-white/[0.1] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Book Icon
                    </label>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                      <span className="material-symbols-outlined text-[16px]">{bookForm.icon}</span>
                      <span className="text-[10px] uppercase tracking-wider">
                        {bookForm.isCustomIcon ? 'Custom Selected' : 'Suggested from Title'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-2 max-h-48 overflow-y-auto p-1.5 rounded-xl bg-slate-950 border border-white/[0.06]">
                    {PRESET_BOOK_ICONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        title={item.label}
                        onClick={() => setBookForm((prev) => ({ ...prev, icon: item.id, isCustomIcon: true }))}
                        className={`h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 border transition-all ${
                          bookForm.icon === item.id
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400 scale-105 shadow-glow-emerald'
                            : 'border-white/[0.06] bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{item.id}</span>
                        <span className="text-[8px] font-mono truncate max-w-[90%] opacity-75">{item.id.replace('_', ' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    Theme Color
                  </label>
                  <div className="flex items-center gap-3">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBookForm({ ...bookForm, color: c })}
                        className={`w-7 h-7 rounded-full border-2 transition-transform ${getSwatchColorClass(c)} ${
                          bookForm.color === c ? 'scale-125 border-white' : 'border-transparent'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="streams-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-glow-emerald transition-all"
                >
                  {editingBook ? 'Save Changes' : 'Create Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="streams-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="streams-modal-card max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="streams-modal-header border-b-0 pb-0">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertCircle className="text-rose-500" size={18} />
                <span>Delete Book?</span>
              </h3>
            </div>
            <div className="streams-modal-body py-3">
              <p className="text-sm text-slate-300">
                Are you sure you want to permanently delete <strong>{deleteConfirm.title}</strong>?
              </p>
              <p className="text-xs text-rose-400/90 mt-2 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                All transactions recorded inside this book will be permanently erased. This action cannot be undone.
              </p>
            </div>
            <div className="streams-modal-footer">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteBook(deleteConfirm.id)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-glow-rose transition-all"
              >
                Yes, Delete Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StreamsPage;

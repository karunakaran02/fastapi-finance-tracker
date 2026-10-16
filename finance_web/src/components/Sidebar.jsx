import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import './Sidebar.css';

export const MobileMenuButton = () => (
  <button
    type="button"
    onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'))}
    className="mobile-menu-btn"
    aria-label="Open navigation menu"
    title="Menu"
  >
    <Menu size={18} />
  </button>
);

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [txCount, setTxCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [streamBooks, setStreamBooks] = useState([]);

  const fetchStreamBooks = () => {
    api
      .getStreamBooks()
      .then((data) => {
        if (Array.isArray(data)) {
          setStreamBooks(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    let mounted = true;
    api
      .getTransactions({ page: 1, page_size: 1 })
      .then((res) => {
        if (mounted && res && typeof res.total === 'number') {
          setTxCount(res.total);
        }
      })
      .catch(() => {});

    fetchStreamBooks();

    const handleUpdate = () => fetchStreamBooks();
    window.addEventListener('streams-updated', handleUpdate);

    return () => {
      mounted = false;
      window.removeEventListener('streams-updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleToggle = () => setMobileOpen((prev) => !prev);
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('toggle-mobile-sidebar', handleToggle);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('toggle-mobile-sidebar', handleToggle);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getInitials = (name, email) => {
    if (name && name.trim()) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return name.trim().slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'PI';
  };

  const navClass = ({ isActive }) =>
    isActive
      ? 'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-brand-electric to-brand-cobalt shadow-glow-blue transition-all group'
      : 'flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors group';

  const mobileTabClass = ({ isActive }) => `mobile-tab-link ${isActive ? 'active' : ''}`;

  return (
    <>
      {mobileOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar-drawer ${
          mobileOpen ? 'is-open' : ''
        } w-72 shrink-0 border-r border-white/[0.06] bg-obsidian-900/90 backdrop-blur-xl flex flex-col justify-between hidden lg:flex sticky top-0 h-screen z-40`}
        data-purpose="sidebar-navigation"
      >
        <div className="flex flex-col h-full">
          <div className="px-6 py-6 border-b border-white/[0.06] flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-electric via-brand-cobalt to-brand-cyan shadow-glow-blue shrink-0">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.2"
                />
              </svg>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-brand-emerald rounded-full border-2 border-obsidian-900"></div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white truncate">Finance Intel</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-cobalt/20 text-brand-cobalt border border-brand-cobalt/30">
                  Pro
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400 truncate">Portfolio Intelligence</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="mobile-drawer-close"
              aria-label="Close navigation menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto" data-purpose="primary-navigation">
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Executive Suite
            </div>

            <NavLink to="/dashboard" className={navClass}>
              {({ isActive }) => (
                <>
                  <svg
                    className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-cobalt transition-colors'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="flex-1">Dashboard</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                </>
              )}
            </NavLink>

            <NavLink to="/transactions" className={navClass}>
              {({ isActive }) => (
                <>
                  <svg
                    className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-cobalt transition-colors'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="flex-1">Transactions</span>
                  {isActive ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-obsidian-800 text-slate-300 border border-white/[0.08]">
                      {txCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>

            <NavLink to="/reports" className={navClass}>
              {({ isActive }) => (
                <>
                  <svg
                    className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-cyan transition-colors'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="flex-1">Reports &amp; P&amp;L</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                </>
              )}
            </NavLink>

            <NavLink to="/categories" className={navClass}>
              {({ isActive }) => (
                <>
                  <svg
                    className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-violet transition-colors'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="flex-1">Categories</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                </>
              )}
            </NavLink>

            <NavLink to="/budgets" className={navClass}>
              {({ isActive }) => (
                <>
                  <svg
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-amber-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="flex-1">Budgets & Alerts</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                </>
              )}
            </NavLink>

            <div className="pt-4 px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase flex items-center justify-between">
              <span>Streams</span>
              <button
                type="button"
                onClick={() => {
                  if (location.pathname.startsWith('/streams')) {
                    window.dispatchEvent(new CustomEvent('open-new-stream-modal'));
                  } else {
                    navigate('/streams');
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent('open-new-stream-modal'));
                    }, 120);
                  }
                }}
                className="text-[10px] text-brand-electric hover:text-white font-bold px-1.5 py-0.5 rounded bg-brand-electric/10 hover:bg-brand-electric/25 border border-brand-electric/30 transition-colors"
                title="Create New Book"
              >
                + New Book
              </button>
            </div>

            <NavLink to="/streams" end className={navClass}>
              {({ isActive }) => (
                <>
                  <Layers
                    className={`w-5 h-5 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-electric transition-colors'
                    }`}
                  />
                  <span className="flex-1">All Streams</span>
                  {isActive ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                  ) : (
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-obsidian-800 text-slate-300 border border-white/[0.08]">
                      {streamBooks.length}
                    </span>
                  )}
                </>
              )}
            </NavLink>

            {streamBooks.length > 0 && (
              <div className="space-y-1 pl-2">
                {streamBooks.map((book) => (
                  <NavLink
                    key={book.id}
                    to={`/streams/${book.id}`}
                    className={({ isActive }) =>
                      isActive
                        ? 'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600/30 border border-blue-500/40 transition-all'
                        : 'flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors'
                    }
                  >
                    <span className="text-sm shrink-0">{book.icon || '📁'}</span>
                    <span className="truncate flex-1">{book.title}</span>
                  </NavLink>
                ))}
              </div>
            )}

            <div className="pt-4 px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Management
            </div>

            {user?.is_admin ? (
              <NavLink to="/admin" className={navClass}>
                {({ isActive }) => (
                  <>
                    <svg
                      className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-cobalt transition-colors'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                      />
                    </svg>
                    <span className="flex-1">Admin &amp; Entities</span>
                    {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                  </>
                )}
              </NavLink>
            ) : (
              <NavLink
                to="/transactions"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors group"
              >
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-brand-cobalt transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
                <span className="flex-1">Invoices &amp; Entities</span>
              </NavLink>
            )}

            <NavLink to="/settings" className={navClass}>
              {({ isActive }) => (
                <>
                  <svg
                    className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                    <path
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                    />
                  </svg>
                  <span className="flex-1">Settings</span>
                  {isActive && <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>}
                </>
              )}
            </NavLink>
          </nav>

          <div className="p-4 border-t border-white/[0.06] bg-obsidian-950/40" data-purpose="workspace-switcher">
            <div className="p-3 rounded-xl bg-obsidian-850/80 border border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-violet to-brand-cobalt flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
                  {getInitials(user?.full_name, user?.email)}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-semibold text-white truncate">
                      {user?.full_name || 'Personal Portfolio'}
                    </p>
                    {user?.is_admin && (
                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-brand-violet/20 text-brand-violet border border-brand-violet/30">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-emerald font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse"></span> Active Vault
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                title="Sign Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <nav className="mobile-bottom-nav" data-purpose="mobile-bottom-nav">
        <NavLink to="/dashboard" className={mobileTabClass}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Overview</span>
        </NavLink>

        <NavLink to="/transactions" className={mobileTabClass}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Ledger</span>
        </NavLink>

        <NavLink to="/streams" className={mobileTabClass}>
          <Layers className="w-4 h-4" />
          <span>Streams</span>
        </NavLink>

        <NavLink to="/reports" className={mobileTabClass}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          <span>Reports</span>
        </NavLink>

        {user?.is_admin ? (
          <NavLink to="/admin" className={mobileTabClass}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Admin</span>
          </NavLink>
        ) : (
          <NavLink to="/settings" className={mobileTabClass}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <span>Settings</span>
          </NavLink>
        )}
      </nav>
    </>
  );
};

export default Sidebar;

import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { getAppropriateBookIcon } from '../utils/bookIcons';
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
    return 'AJ';
  };

  const navClass = ({ isActive }) =>
    isActive
      ? 'glacier-nav-active group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-cyan-500/15 backdrop-blur-md shadow-sm border border-cyan-400/30 text-cyan-200 font-medium text-sm transition-all duration-200'
      : 'group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent hover:border-white/10 text-sm font-medium transition-all';

  const streamNavClass = ({ isActive }) =>
    isActive
      ? 'glacier-nav-active group flex items-center justify-between px-3.5 py-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-sm font-medium transition-all'
      : 'group flex items-center justify-between px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.06] text-sm font-medium transition-all';

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
        } w-72 flex-shrink-0 h-full flex flex-col justify-between border-r border-white/[0.08] bg-[#0A1120]/70 backdrop-blur-2xl px-4 py-5 shadow-[4px_0_24px_rgba(0,0,0,0.4)] transition-all duration-300 hidden lg:flex sticky top-0 h-screen z-40 select-none overflow-hidden`}
        data-purpose="sidebar-navigation"
      >
        <div className="flex flex-col h-full overflow-hidden justify-between">
          <div className="space-y-6 overflow-y-auto pr-1">
            <div className="flex items-center justify-between px-2 py-1">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-400/40">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-wider text-white uppercase">
                    Finance Intel
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                    Enterprise Suite
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400 ring-2 ring-slate-900 shadow-[0_0_8px_#22d3ee]"></span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="mobile-drawer-close lg:hidden"
                  aria-label="Close navigation menu"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <nav className="space-y-1.5" data-purpose="primary-menu">
              <NavLink to="/dashboard" className={navClass}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <svg
                        className={`w-4 h-4 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                        } transition-colors`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <rect height="7" rx="1.5" width="7" x="3" y="3"></rect>
                        <rect height="7" rx="1.5" width="7" x="14" y="3"></rect>
                        <rect height="7" rx="1.5" width="7" x="14" y="14"></rect>
                        <rect height="7" rx="1.5" width="7" x="3" y="14"></rect>
                      </svg>
                      <span className="font-medium">Overview</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                    )}
                  </>
                )}
              </NavLink>

              <NavLink to="/transactions" className={navClass}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <svg
                        className={`w-4 h-4 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                        } transition-colors`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        ></path>
                      </svg>
                      <span className="font-medium">Transactions</span>
                    </div>
                    <span className="badge-counter text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 group-hover:border-cyan-500/30 transition-colors">
                      {txCount}
                    </span>
                  </>
                )}
              </NavLink>

              <NavLink to="/reports" className={navClass}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <svg
                        className={`w-4 h-4 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                        } transition-colors`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        ></path>
                      </svg>
                      <span className="font-medium">Reports &amp; P&amp;L</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                    )}
                  </>
                )}
              </NavLink>

              <NavLink to="/budgets" className={navClass}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <svg
                        className={`w-4 h-4 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                        } transition-colors`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        ></path>
                      </svg>
                      <span className="font-medium">Budgets &amp; Alerts</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                    )}
                  </>
                )}
              </NavLink>

              <NavLink to="/recurring" className={navClass}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <svg
                        className={`w-4 h-4 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                        } transition-colors`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        ></path>
                      </svg>
                      <span className="font-medium">Subscriptions &amp; Runway</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                    )}
                  </>
                )}
              </NavLink>

              <NavLink to="/categories" className={navClass}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <svg
                        className={`w-4 h-4 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                        } transition-colors`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M7 7h.01M7 3h10a2 2 0 012 2v14l-7-3-7 3V5a2 2 0 012-2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        ></path>
                      </svg>
                      <span className="font-medium">Categories</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                    )}
                  </>
                )}
              </NavLink>
            </nav>

            <div className="pt-4 border-t border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Active Streams</span>
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
                  className="btn-create-stream px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-cyan-300 text-[10px] font-bold border border-white/10 transition-all"
                  title="Create New Book"
                >
                  + New
                </button>
              </div>

              <NavLink to="/streams" end className={streamNavClass}>
                <div className="flex items-center space-x-2.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] shrink-0"></span>
                  <span className="truncate">All Stream Books</span>
                </div>
                <span className="badge-counter text-[11px] font-semibold text-slate-400 ml-2">
                  {streamBooks.length}
                </span>
              </NavLink>

              {streamBooks.map((book) => (
                <NavLink
                  key={book.id}
                  to={`/streams/${book.id}`}
                  className={streamNavClass}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <span className="material-symbols-outlined text-[16px] text-cyan-400 shrink-0">
                      {getAppropriateBookIcon(book.title, book.icon)}
                    </span>
                    <span className="truncate">{book.title}</span>
                  </div>
                </NavLink>
              ))}
            </div>

            <div className="pt-3 border-t border-white/[0.08] space-y-1">
              <div className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>System Config</span>
              </div>

              {user?.is_admin && (
                <NavLink to="/admin" className={navClass}>
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center space-x-3">
                        <svg
                          className={`w-4 h-4 ${
                            isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                          } transition-colors`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          ></path>
                        </svg>
                        <span className="font-medium">Admin &amp; Entities</span>
                      </div>
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                      )}
                    </>
                  )}
                </NavLink>
              )}

              <NavLink to="/settings" className={navClass}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <svg
                        className={`w-4 h-4 ${
                          isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'
                        } transition-colors`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        viewBox="0 0 24 24"
                      >
                        <path
                          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        ></path>
                      </svg>
                      <span className="font-medium">Settings &amp; Entities</span>
                    </div>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee]"></div>
                    )}
                  </>
                )}
              </NavLink>
            </div>
          </div>

          <div
            className="user-profile-box mt-4 p-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-glacier-sm flex items-center justify-between backdrop-blur-md"
            data-purpose="user-profile"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-[1.5px] shadow-sm shrink-0">
                <div className="user-profile-avatar-inner w-full h-full bg-[#0D1629] rounded-[10px] flex items-center justify-center font-bold text-xs text-cyan-300">
                  {getInitials(user?.full_name, user?.email)}
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-white leading-tight truncate">
                  {user?.full_name || 'Ajayraj'}
                </span>
                <div className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#10b981] shrink-0"></span>
                  <span className="text-[10px] font-medium text-slate-400 truncate">
                    Active Vault
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/[0.08] transition-colors shrink-0"
              title="Sign Out"
              type="button"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

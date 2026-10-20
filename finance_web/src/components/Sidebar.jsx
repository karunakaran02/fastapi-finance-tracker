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
    return 'KR';
  };

  const navClass = ({ isActive }) =>
    isActive
      ? 'group flex items-center justify-between px-3 py-2 rounded-lg bg-surface-container-high text-primary-fixed-dim font-bold border border-slate-800/80 shadow-[inset_2px_0_0_0_#00dfc1] transition-all'
      : 'group flex items-center justify-between px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all border border-transparent hover:border-slate-800/50';

  const streamNavClass = ({ isActive }) =>
    isActive
      ? 'group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-primary-fixed-dim font-semibold bg-surface-container-high/80 border border-slate-700/50 transition-all text-xs'
      : 'group flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all text-xs';

  const getNavIndicatorIndex = () => {
    const p = location.pathname;
    if (p === '/dashboard' || p === '/') return 0;
    if (p.startsWith('/transactions')) return 1;
    if (p.startsWith('/streams')) return 2;
    if (p.startsWith('/reports')) return 3;
    if (p.startsWith('/budgets')) return 4;
    return -1;
  };

  const activeNavIdx = getNavIndicatorIndex();

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
        } w-64 shrink-0 border-r border-slate-800/70 bg-surface-container-lowest/95 backdrop-blur-xl flex flex-col justify-between hidden lg:flex sticky top-0 h-screen z-40 select-none`}
        data-purpose="sidebar-navigation"
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/70 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex flex-col min-w-0">
                <span className="font-headline-sm text-sm tracking-tight text-on-surface font-bold leading-none truncate">
                  FINANCE INTEL
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-container opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-container"></span>
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

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" data-purpose="primary-navigation">
            <NavLink to="/dashboard" className={navClass}>
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[19px]">grid_view</span>
                    <span className="text-xs font-medium">Overview</span>
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-container"></span>}
                </>
              )}
            </NavLink>

            <NavLink to="/transactions" className={navClass}>
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[19px]">receipt_long</span>
                    <span className="text-xs font-medium">Transactions</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-full bg-surface-container-high text-secondary font-mono text-[10px] font-bold">
                    {txCount}
                  </span>
                </>
              )}
            </NavLink>

            <NavLink to="/reports" className={navClass}>
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[19px]">query_stats</span>
                    <span className="text-xs font-medium">Reports &amp; P&amp;L</span>
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-container"></span>}
                </>
              )}
            </NavLink>

            <NavLink to="/budgets" className={navClass}>
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[19px]">monitoring</span>
                    <span className="text-xs font-medium">Budgets &amp; Alerts</span>
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-container"></span>}
                </>
              )}
            </NavLink>

            <NavLink to="/recurring" className={navClass}>
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[19px]">calendar_clock</span>
                    <span className="text-xs font-medium">Subscriptions &amp; Runway</span>
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-container"></span>}
                </>
              )}
            </NavLink>

            <NavLink to="/categories" className={navClass}>
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[19px]">category</span>
                    <span className="text-xs font-medium">Categories</span>
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-container"></span>}
                </>
              )}
            </NavLink>

            <div className="pt-4 pb-1 px-2 flex items-center justify-between">
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider">
                Active Streams
              </span>
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
                className="text-[10px] text-primary-container hover:text-white font-bold px-1.5 py-0.5 rounded bg-primary-container/10 border border-primary-container/20 transition-colors"
                title="Create New Book"
              >
                + New
              </button>
            </div>

            <NavLink to="/streams" end className={streamNavClass}>
              <span className="material-symbols-outlined text-[17px] text-outline">sync_alt</span>
              <span className="truncate flex-1">All Stream Books</span>
              <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-secondary text-[10px] font-mono">
                {streamBooks.length}
              </span>
            </NavLink>

            {streamBooks.map((book) => (
              <NavLink
                key={book.id}
                to={`/streams/${book.id}`}
                className={streamNavClass}
              >
                <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">
                  {getAppropriateBookIcon(book.title, book.icon)}
                </span>
                <span className="truncate flex-1">{book.title}</span>
              </NavLink>
            ))}

            <div className="pt-4 pb-1 px-2">
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider">
                System Config
              </span>
            </div>

            {user?.is_admin && (
              <NavLink to="/admin" className={navClass}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[19px]">admin_panel_settings</span>
                      <span className="text-xs font-medium">Admin &amp; Entities</span>
                    </div>
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-container"></span>}
                  </>
                )}
              </NavLink>
            )}

            <NavLink to="/settings" className={navClass}>
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[19px]">tune</span>
                    <span className="text-xs font-medium">Settings &amp; Entities</span>
                  </div>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-primary-container"></span>}
                </>
              )}
            </NavLink>
          </nav>

          <div className="p-3 border-t border-slate-800/70 bg-surface-container-lowest shrink-0" data-purpose="workspace-switcher">
            <div className="p-2.5 rounded-xl bg-surface-container border border-slate-800/70 flex items-center justify-between hover:bg-surface-container-high transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary-container text-[18px]">person</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-label-md text-xs font-semibold text-on-surface truncate">
                    {user?.full_name || 'Karunakaran R'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-container"></span>
                    <span className="font-label-sm text-[10px] text-outline truncate">Active Vault</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-outline hover:text-on-surface transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <nav
        className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-[#090e1c]/95 backdrop-blur-2xl border-t border-white/5 lg:hidden"
        id="bottomNav"
        data-purpose="mobile-bottom-nav"
      >
        <div className="relative grid grid-cols-5 items-center h-16 max-w-lg mx-auto" id="navContainer">
          <div
            className={`morph-pill absolute bottom-1.5 h-1 w-8 rounded-full pointer-events-none transition-all duration-300 ease-out ${
              activeNavIdx >= 0 ? `pos-${activeNavIdx}` : ''
            }`}
          />

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `nav-tab flex flex-col items-center justify-center relative w-full h-14 rounded-xl spring-tactile transition-colors ${
                isActive ? 'text-primary-container font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">space_dashboard</span>
            <span className="font-label-sm text-[10px] tracking-wider mt-0.5">Overview</span>
          </NavLink>

          <NavLink
            to="/transactions"
            className={({ isActive }) =>
              `nav-tab flex flex-col items-center justify-center relative w-full h-14 rounded-xl spring-tactile transition-colors ${
                isActive ? 'text-primary-container font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
            <span className="font-label-sm text-[10px] tracking-wider mt-0.5">Ledger</span>
          </NavLink>

          <NavLink
            to="/streams"
            className={({ isActive }) =>
              `nav-tab flex flex-col items-center justify-center relative w-full h-14 rounded-xl spring-tactile transition-colors ${
                isActive ? 'text-primary-container font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">sync_alt</span>
            <span className="font-label-sm text-[10px] tracking-wider mt-0.5">Streams</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) =>
              `nav-tab flex flex-col items-center justify-center relative w-full h-14 rounded-xl spring-tactile transition-colors ${
                isActive ? 'text-primary-container font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">query_stats</span>
            <span className="font-label-sm text-[10px] tracking-wider mt-0.5">Reports</span>
          </NavLink>

          <NavLink
            to="/budgets"
            className={({ isActive }) =>
              `nav-tab flex flex-col items-center justify-center relative w-full h-14 rounded-xl spring-tactile transition-colors ${
                isActive ? 'text-primary-container font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">pie_chart</span>
            <span className="font-label-sm text-[10px] tracking-wider mt-0.5">Budgets</span>
          </NavLink>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;

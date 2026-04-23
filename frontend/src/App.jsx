import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  CalendarDays, Package, BarChart3, LogOut, Hotel, UserCircle, ShieldCheck,
  Building, Loader2, Menu, X, Terminal, CalendarRange, Building2, Wrench,
  ShieldX, ArrowLeft, ChevronRight, Sun, Moon
} from 'lucide-react';
import NotificationBell from './components/NotificationBell';
import SupportWidget from './components/SupportWidget';
import Login from './components/Login';
import BookingInflow from './components/BookingInflow';
import BookingCalendar from './components/BookingCalendar';
import Inventory from './components/Inventory';
import Summary from './components/Summary';
import AdminDashboard from './components/AdminDashboard';
import OwnerDashboard from './components/OwnerDashboard';
import DeveloperDashboard from './components/DeveloperDashboard';
import GuestPortal from './components/GuestPortal';
import IDUploadPage from './components/IDUploadPage';

const STAFF_PATHS = ['/login', '/admin', '/properties', '/inflow', '/calendar', '/inventory', '/summary', '/developer'];

// ── Theme context ─────────────────────────────────────────────────────────────
export const ThemeContext = createContext({ dark: false, toggle: () => {} });
const isStaffPath = () => STAFF_PATHS.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'));

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({ onLogout, user, isOpen, setIsOpen }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Admin Panel',    path: '/admin',      icon: ShieldCheck,   allowedRoles: ['SUPER_ADMIN'] },
    { name: 'My Properties',  path: '/properties', icon: Building,      allowedRoles: ['PROPERTY_OWNER'] },
    { name: 'Booking Inflow', path: '/inflow',     icon: CalendarDays,  allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Calendar View',  path: '/calendar',   icon: CalendarRange, allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Inventory',      path: '/inventory',  icon: Package,       allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Summary',        path: '/summary',    icon: BarChart3,     allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Dev Console',    path: '/developer',  icon: Terminal,      allowedRoles: ['DEVELOPER'] },
  ];

  const visible = navItems.filter(i => i.allowedRoles.includes(user?.role));

  const roleBadgeColor = {
    SUPER_ADMIN:     'bg-indigo-600',
    PROPERTY_OWNER:  'bg-emerald-600',
    HOTEL_MANAGER:   'bg-blue-600',
    DEVELOPER:       'bg-slate-700',
  }[user?.role] || 'bg-gray-600';

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold tracking-tight">StayLite</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-0.5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 mb-3">Navigation</p>
          {visible.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                {active && <ChevronRight className="w-3.5 h-3.5 text-blue-200" />}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-slate-800 shrink-0 space-y-1">
          <a
            href="/"
            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition"
          >
            <Hotel className="w-3.5 h-3.5" /> Guest Booking Portal
          </a>
          <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-800/60 rounded-lg">
            <div className={`w-7 h-7 rounded-lg ${roleBadgeColor} flex items-center justify-center shrink-0`}>
              <UserCircle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// ── Checkout beep hook ────────────────────────────────────────────────────────
function useCheckoutAlert(user) {
  const snoozedUntil = useRef(null);
  const [alert, setAlert] = useState(null);

  const check = useCallback(async () => {
    if (user?.role !== 'HOTEL_MANAGER') return;
    if (snoozedUntil.current && Date.now() < snoozedUntil.current) return;
    try {
      const res = await fetch('http://localhost:5000/api/support/checkout-alerts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('hotel_auth_token')}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.alerts?.length > 0) {
        setAlert({ count: data.alerts.length, guests: data.alerts.map(a => a.guestName) });
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const beep = (freq, start, dur) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.frequency.value = freq;
            g.gain.setValueAtTime(0.3, ctx.currentTime + start);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            o.start(ctx.currentTime + start);
            o.stop(ctx.currentTime + start + dur + 0.05);
          };
          beep(880, 0, 0.15); beep(660, 0.18, 0.15); beep(880, 0.36, 0.25);
        } catch { /* audio blocked */ }
      } else {
        setAlert(null);
      }
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'HOTEL_MANAGER') return;
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [check, user]);

  const dismiss = () => setAlert(null);
  const snooze  = () => { snoozedUntil.current = Date.now() + 30 * 60 * 1000; setAlert(null); };
  return { alert, dismiss, snooze };
}

// ── Checkout alert banner ─────────────────────────────────────────────────────
function CheckoutAlertBanner({ alert, onDismiss, onSnooze }) {
  if (!alert) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-500 text-white text-xs font-semibold shrink-0">
      <span className="text-sm">🔔</span>
      <span className="flex-1">
        {alert.count} guest{alert.count > 1 ? 's' : ''} checking out today:&nbsp;
        <span className="font-normal opacity-90">
          {alert.guests.slice(0, 3).join(', ')}{alert.count > 3 ? ` +${alert.count - 3} more` : ''}
        </span>
      </span>
      <button onClick={onSnooze} className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold transition">Snooze 30m</button>
      <button onClick={onDismiss} className="p-1 hover:bg-white/20 rounded transition"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
const Topbar = ({ user, onMenuClick }) => {
  const { dark, toggle } = useContext(ThemeContext);
  const lastLoginStr = user.lastLogin
    ? new Date(user.lastLogin).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 lg:hidden transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        {user.role === 'HOTEL_MANAGER' && user.assignedPropertyName && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
            {user.assignedPropertyName}
          </div>
        )}
        {user.role === 'PROPERTY_OWNER' && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
            {user.hotelCount ?? 0} Hotel{user.hotelCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBell user={user} />

        {/* Dark / Light mode toggle */}
        <button
          onClick={toggle}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={`p-2 rounded-xl transition-all duration-200 ${
            dark
              ? 'bg-slate-800 text-amber-400 hover:bg-slate-700 border border-slate-700'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border border-gray-200'
          }`}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-tight">{user.name}</p>
            {lastLoginStr && (
              <p className="text-[10px] text-gray-400 dark:text-slate-500 leading-tight">Last login: {lastLoginStr}</p>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>
    </header>
  );
};

// ── Staff Portal ──────────────────────────────────────────────────────────────
function StaffPortal({ user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { alert: checkoutAlert, dismiss, snooze } = useCheckoutAlert(user);

  return (
    <div className="flex bg-gray-50 dark:bg-slate-950 min-h-screen font-sans text-gray-900 dark:text-slate-100 transition-colors duration-200">
      <Sidebar onLogout={onLogout} user={user} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 h-screen">
        <Topbar user={user} onMenuClick={() => setIsSidebarOpen(true)} />
        <CheckoutAlertBanner alert={checkoutAlert} onDismiss={dismiss} onSnooze={snooze} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <Routes>
            {user.role === 'SUPER_ADMIN'    && <Route path="/admin"      element={<AdminDashboard />} />}
            {user.role === 'PROPERTY_OWNER' && <Route path="/properties" element={<OwnerDashboard user={user} />} />}
            {user.role === 'DEVELOPER'      && <Route path="/developer"  element={<DeveloperDashboard />} />}
            <Route path="/inflow"    element={<BookingInflow user={user} />} />
            <Route path="/calendar"  element={<BookingCalendar user={user} />} />
            <Route path="/inventory" element={<Inventory user={user} />} />
            <Route path="/summary"   element={<Summary user={user} />} />
            <Route path="*" element={<Navigate to={
              user.role === 'SUPER_ADMIN'    ? '/admin' :
              user.role === 'PROPERTY_OWNER' ? '/properties' :
              user.role === 'DEVELOPER'      ? '/developer' : '/inflow'
            } replace />} />
          </Routes>
        </main>
      </div>
      <SupportWidget user={user} />
    </div>
  );
}

// ── Suspended Overlay ─────────────────────────────────────────────────────────
function SuspendedOverlay({ reason, onBackToLogin }) {
  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-6 z-200">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldX className="w-9 h-9 text-red-400" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Session Terminated</h1>
          <p className="text-sm text-slate-400 mt-1">An administrator has suspended your account.</p>
        </div>
        <div className="bg-slate-900 border border-red-900/40 rounded-2xl p-5 text-left space-y-1.5">
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">Reason</p>
          <p className="text-sm text-slate-200 leading-relaxed">{reason || 'Contact the administrator for more information.'}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 text-sm">What can you do?</p>
          {[
            'Contact the administrator to appeal this decision.',
            'Your data is preserved — access can be restored at any time.',
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onBackToLogin}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </button>
        <p className="text-[10px] text-slate-700">StayLite · Hotel Management Platform</p>
      </div>
    </div>
  );
}

// ── Maintenance Screen ────────────────────────────────────────────────────────
function MaintenanceScreen({ info }) {
  const fmt = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
          <Wrench className="w-8 h-8 text-amber-400" style={{ animationDuration: '3s' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Under Maintenance</h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            {info?.message || 'The system is currently under scheduled maintenance.'}
          </p>
        </div>
        {(info?.scheduledStart || info?.scheduledEnd) && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs text-slate-400 space-y-1.5 text-left">
            {info.scheduledStart && (
              <div className="flex justify-between">
                <span>Started</span>
                <span className="text-amber-400 font-medium">{fmt(info.scheduledStart)}</span>
              </div>
            )}
            {info.scheduledEnd && (
              <div className="flex justify-between">
                <span>Expected back</span>
                <span className="text-green-400 font-semibold">{fmt(info.scheduledEnd)}</span>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-slate-600">We apologize for the inconvenience. Please check back soon.</p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]                   = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [maintenance, setMaintenance]     = useState(null);
  const [suspendedInfo, setSuspendedInfo] = useState(null);
  const [darkMode, setDarkMode]           = useState(() => localStorage.getItem('staylite_dark') === 'true');

  // Apply / remove dark class on <html> whenever darkMode changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('staylite_dark', String(darkMode));
  }, [darkMode]);

  const toggleDark = () => setDarkMode(d => !d);

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('hotel_refresh_token');
    if (refreshToken) {
      try {
        await fetch('http://localhost:5000/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
      } catch { /* silent */ }
    }
    localStorage.removeItem('hotel_auth_token');
    localStorage.removeItem('hotel_refresh_token');
    localStorage.removeItem('hotel_user_data');
    setUser(null);
    window.location.href = '/login';
  };

  // Restore session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token     = localStorage.getItem('hotel_auth_token');
      const savedUser = localStorage.getItem('hotel_user_data');
      if (!token || !savedUser) { setIsCheckingAuth(false); return; }
      try {
        const payload     = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const expiresInMs = payload.exp * 1000 - Date.now();
        const tenMin      = 10 * 60 * 1000;
        if (expiresInMs > tenMin) {
          setUser(JSON.parse(savedUser));
        } else {
          const rt = localStorage.getItem('hotel_refresh_token');
          if (!rt) { setIsCheckingAuth(false); return; }
          const res = await fetch('http://localhost:5000/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('hotel_auth_token', data.token);
            setUser(JSON.parse(savedUser));
          }
        }
      } catch { /* token malformed — clear silently */ }
      setIsCheckingAuth(false);
    };
    checkAuth();
  }, []);

  // Poll suspension status every 2 minutes
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      try {
        const token = localStorage.getItem('hotel_auth_token');
        if (!token) return;
        const res = await fetch('http://localhost:5000/api/auth/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 403) {
          const data = await res.json().catch(() => ({}));
          if (data.suspended) {
            localStorage.removeItem('hotel_auth_token');
            localStorage.removeItem('hotel_refresh_token');
            localStorage.removeItem('hotel_user_data');
            setUser(null);
            setSuspendedInfo({ reason: data.reason });
          }
        }
      } catch { /* silent */ }
    };
    const id = setInterval(check, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  // Poll maintenance status every 60s (staff paths only)
  useEffect(() => {
    if (!isStaffPath()) return;
    const checkMaintenance = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/maintenance-status');
        if (res.ok) setMaintenance(await res.json());
      } catch { /* silent */ }
    };
    checkMaintenance();
    const id = setInterval(checkMaintenance, 60000);
    return () => clearInterval(id);
  }, []);

  // Public guest portal
  if (!isStaffPath()) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/upload-id/:token" element={<IDUploadPage />} />
          <Route path="*" element={<GuestPortal />} />
        </Routes>
      </BrowserRouter>
    );
  }

  // Auth checking spinner
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 transition-colors duration-200">
        <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm font-medium">Loading platform…</span>
        </div>
      </div>
    );
  }

  // Suspended overlay
  if (suspendedInfo) {
    return (
      <SuspendedOverlay
        reason={suspendedInfo.reason}
        onBackToLogin={() => { setSuspendedInfo(null); window.location.href = '/login'; }}
      />
    );
  }

  if (!user) return <Login onLogin={setUser} maintenance={maintenance} />;

  // Maintenance screen for non-privileged users
  const isMaintenanceActive  = maintenance?.isActive;
  const canBypassMaintenance = user.role === 'DEVELOPER' || user.role === 'SUPER_ADMIN';
  if (isMaintenanceActive && !canBypassMaintenance) {
    return <MaintenanceScreen info={maintenance} />;
  }

  return (
    <ThemeContext.Provider value={{ dark: darkMode, toggle: toggleDark }}>
      <BrowserRouter>
        <StaffPortal user={user} onLogout={handleLogout} />
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}
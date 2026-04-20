import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { CalendarDays, Package, BarChart3, LogOut, Hotel, UserCircle, ShieldCheck, Building, Loader2, Menu, X, Terminal, CalendarRange, Building2, Wrench, ShieldX, ArrowLeft } from 'lucide-react';
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

// Staff-only paths — everything else renders the public guest portal
const STAFF_PATHS = ['/login', '/admin', '/properties', '/inflow', '/calendar', '/inventory', '/summary', '/developer'];
const isStaffPath = () => STAFF_PATHS.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'));

// --- SIDEBAR ---
const Sidebar = ({ onLogout, user, isOpen, setIsOpen }) => {
  const location = useLocation();

  const navItems = [
    { name: 'Admin Panel',    path: '/admin',      icon: ShieldCheck, allowedRoles: ['SUPER_ADMIN'] },
    { name: 'My Properties',  path: '/properties', icon: Building,    allowedRoles: ['PROPERTY_OWNER'] },
    { name: 'Booking Inflow', path: '/inflow',     icon: CalendarDays, allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Calendar View',  path: '/calendar',   icon: CalendarRange,allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Inventory',      path: '/inventory',  icon: Package,      allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Summary',        path: '/summary',    icon: BarChart3,   allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Dev Console',    path: '/developer',  icon: Terminal,    allowedRoles: ['DEVELOPER'] },
  ];

  const visible = navItems.filter(i => i.allowedRoles.includes(user?.role));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      )}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center">
            <Hotel className="w-6 h-6 text-blue-600 mr-3" />
            <span className="text-lg font-bold tracking-tight text-gray-900">HotelAdmin</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link key={item.name} to={item.path} onClick={() => setIsOpen(false)}
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900'}`}>
                <Icon className={`w-5 h-5 mr-3 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 shrink-0">
          <a href="/" className="flex items-center justify-center w-full px-4 py-2 mb-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200">
            <Hotel className="w-3.5 h-3.5 mr-1.5" /> Guest Booking Portal
          </a>
          <button onClick={onLogout} className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </button>
        </div>
      </div>
    </>
  );
};

// --- CHECKOUT BEEP HOOK (manager only, browser Web Audio API) ---------------
function useCheckoutAlert(user) {
  const snoozedUntil = useRef(null);
  const [alert, setAlert] = useState(null); // { count, guests }

  const check = useCallback(async () => {
    if (user?.role !== 'HOTEL_MANAGER') return;
    if (snoozedUntil.current && Date.now() < snoozedUntil.current) return;
    try {
      const res = await fetch('http://localhost:5000/api/support/checkout-alerts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('hotel_auth_token')}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.alerts?.length > 0) {
        setAlert({ count: data.alerts.length, guests: data.alerts.map(a => a.guestName) });
        // Web Audio API beep — no library needed
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
          beep(880, 0,    0.15);
          beep(660, 0.18, 0.15);
          beep(880, 0.36, 0.25);
        } catch { /* audio blocked — banner still shows */ }
      } else {
        setAlert(null);
      }
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'HOTEL_MANAGER') return;
    check();
    const id = setInterval(check, 5 * 60 * 1000); // every 5 minutes
    return () => clearInterval(id);
  }, [check, user]);

  const dismiss  = () => setAlert(null);
  const snooze   = () => { snoozedUntil.current = Date.now() + 30 * 60 * 1000; setAlert(null); };

  return { alert, dismiss, snooze };
}

// --- CHECKOUT ALERT BANNER ---------------------------------------------------
function CheckoutAlertBanner({ alert, onDismiss, onSnooze }) {
  if (!alert) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-500 text-white text-xs font-bold animate-pulse shrink-0">
      <span className="text-base">🔔</span>
      <span className="flex-1">
        {alert.count} guest{alert.count > 1 ? 's' : ''} checking out today:&nbsp;
        <span className="font-normal opacity-90">{alert.guests.slice(0, 3).join(', ')}{alert.count > 3 ? ` +${alert.count - 3} more` : ''}</span>
      </span>
      <button onClick={onSnooze} className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold transition">Snooze 30m</button>
      <button onClick={onDismiss} className="p-1 hover:bg-white/20 rounded transition"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// --- TOPBAR ------------------------------------------------------------------
const Topbar = ({ user, onMenuClick }) => {
  const lastLoginStr = user.lastLogin
    ? new Date(user.lastLogin).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden transition-colors">
          <Menu className="w-5 h-5" />
        </button>

        {/* Role badge */}
        <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-bold text-[10px] uppercase tracking-wider hidden sm:inline">
          {user.role.replace(/_/g, ' ')}
        </span>

        {/* Hotel name for managers */}
        {user.role === 'HOTEL_MANAGER' && user.assignedPropertyName && (
          <div className="hidden sm:flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-bold text-gray-700">{user.assignedPropertyName}</span>
          </div>
        )}

        {/* Hotels count for owners */}
        {user.role === 'PROPERTY_OWNER' && (
          <div className="hidden sm:flex items-center gap-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-bold text-gray-700">{user.hotelCount ?? 0} Hotel{user.hotelCount !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Notification bell */}
        <NotificationBell user={user} />

        {/* User info */}
        <div className="group relative flex items-center gap-2 cursor-default">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-gray-900 leading-tight">{user.name}</div>
            {lastLoginStr && (
              <div className="text-[10px] text-gray-400 leading-tight">Last login: {lastLoginStr}</div>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
            <UserCircle className="w-5 h-5" />
          </div>
        </div>
      </div>
    </header>
  );
};

// --- STAFF PORTAL (authenticated) ---
function StaffPortal({ user, onLogout }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { alert: checkoutAlert, dismiss, snooze } = useCheckoutAlert(user);

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans text-gray-900 overflow-hidden">
      <Sidebar onLogout={onLogout} user={user} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 h-screen">
        <Topbar user={user} onMenuClick={() => setIsSidebarOpen(true)} />
        <CheckoutAlertBanner alert={checkoutAlert} onDismiss={dismiss} onSnooze={snooze} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50">
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
      {/* Floating support button — available on all staff pages */}
      <SupportWidget user={user} />
    </div>
  );
}

// --- SUSPENDED OVERLAY (shown when an active session is suspended) -----------
function SuspendedOverlay({ reason, onBackToLogin }) {
  return (
    <div className="fixed inset-0 bg-gray-950 flex items-center justify-center p-6 z-200">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-red-500" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white tracking-tight">Account Suspended</h1>
          <p className="text-sm text-gray-400">Your session has been terminated by an administrator.</p>
        </div>
        <div className="bg-gray-900 border border-red-900/60 rounded-2xl p-5 text-left space-y-2">
          <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Reason</div>
          <p className="text-sm text-gray-200 leading-relaxed">{reason || 'Contact the administrator for more information.'}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-1 text-xs text-gray-400">
          <div className="font-semibold text-gray-300 mb-2">What can you do?</div>
          <div className="flex items-start gap-2">
            <span className="text-gray-600 mt-0.5">→</span>
            <span>Contact the administrator or developer team to appeal this decision.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-600 mt-0.5">→</span>
            <span>Your data is preserved — access can be restored at any time.</span>
          </div>
        </div>
        <button
          onClick={onBackToLogin}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Login
        </button>
        <p className="text-[10px] text-gray-700">StayLite · Powered by the dev team</p>
      </div>
    </div>
  );
}

// --- MAINTENANCE OVERLAY ---
function MaintenanceScreen({ info }) {
  const fmt = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
          <Wrench className="w-10 h-10 text-yellow-400 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white mb-2">Under Maintenance</h1>
          <p className="text-gray-400 text-sm leading-relaxed">{info?.message || 'System is currently under scheduled maintenance.'}</p>
        </div>
        {(info?.scheduledStart || info?.scheduledEnd) && (
          <div className="bg-gray-800 rounded-xl p-4 text-xs text-gray-400 space-y-1">
            {info.scheduledStart && <div>Started: <span className="text-yellow-400 font-medium">{fmt(info.scheduledStart)}</span></div>}
            {info.scheduledEnd   && <div>Expected back: <span className="text-green-400 font-bold">{fmt(info.scheduledEnd)}</span></div>}
          </div>
        )}
        <p className="text-xs text-gray-600">Please check back soon. We apologize for the inconvenience.</p>
      </div>
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const [user, setUser]               = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [maintenance, setMaintenance] = useState(null); // null = not checked, { isActive, message, ... }
  const [suspendedInfo, setSuspendedInfo] = useState(null); // null | { reason }

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('hotel_refresh_token');
    if (refreshToken) {
      try {
        await fetch('http://localhost:5000/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      } catch { /* silent */ }
    }
    localStorage.removeItem('hotel_auth_token');
    localStorage.removeItem('hotel_refresh_token');
    localStorage.removeItem('hotel_user_data');
    setUser(null);
    window.location.href = '/login';
  };

  useEffect(() => {
    const checkAuth = async () => {
      const token     = localStorage.getItem('hotel_auth_token');
      const savedUser = localStorage.getItem('hotel_user_data');
      if (!token || !savedUser) { setIsCheckingAuth(false); return; }

      try {
        const payload     = JSON.parse(atob(token.split('.')[1]));
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
            body: JSON.stringify({ refreshToken: rt })
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

  // Poll suspension status every 2 minutes while a user is logged in
  useEffect(() => {
    if (!user) return;
    const checkSuspension = async () => {
      try {
        const token = localStorage.getItem('hotel_auth_token');
        if (!token) return;
        const res = await fetch('http://localhost:5000/api/auth/status', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 403) {
          const data = await res.json();
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
    const id = setInterval(checkSuspension, 2 * 60 * 1000); // every 2 minutes
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

  // Non-staff paths → public guest portal (no auth needed)
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

  // Staff paths below
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
        <p className="text-gray-500 font-medium">Loading Platform...</p>
      </div>
    );
  }

  if (suspendedInfo) {
    return (
      <SuspendedOverlay
        reason={suspendedInfo.reason}
        onBackToLogin={() => { setSuspendedInfo(null); window.location.href = '/login'; }}
      />
    );
  }

  if (!user) return <Login onLogin={setUser} maintenance={maintenance} />;

  // Show maintenance screen for non-privileged users when maintenance is active
  const isMaintenanceActive = maintenance?.isActive;
  const canBypassMaintenance = user.role === 'DEVELOPER' || user.role === 'SUPER_ADMIN';
  if (isMaintenanceActive && !canBypassMaintenance) {
    return <MaintenanceScreen info={maintenance} />;
  }

  return (
    <BrowserRouter>
      <StaffPortal user={user} onLogout={handleLogout} />
    </BrowserRouter>
  );
}

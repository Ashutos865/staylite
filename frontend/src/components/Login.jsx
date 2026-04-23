import { useState } from 'react';
import { Lock, Mail, Loader2, Wrench, ShieldX, ArrowLeft, Hotel, Eye, EyeOff, ChevronDown } from 'lucide-react';

// ── Suspended Screen ──────────────────────────────────────────────────────────
function SuspendedScreen({ message, onBack }) {
  const reason = message?.replace(/^Account suspended\.\s*/i, '') || 'Contact the administrator for more information.';
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <ShieldX className="w-9 h-9 text-red-400" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Account Suspended</h1>
          <p className="text-sm text-slate-400 mt-1">Your access to StayLite has been revoked.</p>
        </div>
        <div className="bg-slate-900 border border-red-900/40 rounded-2xl p-5 text-left space-y-1.5">
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest">Reason</p>
          <p className="text-sm text-slate-200 leading-relaxed">{reason}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-400">
          <p className="font-semibold text-slate-300 text-sm">What can you do?</p>
          {[
            'Contact the administrator to appeal this decision.',
            'Your data is preserved — access can be restored at any time.',
            'Use the support system once access is restored.',
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-slate-600 mt-0.5">•</span>
              <span>{t}</span>
            </div>
          ))}
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Try a different account
        </button>
        <p className="text-[10px] text-slate-700">StayLite · Hotel Management Platform</p>
      </div>
    </div>
  );
}

// ── Main Login ─────────────────────────────────────────────────────────────────
export default function Login({ onLogin, maintenance }) {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suspended, setSuspended] = useState(null);
  const [showDev, setShowDev]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('hotel_auth_token', data.token);
        if (data.refreshToken) localStorage.setItem('hotel_refresh_token', data.refreshToken);
        localStorage.setItem('hotel_user_data', JSON.stringify(data.user));
        onLogin(data.user);
      } else if (response.status === 403) {
        setSuspended({ message: data.message });
      } else {
        setError(data.message || 'Authentication failed. Please try again.');
      }
    } catch {
      setError('Cannot connect to server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  if (suspended) {
    return (
      <SuspendedScreen
        message={suspended.message}
        onBack={() => { setSuspended(null); setPassword(''); setError(''); }}
      />
    );
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-16 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Hotel className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">StayLite</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <p className="text-blue-400 text-xs font-semibold uppercase tracking-widest">Hotel Management Platform</p>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Manage your<br />
              properties with<br />
              <span className="text-blue-400">precision.</span>
            </h1>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
            Streamline bookings, track inventory, manage staff, and grow your hospitality business — all in one place.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['Real-time Bookings', 'Multi-property', 'Staff Management', 'Financial Reports'].map(f => (
              <span key={f} className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-full">{f}</span>
            ))}
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="text-slate-600 text-xs relative z-10">© 2025 StayLite · All rights reserved</p>
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-sm space-y-7">

          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Hotel className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-base tracking-tight">StayLite</span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Welcome back</h2>
            <p className="text-sm text-gray-500">Sign in to your account to continue</p>
          </div>

          {/* Maintenance banner */}
          {maintenance?.isActive && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <Wrench className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-amber-800">Maintenance in Progress</p>
                <p className="text-xs text-amber-700">{maintenance.message}</p>
                {maintenance.scheduledEnd && (
                  <p className="text-[11px] text-amber-600">
                    Expected back: {new Date(maintenance.scheduledEnd).toLocaleString('en-IN')}
                  </p>
                )}
                <p className="text-[10px] text-amber-500 mt-1">Developer &amp; Admin accounts can still sign in.</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </button>
          </form>

          {/* Dev accounts (collapsible) */}
          <div className="border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={() => setShowDev(v => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDev ? 'rotate-180' : ''}`} />
              Demo credentials
            </button>
            {showDev && (
              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest mb-2">Password for all: <span className="font-mono">password</span></p>
                {[
                  { role: 'Admin', email: 'admin@ties.com', color: 'text-indigo-600 bg-indigo-50' },
                  { role: 'Owner', email: 'owner@hotel.com', color: 'text-emerald-600 bg-emerald-50' },
                  { role: 'Manager', email: 'manager@hotel.com', color: 'text-blue-600 bg-blue-50' },
                ].map(({ role, email: e, color }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => { setEmail(e); setPassword('password'); }}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/30 transition group"
                  >
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${color}`}>{role}</span>
                    <span className="text-xs font-mono text-gray-500 group-hover:text-blue-600 transition">{e}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
import { useState } from 'react';
import { Hotel, Lock, Mail, Loader2, Wrench, ShieldX, ArrowLeft } from 'lucide-react';

// ── Account Suspended Screen ─────────────────────────────────────────────────
function SuspendedScreen({ message, onBack }) {
  // Pull out just the reason (strip the "Account suspended." prefix if present)
  const reason = message?.replace(/^Account suspended\.\s*/i, '') || 'Contact the administrator for more information.';

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-red-500" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white tracking-tight">Account Suspended</h1>
          <p className="text-sm text-gray-400">Your access to StayLite has been suspended.</p>
        </div>

        {/* Reason card */}
        <div className="bg-gray-900 border border-red-900/60 rounded-2xl p-5 text-left space-y-2">
          <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Reason</div>
          <p className="text-sm text-gray-200 leading-relaxed">{reason}</p>
        </div>

        {/* Info */}
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
          <div className="flex items-start gap-2">
            <span className="text-gray-600 mt-0.5">→</span>
            <span>Use the support ticket system once access is restored to follow up.</span>
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" /> Try a different account
        </button>

        <p className="text-[10px] text-gray-700">StayLite · Powered by the dev team</p>
      </div>
    </div>
  );
}

// ── Main Login Component ─────────────────────────────────────────────────────
export default function Login({ onLogin, maintenance }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suspended, setSuspended] = useState(null); // null | { message }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('hotel_auth_token', data.token);
        if (data.refreshToken) localStorage.setItem('hotel_refresh_token', data.refreshToken);
        localStorage.setItem('hotel_user_data', JSON.stringify(data.user));
        onLogin(data.user);
      } else if (response.status === 403) {
        // Account suspended — show dedicated screen
        setSuspended({ message: data.message });
      } else {
        setError(data.message);
      }
    } catch {
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  // Show suspension screen instead of login form
  if (suspended) {
    return (
      <SuspendedScreen
        message={suspended.message}
        onBack={() => { setSuspended(null); setPassword(''); setError(''); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600"><Hotel className="w-12 h-12" /></div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Platform Access</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>

            {/* Maintenance banner */}
            {maintenance?.isActive && (
              <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-md text-xs">
                <Wrench className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" />
                <div>
                  <div className="font-bold mb-0.5">Maintenance Mode Active</div>
                  <div>{maintenance.message}</div>
                  {maintenance.scheduledEnd && (
                    <div className="mt-0.5 text-yellow-600">
                      Expected back: {new Date(maintenance.scheduledEnd).toLocaleString('en-IN')}
                    </div>
                  )}
                  <div className="mt-1 text-yellow-500 text-[10px]">Developer &amp; Admin accounts can still sign in.</div>
                </div>
              </div>
            )}

            {/* General error */}
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-center">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email" required
                  className="block w-full pl-10 border border-gray-300 rounded-md py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password" required
                  className="block w-full pl-10 border border-gray-300 rounded-md py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit" disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70 transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Secure Sign In'}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500 font-semibold mb-2">Test Accounts (Password: password)</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>Admin: <span className="font-mono bg-gray-100 px-1">admin@ties.com</span></li>
              <li>Owner: <span className="font-mono bg-gray-100 px-1">owner@hotel.com</span></li>
              <li>Manager: <span className="font-mono bg-gray-100 px-1">manager@hotel.com</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

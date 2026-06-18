import { useState, useEffect } from 'react';
import { Mail, Phone, Loader2, CheckCircle2, ArrowRight, Hotel, RefreshCw, LogOut, ShieldCheck } from 'lucide-react';
import { getToken } from '../utils/api';

const API = '/api/auth/verify-account';

export default function AccountVerification({ user, onVerified, onLogout }) {
  // step: 'EMAIL_SEND' | 'EMAIL_VERIFY' | 'PHONE_SEND' | 'PHONE_VERIFY' | 'DONE'
  const [step, setStep]       = useState('EMAIL_SEND');
  const [emailCode, setEmailCode] = useState('');
  const [phone, setPhone]     = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = () => {
    setCooldown(60);
    const t = setInterval(() => setCooldown(v => { if (v <= 1) { clearInterval(t); return 0; } return v - 1; }), 1000);
  };

  const authHeader = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` });

  // Auto-send email OTP on mount
  useEffect(() => {
    sendEmailOtp();
  }, []);

  const sendEmailOtp = async () => {
    setLoading(true); setError(''); setInfo('');
    try {
      const res = await fetch(`${API}/email/send`, { method: 'POST', headers: authHeader() });
      const d = await res.json();
      if (res.ok) { setInfo(d.message); setStep('EMAIL_VERIFY'); startCooldown(); }
      else setError(d.message || 'Failed to send OTP.');
    } catch { setError('Cannot connect to server.'); }
    finally { setLoading(false); }
  };

  const verifyEmail = async () => {
    if (emailCode.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/email/verify`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ code: emailCode })
      });
      const d = await res.json();
      if (res.ok) { setStep('PHONE_SEND'); setError(''); }
      else setError(d.message || 'Invalid OTP.');
    } catch { setError('Cannot connect to server.'); }
    finally { setLoading(false); }
  };

  const sendPhoneOtp = async () => {
    if (!phone.trim()) { setError('Enter your phone number.'); return; }
    setLoading(true); setError(''); setInfo('');
    try {
      const res = await fetch(`${API}/phone/send`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ phone: phone.trim() })
      });
      const d = await res.json();
      if (res.ok) { setInfo(d.message); setStep('PHONE_VERIFY'); startCooldown(); }
      else setError(d.message || 'Failed to send OTP.');
    } catch { setError('Cannot connect to server.'); }
    finally { setLoading(false); }
  };

  const verifyPhone = async () => {
    if (phoneCode.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/phone/verify`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ phone: phone.trim(), code: phoneCode })
      });
      const d = await res.json();
      if (res.ok) { setStep('DONE'); }
      else setError(d.message || 'Invalid OTP.');
    } catch { setError('Cannot connect to server.'); }
    finally { setLoading(false); }
  };

  const stepNum   = step === 'EMAIL_SEND' || step === 'EMAIL_VERIFY' ? 1 : step === 'DONE' ? 3 : 2;
  const emailDone = stepNum >= 2;
  const phoneDone = step === 'DONE';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">

      {/* Header */}
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Hotel className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-base tracking-tight">StayLite</span>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition">
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* Top banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="w-5 h-5 opacity-80" />
            <h1 className="text-lg font-bold">Account Setup Required</h1>
          </div>
          <p className="text-sm text-blue-100">Hi {user.name}, verify your identity to activate your account.</p>
        </div>

        {/* Progress steps */}
        <div className="flex border-b border-gray-100">
          {[
            { n: 1, label: 'Email', done: emailDone },
            { n: 2, label: 'Phone', done: phoneDone },
          ].map(({ n, label, done }) => (
            <div key={n} className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-colors ${
              stepNum === n ? 'border-blue-600 text-blue-600' :
              done ? 'border-green-500 text-green-600' :
              'border-transparent text-gray-400'
            }`}>
              {done
                ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${stepNum === n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{n}</span>
              }
              {label}
            </div>
          ))}
        </div>

        <div className="p-6 space-y-5">

          {/* Error / Info */}
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">{error}</div>}
          {info && !error && <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-sm">{info}</div>}

          {/* ── STEP 1: Email OTP ─────────────────────────────────── */}
          {(step === 'EMAIL_SEND' || step === 'EMAIL_VERIFY') && (
            <>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Verify your email</p>
                  <p className="text-xs text-gray-500 mt-0.5">OTP sent to <strong>{user.email}</strong></p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-700">6-digit OTP</label>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={emailCode}
                  onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="— — — — — —"
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  onKeyDown={e => e.key === 'Enter' && emailCode.length === 6 && verifyEmail()}
                />
              </div>

              <button onClick={verifyEmail} disabled={loading || emailCode.length !== 6}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify Email <ArrowRight className="w-4 h-4" /></>}
              </button>

              <div className="text-center">
                {cooldown > 0
                  ? <p className="text-xs text-gray-400">Resend in {cooldown}s</p>
                  : <button onClick={() => { setEmailCode(''); setError(''); sendEmailOtp(); }}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mx-auto">
                      <RefreshCw className="w-3 h-3" /> Resend OTP
                    </button>
                }
              </div>
            </>
          )}

          {/* ── STEP 2: Phone OTP ─────────────────────────────────── */}
          {(step === 'PHONE_SEND' || step === 'PHONE_VERIFY') && (
            <>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Verify your phone number</p>
                  <p className="text-xs text-gray-500 mt-0.5">We'll send an OTP via SMS</p>
                </div>
              </div>

              {step === 'PHONE_SEND' && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">Phone number (with country code)</label>
                    <input
                      type="tel" value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      onKeyDown={e => e.key === 'Enter' && phone && sendPhoneOtp()}
                    />
                  </div>
                  <button onClick={sendPhoneOtp} disabled={loading || !phone.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send OTP <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </>
              )}

              {step === 'PHONE_VERIFY' && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700">6-digit OTP sent to {phone}</label>
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={phoneCode}
                      onChange={e => setPhoneCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="— — — — — —"
                      className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      onKeyDown={e => e.key === 'Enter' && phoneCode.length === 6 && verifyPhone()}
                    />
                  </div>
                  <button onClick={verifyPhone} disabled={loading || phoneCode.length !== 6}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Activate Account <ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <div className="text-center">
                    {cooldown > 0
                      ? <p className="text-xs text-gray-400">Resend in {cooldown}s</p>
                      : <button onClick={() => { setPhoneCode(''); setError(''); setStep('PHONE_SEND'); }}
                          className="text-xs text-indigo-600 hover:underline">Change number / Resend</button>
                    }
                  </div>
                </>
              )}
            </>
          )}

          {/* ── DONE ──────────────────────────────────────────────── */}
          {step === 'DONE' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 bg-green-50 border-2 border-green-200 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Account Activated!</h2>
                <p className="text-sm text-gray-500 mt-1">Your identity is verified. Welcome to StayLite.</p>
              </div>
              <button
                onClick={() => onVerified({ ...user, isVerified: true, phone })}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition"
              >
                Enter Dashboard
              </button>
            </div>
          )}

        </div>
      </div>

      <p className="text-xs text-gray-400 mt-6">Having trouble? Contact your administrator.</p>
    </div>
  );
}

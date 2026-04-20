import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, X, Send, ChevronDown, CheckCheck, Loader2, Clock, RotateCcw,
  AlertTriangle, PartyPopper, IndianRupee, ClipboardList,
  Megaphone, Wrench, CheckCircle, Zap, Star, MessageSquare, CalendarDays
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const tok = () => localStorage.getItem('hotel_auth_token');
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` });

// ── Template definitions ─────────────────────────────────────────────────────
const TEMPLATES = {
  SUPER_ADMIN: [
    { id: 'PAY_BILL',       icon: IndianRupee, label: 'Pay Bill',       color: 'text-red-600',    title: '💰 Payment Due',               message: 'Your subscription invoice is overdue. Please clear the dues to continue uninterrupted service.' },
    { id: 'CONGRATS',       icon: PartyPopper, label: 'Congrats',       color: 'text-yellow-600', title: '🎉 Congratulations!',           message: 'Your hotel is performing exceptionally well. Keep up the great work!' },
    { id: 'WARNING',        icon: AlertTriangle,label:'Warning',        color: 'text-orange-600', title: '⚠️ Account Warning',            message: 'We noticed a policy violation in your account. Please review our terms of service.' },
    { id: 'ACCOUNT_REVIEW', icon: ClipboardList,label:'Account Review', color: 'text-blue-600',   title: '📋 Account Under Review',       message: 'Your account is currently under review. Our team will contact you within 24 hours.' },
    { id: 'CUSTOM',         icon: MessageSquare,label:'Custom',         color: 'text-gray-600',   title: '',                              message: '' },
  ],
  PROPERTY_OWNER: [
    { id: 'TASK_ASSIGN',    icon: ClipboardList,label:'Task',           color: 'text-blue-600',   title: '📋 New Task Assigned',          message: 'Please ensure all rooms are cleaned and prepared for today\'s check-ins.' },
    { id: 'DAILY_BRIEFING', icon: Megaphone,   label: 'Briefing',      color: 'text-indigo-600', title: '📢 Daily Briefing',             message: 'Good morning! Please review today\'s arrivals and departures before your shift.' },
    { id: 'SHIFT_ALERT',    icon: Zap,         label: 'Shift Alert',   color: 'text-yellow-600', title: '⚡ Shift Alert',                message: 'Urgent: Please call the front desk immediately. Guest assistance required.' },
    { id: 'WELL_DONE',      icon: Star,        label: 'Well Done',     color: 'text-green-600',  title: '⭐ Great Work!',                message: 'Excellent performance this month! Your dedication is truly appreciated.' },
    { id: 'CUSTOM',         icon: MessageSquare,label:'Custom',        color: 'text-gray-600',   title: '',                              message: '' },
  ],
  DEVELOPER: [
    { id: 'MAINTENANCE',    icon: Wrench,      label: 'Maintenance',   color: 'text-orange-600', title: '🔧 Scheduled Maintenance',      message: 'System maintenance is scheduled tonight from 2:00 AM – 4:00 AM. Expect brief downtime.' },
    { id: 'SYSTEM_UPDATE',  icon: Zap,         label: 'Update',        color: 'text-blue-600',   title: '🚀 System Updated',             message: 'A new version has been deployed. New features and bug fixes are now live.' },
    { id: 'RESOLVED',       icon: CheckCircle, label: 'Resolved',      color: 'text-green-600',  title: '✅ Issue Resolved',             message: 'The technical issue you reported has been resolved. Everything is back to normal.' },
    { id: 'CUSTOM',         icon: MessageSquare,label:'Custom',        color: 'text-gray-600',   title: '',                              message: '' },
  ]
};

const PRIORITY_STYLE = {
  NORMAL:    'bg-gray-100 text-gray-700',
  IMPORTANT: 'bg-blue-100 text-blue-700',
  URGENT:    'bg-red-100 text-red-700'
};

const ANIM_STYLE = {
  SLIDE:    'animate-slide-in',
  BOUNCE:   'animate-bounce-in',
  CONFETTI: 'animate-confetti',
  SHAKE:    'animate-shake',
  GLOW:     'animate-glow'
};

// ── URGENT modal overlay ─────────────────────────────────────────────────────
function UrgentModal({ notif, onClose }) {
  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      style={{ animation: 'notifIn 0.3s ease-out' }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-white" style={{ animation: 'bellPulse 0.8s ease-in-out 3' }} />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-red-100 uppercase tracking-wider">🚨 Urgent Message</div>
            <div className="text-white font-black text-base leading-tight">{notif.title}</div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">{notif.message}</p>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>From: <span className="font-semibold text-gray-600">{notif.fromUser?.name || 'System'}</span></span>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">URGENT</span>
          </div>
          <button onClick={onClose} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition">
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Animated notification toast (top-right corner) ───────────────────────────
function NotifToast({ notif, onClose }) {
  const bg = notif.priority === 'IMPORTANT' ? 'bg-blue-600' : 'bg-gray-900';
  return (
    <div className={`fixed top-5 right-5 z-100 max-w-sm w-full shadow-2xl rounded-2xl overflow-hidden ${bg} text-white`}
      style={{ animation: `notifIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275)` }}>
      <div className="flex items-start p-4 gap-3">
        <Bell className="w-5 h-5 shrink-0 mt-0.5 opacity-80" />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{notif.title}</div>
          <div className="text-xs opacity-80 mt-0.5 line-clamp-2">{notif.message}</div>
          <div className="text-[10px] opacity-60 mt-1">from {notif.fromUser?.name || 'System'}</div>
        </div>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 shrink-0"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Main Bell component ──────────────────────────────────────────────────────
export default function NotificationBell({ user }) {
  const [open, setOpen]           = useState(false);
  const [composing, setComposing] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]       = useState(0);
  const [toast, setToast]         = useState(null);
  const [urgentModal, setUrgentModal] = useState(null);
  const [targets, setTargets]     = useState({ users: [], properties: [] });
  const [sending, setSending]     = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);

  const templates = TEMPLATES[user.role] || [];
  const [form, setForm] = useState({
    template: templates[0]?.id || 'CUSTOM',
    title: templates[0]?.title || '',
    message: templates[0]?.message || '',
    priority: 'NORMAL',
    animation: 'SLIDE',
    toUser: '',
    toRole: '',
    toProperty: '',
    scheduledFor: '',
    repeatGapHours: '',
    repeatPerDay: '',
    repeatTillDate: '',
  });

  const panelRef = useRef(null);
  const prevUnread = useRef(0);
  const autoShownIds = useRef(new Set());

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notifications/inbox`, { headers: { Authorization: `Bearer ${tok()}` } });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnread(data.unreadCount);

      // Show popup for new unread notifications
      const newUnread = data.notifications.filter(n => !n.isRead && !autoShownIds.current.has(n._id));
      if (newUnread.length > 0) {
        const newest = newUnread[0];
        autoShownIds.current.add(newest._id);
        if (newest.priority === 'URGENT') {
          setUrgentModal(newest); // full-screen modal
        } else {
          setToast(newest);
          setTimeout(() => setToast(null), 6000);
        }
      }
      prevUnread.current = data.unreadCount;
    } catch { /* silent */ }
  }, []);

  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch(`${API}/notifications/targets`, { headers: { Authorization: `Bearer ${tok()}` } });
      if (res.ok) setTargets(await res.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchInbox();
    const id = setInterval(fetchInbox, 15000); // poll every 15s for near-real-time delivery
    return () => clearInterval(id);
  }, [fetchInbox]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyTemplate = (templateId) => {
    const t = templates.find(t => t.id === templateId);
    setForm(f => ({ ...f, template: templateId, title: t?.title || '', message: t?.message || '' }));
  };

  const markAllRead = async () => {
    await fetch(`${API}/notifications/read-all`, { method: 'POST', headers: hdrs() });
    setNotifications([]);  // backend clears all for this user
    setUnread(0);
  };

  // Marks read + clears from inbox immediately (backend adds to clearedBy)
  const markRead = async (id) => {
    await fetch(`${API}/notifications/${id}/read`, { method: 'POST', headers: hdrs() });
    setNotifications(n => n.filter(x => x._id !== id));
    setUnread(u => Math.max(0, u - 1));
  };

  const sendNotification = async () => {
    if (!form.title.trim() || !form.message.trim()) return;
    if (!form.toUser && !form.toRole && !form.toProperty) return;
    setSending(true);
    try {
      const payload = {
        title: form.title, message: form.message,
        template: form.template, priority: form.priority, animation: form.animation,
        scheduledFor: form.scheduledFor || undefined,
      };
      if (form.toUser)     payload.toUser     = form.toUser;
      if (form.toRole)     payload.toRole     = form.toRole;
      if (form.toProperty) payload.toProperty = form.toProperty;
      if (form.repeatGapHours || form.repeatPerDay || form.repeatTillDate) {
        payload.repeat = {
          gapHours:  form.repeatGapHours ? Number(form.repeatGapHours) : undefined,
          perDay:    form.repeatPerDay   ? Number(form.repeatPerDay)   : undefined,
          tillDate:  form.repeatTillDate || undefined,
        };
      }
      await fetch(`${API}/notifications/send`, { method: 'POST', headers: hdrs(), body: JSON.stringify(payload) });
      setComposing(false);
      setShowRepeat(false);
      const t = templates[0];
      setForm(f => ({ ...f, template: t?.id || 'CUSTOM', title: t?.title || '', message: t?.message || '',
        toUser: '', toRole: '', toProperty: '', scheduledFor: '',
        repeatGapHours: '', repeatPerDay: '', repeatTillDate: '' }));
    } finally { setSending(false); }
  };

  const timeAgo = (d) => {
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return new Date(d).toLocaleDateString();
  };

  const canSend = ['SUPER_ADMIN', 'PROPERTY_OWNER', 'DEVELOPER'].includes(user.role);

  return (
    <>
      {/* Inject keyframe styles */}
      <style>{`
        @keyframes notifIn { from { opacity:0; transform:translateX(120%) scale(0.8); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes bellPulse { 0%,100% { transform:rotate(0deg); } 15% { transform:rotate(12deg); } 30% { transform:rotate(-10deg); } 45% { transform:rotate(8deg); } 60% { transform:rotate(-5deg); } }
      `}</style>

      {/* Urgent full-screen modal (highest priority) */}
      {urgentModal && <UrgentModal notif={urgentModal} onClose={() => setUrgentModal(null)} />}

      {/* Toast for NORMAL / IMPORTANT */}
      {toast && !urgentModal && <NotifToast notif={toast} onClose={() => setToast(null)} />}

      {/* Bell button */}
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => { setOpen(o => !o); if (!open) { fetchInbox(); fetchTargets(); } }}
          className="relative p-2 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
        >
          <Bell className={`w-5 h-5 ${unread > 0 ? 'text-blue-600' : ''}`}
            style={unread > 0 ? { animation: 'bellPulse 1.5s ease-in-out infinite' } : {}} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" /> Notifications {unread > 0 && <span className="bg-red-100 text-red-700 text-xs font-black px-1.5 py-0.5 rounded-full">{unread} new</span>}
              </span>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <CheckCheck className="w-3 h-3" /> All read
                  </button>
                )}
                {canSend && (
                  <button onClick={() => setComposing(c => !c)} className={`ml-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition ${composing ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                    <Send className="w-3 h-3" /> Send
                  </button>
                )}
              </div>
            </div>

            {/* Compose panel */}
            {composing && canSend && (
              <div className="border-b border-gray-100 p-4 bg-blue-50/40 space-y-3">
                {/* Template picker */}
                <div className="flex flex-wrap gap-1.5">
                  {templates.map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => applyTemplate(t.id)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition ${form.template === t.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                        <Icon className={`w-3 h-3 ${form.template === t.id ? 'text-white' : t.color}`} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Title */}
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification title..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-400 outline-none" />

                {/* Message */}
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Your message..." rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-400 outline-none resize-none" />

                {/* Target */}
                <div className="grid grid-cols-2 gap-2">
                  {(user.role === 'SUPER_ADMIN' || user.role === 'DEVELOPER') && (
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Broadcast to Role</label>
                      <select value={form.toRole} onChange={e => setForm(f => ({ ...f, toRole: e.target.value, toUser: '', toProperty: '' }))}
                        className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">— pick role —</option>
                        <option value="PROPERTY_OWNER">All Owners</option>
                        <option value="HOTEL_MANAGER">All Managers</option>
                        <option value="ALL_STAFF">Everyone</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Or Specific User</label>
                    <select value={form.toUser} onChange={e => setForm(f => ({ ...f, toUser: e.target.value, toRole: '', toProperty: '' }))}
                      className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="">— pick person —</option>
                      {targets.users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role.replace('_',' ')})</option>)}
                    </select>
                  </div>
                  {targets.properties.length > 0 && (
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Or Hotel (broadcasts to its manager)</label>
                      <select value={form.toProperty} onChange={e => setForm(f => ({ ...f, toProperty: e.target.value, toUser: '', toRole: '' }))}
                        className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="">— pick hotel —</option>
                        {targets.properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Priority + Animation */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Priority</label>
                    <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                      className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none">
                      <option value="NORMAL">Normal</option>
                      <option value="IMPORTANT">Important</option>
                      <option value="URGENT">🚨 Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Animation</label>
                    <select value={form.animation} onChange={e => setForm(f => ({ ...f, animation: e.target.value }))}
                      className="w-full mt-0.5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none">
                      <option value="SLIDE">Slide In</option>
                      <option value="BOUNCE">Bounce</option>
                      <option value="CONFETTI">🎉 Confetti</option>
                      <option value="SHAKE">Shake (Urgent)</option>
                      <option value="GLOW">Glow Fade</option>
                    </select>
                  </div>
                </div>

                {/* Schedule + Repeat */}
                <div className="border border-blue-100 rounded-xl p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Schedule & Repeat
                    </label>
                    <button onClick={() => setShowRepeat(r => !r)} className="text-[10px] text-blue-600 font-bold hover:underline">
                      {showRepeat ? 'Hide ▲' : 'Expand ▼'}
                    </button>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Send At (leave blank = now)</label>
                    <input type="datetime-local" value={form.scheduledFor}
                      onChange={e => setForm(f => ({ ...f, scheduledFor: e.target.value }))}
                      className="w-full mt-0.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  {showRepeat && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Repeat every (hrs)</label>
                          <input type="number" min="1" max="168" value={form.repeatGapHours}
                            onChange={e => setForm(f => ({ ...f, repeatGapHours: e.target.value }))}
                            placeholder="e.g. 24"
                            className="w-full mt-0.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Max per day</label>
                          <input type="number" min="1" max="10" value={form.repeatPerDay}
                            onChange={e => setForm(f => ({ ...f, repeatPerDay: e.target.value }))}
                            placeholder="e.g. 2"
                            className="w-full mt-0.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Repeat until</label>
                        <input type="date" value={form.repeatTillDate}
                          onChange={e => setForm(f => ({ ...f, repeatTillDate: e.target.value }))}
                          className="w-full mt-0.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>
                      <p className="text-[10px] text-gray-400">Repeat config is stored — backend processes repeats periodically.</p>
                    </div>
                  )}
                </div>

                <button onClick={sendNotification} disabled={sending || !form.title.trim() || !form.message.trim() || (!form.toUser && !form.toRole && !form.toProperty)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : form.scheduledFor ? <><CalendarDays className="w-3.5 h-3.5" /> Schedule</> : <><Send className="w-3.5 h-3.5" /> Send Now</>}
                </button>
              </div>
            )}

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                  <Bell className="w-8 h-8 text-gray-200" /> No notifications yet
                </div>
              ) : notifications.map(n => (
                <button key={n._id} onClick={() => { if (!n.isRead) markRead(n._id); }}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-start gap-3 ${n.isRead ? 'opacity-60' : ''}`}>
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${n.isRead ? 'bg-transparent' : n.priority === 'URGENT' ? 'bg-red-500' : n.priority === 'IMPORTANT' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-gray-900 truncate">{n.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${PRIORITY_STYLE[n.priority]}`}>{n.priority}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.message}</p>
                    <div className="text-[10px] text-gray-400 mt-1">
                      {n.fromUser?.name || 'System'} · {timeAgo(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

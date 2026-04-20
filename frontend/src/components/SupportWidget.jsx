import { useState, useEffect } from 'react';
import {
  HelpCircle, X, Send, Loader2, CheckCircle, ChevronDown, ChevronUp,
  AlertCircle, Clock, MessageSquare, Bug, Lightbulb, Wrench, IndianRupee, MoreHorizontal
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const hdrs = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('hotel_auth_token')}` });

const CATEGORIES = [
  { id: 'BUG_REPORT',       icon: Bug,          label: 'Bug Report',       color: 'text-red-500' },
  { id: 'TECHNICAL_ISSUE',  icon: Wrench,       label: 'Technical Issue',  color: 'text-orange-500' },
  { id: 'FEATURE_REQUEST',  icon: Lightbulb,    label: 'Feature Request',  color: 'text-yellow-500' },
  { id: 'BILLING',          icon: IndianRupee,  label: 'Billing',          color: 'text-green-500' },
  { id: 'OTHER',            icon: MoreHorizontal,label: 'Other',           color: 'text-gray-500' },
];

const STATUS_STYLE = {
  OPEN:        'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED:    'bg-green-100 text-green-700',
  CLOSED:      'bg-gray-100 text-gray-600',
};

const PRIORITY_STYLE = {
  LOW:    'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH:   'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

export default function SupportWidget({ user }) {
  const [open, setOpen]       = useState(false);
  const [view, setView]       = useState('LIST'); // LIST | NEW | DETAIL
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [status, setStatus]   = useState(null);

  const [form, setForm] = useState({
    subject: '', description: '', category: 'TECHNICAL_ISSUE', priority: 'MEDIUM'
  });

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/support/tickets/mine`, { headers: hdrs() });
      if (res.ok) setTickets(await res.json());
    } finally { setLoading(false); }
  };

  const fetchDetail = async (id) => {
    const res = await fetch(`${API}/support/tickets/${id}`, { headers: hdrs() });
    if (res.ok) { setSelected(await res.json()); setView('DETAIL'); }
  };

  useEffect(() => { if (open) fetchTickets(); }, [open]);

  const openCount = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS').length;

  const submit = async () => {
    if (!form.subject.trim() || !form.description.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/support/tickets`, { method: 'POST', headers: hdrs(), body: JSON.stringify(form) });
      const d = await res.json();
      if (res.ok) {
        setStatus({ type: 'success', msg: 'Ticket submitted! Our dev team will respond shortly.' });
        setForm({ subject: '', description: '', category: 'TECHNICAL_ISSUE', priority: 'MEDIUM' });
        fetchTickets();
        setTimeout(() => { setView('LIST'); setStatus(null); }, 2000);
      } else {
        setStatus({ type: 'error', msg: d.message });
      }
    } finally { setSending(false); }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    const res = await fetch(`${API}/support/tickets/${selected._id}/reply`, { method: 'POST', headers: hdrs(), body: JSON.stringify({ message: replyText }) });
    if (res.ok) { setReplyText(''); fetchDetail(selected._id); }
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {openCount > 0 && !open && (
          <div className="bg-orange-500 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg">
            {openCount} open ticket{openCount > 1 ? 's' : ''}
          </div>
        )}
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center transition-all ${open ? 'bg-gray-800 rotate-12' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
        >
          {open ? <X className="w-5 h-5" /> : <HelpCircle className="w-6 h-6" />}
        </button>
      </div>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[75vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              <span className="text-sm font-bold">Support</span>
              {openCount > 0 && <span className="bg-white/20 text-xs font-bold px-1.5 py-0.5 rounded-full">{openCount} open</span>}
            </div>
            <div className="flex items-center gap-2">
              {view !== 'LIST' && (
                <button onClick={() => setView('LIST')} className="text-xs opacity-80 hover:opacity-100 font-medium">← Back</button>
              )}
              {view === 'LIST' && (
                <button onClick={() => { setView('NEW'); setStatus(null); }} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-xs font-bold px-2 py-1 rounded-lg transition">
                  <MessageSquare className="w-3 h-3" /> New Ticket
                </button>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* LIST view */}
            {view === 'LIST' && (
              <div>
                {loading ? (
                  <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                ) : tickets.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                    <CheckCircle className="w-8 h-8 text-gray-200" /> No tickets yet.<br />
                    <button onClick={() => setView('NEW')} className="text-blue-600 font-bold text-xs hover:underline">Raise your first one →</button>
                  </div>
                ) : tickets.map(t => {
                  const Cat = CATEGORIES.find(c => c.id === t.category);
                  const CatIcon = Cat?.icon || MoreHorizontal;
                  return (
                    <button key={t._id} onClick={() => fetchDetail(t._id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 flex items-start gap-3">
                      <CatIcon className={`w-4 h-4 mt-0.5 shrink-0 ${Cat?.color || 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-gray-900 truncate">{t.subject}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${STATUS_STYLE[t.status]}`}>{t.status.replace('_',' ')}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0 -rotate-90 mt-0.5" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* NEW TICKET view */}
            {view === 'NEW' && (
              <div className="p-4 space-y-3">
                {status && (
                  <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {status.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {status.msg}
                  </div>
                )}

                {/* Category */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Category</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {CATEGORIES.map(c => {
                      const Icon = c.icon;
                      return (
                        <button key={c.id} onClick={() => setForm(f => ({ ...f, category: c.id }))}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition ${form.category === c.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                          <Icon className={`w-3 h-3 ${form.category === c.id ? 'text-white' : c.color}`} />
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">🚨 Urgent</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Subject</label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    placeholder="Brief summary of the issue..."
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-400" />
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Describe the issue in detail. What happened? What did you expect?"
                    rows={4}
                    className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                </div>

                <button onClick={submit} disabled={sending || !form.subject.trim() || !form.description.trim()}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Submit Ticket
                </button>
              </div>
            )}

            {/* DETAIL view */}
            {view === 'DETAIL' && selected && (
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-sm font-bold text-gray-900">{selected.subject}</div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${STATUS_STYLE[selected.status]}`}>{selected.status.replace('_',' ')}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${PRIORITY_STYLE[selected.priority]}`}>{selected.priority}</span>
                    <span className="text-[10px] text-gray-400">{new Date(selected.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700">{selected.description}</div>

                {selected.resolutionNote && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs">
                    <div className="font-bold text-green-700 flex items-center gap-1 mb-1"><CheckCircle className="w-3.5 h-3.5" /> Resolution Note</div>
                    <p className="text-green-800">{selected.resolutionNote}</p>
                    {selected.resolvedAt && <div className="text-green-600 text-[10px] mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Resolved {new Date(selected.resolvedAt).toLocaleDateString()}</div>}
                  </div>
                )}

                {/* Replies */}
                {selected.replies?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversation</div>
                    {selected.replies.map((r, i) => {
                      const isDev = ['DEVELOPER', 'SUPER_ADMIN'].includes(r.fromRole);
                      return (
                        <div key={i} className={`rounded-xl p-3 text-xs ${isDev ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                          <div className={`font-bold text-[10px] mb-1 ${isDev ? 'text-blue-700' : 'text-gray-600'}`}>
                            {r.fromUser?.name || 'You'} · {isDev ? '🛠 Dev Team' : 'You'}
                          </div>
                          <p className="text-gray-800">{r.message}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Reply box */}
                {selected.status !== 'CLOSED' && (
                  <div className="space-y-2">
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                      placeholder="Add a reply or more details..."
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
                    <button onClick={sendReply} disabled={!replyText.trim()}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition">
                      <Send className="w-3 h-3" /> Send Reply
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 shrink-0">
            <p className="text-[10px] text-gray-400 text-center">Powered by StayLite Dev Team · Usually responds in &lt;24h</p>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  Activity, AlertTriangle, AlertCircle, CheckCircle, Database, Server,
  Cpu, HardDrive, Globe, Monitor, Smartphone, Tablet, Bot, Clock,
  RefreshCw, Filter, Trash2, ChevronDown, ChevronRight, Zap,
  BarChart3, TrendingUp, Wifi, Shield, Terminal, Search, Unlock, X,
  Users, Building2, PauseCircle, PlayCircle, UserX, KeyRound, LogOut,
  AlertOctagon, Wrench, HelpCircle, Send, MessageSquare,
  Edit2, Eye, EyeOff, Package, RotateCcw, FolderOpen, Image, Trash
} from 'lucide-react';

import { getToken } from '../utils/api';

const API        = '/api/developer';
const SUPPORT_API = '/api/support';
const token = () => getToken();
const fmt = (n) => new Intl.NumberFormat().format(n);
const fmtBytes = (b) => {
  if (!b) return '0 B';
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
};
const fmtTime = (ms) => ms == null ? '—' : ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(2)}s`;
const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(d).toLocaleDateString();
};

const CAT_STYLE = {
  BUG_REPORT:      'bg-red-100 text-red-700',
  TECHNICAL_ISSUE: 'bg-orange-100 text-orange-700',
  FEATURE_REQUEST: 'bg-yellow-100 text-yellow-700',
  BILLING:         'bg-green-100 text-green-700',
  OTHER:           'bg-gray-100 text-gray-600',
};
const TICKET_STATUS_STYLE = {
  OPEN:        'bg-yellow-100 text-yellow-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED:    'bg-green-100 text-green-700',
  CLOSED:      'bg-gray-100 text-gray-600',
};
const TICKET_PRIORITY_STYLE = {
  LOW:    'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH:   'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const STATUS_COLOR = {
  REQUEST: 'text-blue-600 bg-blue-50',
  ERROR:   'text-red-600 bg-red-50',
  WARNING: 'text-yellow-600 bg-yellow-50',
  INFO:    'text-gray-600 bg-gray-100',
};
const METHOD_COLOR = {
  GET:    'text-green-700 bg-green-100',
  POST:   'text-blue-700 bg-blue-100',
  PUT:    'text-yellow-700 bg-yellow-100',
  DELETE: 'text-red-700 bg-red-100',
};
const statusBadge = (code) => {
  if (!code) return 'text-gray-500';
  if (code < 300) return 'text-green-600 font-bold';
  if (code < 400) return 'text-blue-600 font-bold';
  if (code < 500) return 'text-yellow-600 font-bold';
  return 'text-red-600 font-bold';
};

const DeviceIcon = ({ device }) => {
  const cls = 'w-3.5 h-3.5';
  if (device === 'Mobile') return <Smartphone className={cls} />;
  if (device === 'Tablet') return <Tablet className={cls} />;
  if (device === 'Bot') return <Bot className={cls} />;
  return <Monitor className={cls} />;
};

const ROLE_LABEL = {
  SUPER_ADMIN:    'Admin',
  PROPERTY_OWNER: 'Owner',
  HOTEL_MANAGER:  'Manager',
  DEVELOPER:      'Developer',
};

// Logs now store a plain-English message — just return it.
// For old server-error logs that only have route/method, build a fallback.
function describeLog(log) {
  if (log.message) return log.message;
  if (log.route)   return `${log.method || 'GET'} ${log.route}`;
  return 'System event';
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color = 'blue', danger }) => (
  <div className={`bg-white border rounded-xl p-4 shadow-sm ${danger ? 'border-red-200' : 'border-gray-200'}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <div className={`p-1.5 rounded-lg bg-${color}-50`}>
        <Icon className={`w-4 h-4 text-${color}-500`} />
      </div>
    </div>
    <div className={`text-2xl font-black ${danger ? 'text-red-600' : 'text-gray-900'}`}>{value ?? '—'}</div>
    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

// ─── Refresh control ───────────────────────────────────────────────────────
const RefreshBar = ({ onRefresh, loading, lastRefreshed }) => (
  <div className="flex items-center gap-3 text-xs text-gray-400">
    {lastRefreshed && <span>Updated {timeAgo(lastRefreshed)}</span>}
    <button
      onClick={onRefresh}
      disabled={loading}
      className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium transition disabled:opacity-50"
    >
      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
      Refresh
    </button>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
export default function DeveloperDashboard({ tab: tabProp, setTab: setTabProp } = {}) {
  // Section is driven by the main app sidebar (lifted to StaffPortal). Falls back
  // to internal state if rendered standalone.
  const [tabState, setTabState] = useState('OVERVIEW');
  const tab = tabProp ?? tabState;
  const setTab = setTabProp ?? setTabState;
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Data stores
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [errors, setErrors] = useState({ errors: [], warnings: [], errorsByRoute: [] });
  const [dbStats, setDbStats] = useState(null);
  const [dbHealth, setDbHealth] = useState(null);
  const [r2Stats, setR2Stats] = useState(null);
  const [systemStats, setSystemStats] = useState(null);
  const [rateLimits, setRateLimits] = useState(null);

  // Access control data
  const [hotels, setHotels] = useState([]);
  const [users, setUsers] = useState([]);
  const [cleanupStats, setCleanupStats] = useState(null);
  const [actionStatus, setActionStatus] = useState(null); // { type, msg }

  // Confirm modal state
  const [confirmAction, setConfirmAction] = useState(null); // { label, desc, onConfirm, danger }
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Maintenance mode state
  const [maintenance, setMaintenance] = useState(null);
  const [maintForm, setMaintForm] = useState({ isActive: false, message: '', scheduledStart: '', scheduledEnd: '' });
  const [maintSaving, setMaintSaving] = useState(false);
  const [maintStatus, setMaintStatus] = useState(null);

  // Support ticket state
  const [tickets, setTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState({ status: '', priority: '', category: '' });
  const [expandedTicketId, setExpandedTicketId] = useState(null);
  const [expandedTicketDetail, setExpandedTicketDetail] = useState(null);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketResolution, setTicketResolution] = useState('');
  const [ticketStatusEdit, setTicketStatusEdit] = useState('');
  const [ticketActionLoading, setTicketActionLoading] = useState(false);

  // Log filter state
  const [logFilter, setLogFilter] = useState({ type: 'ALL', method: '', route: '', statusCode: '', offset: 0, limit: 50 });
  const [expandedLog, setExpandedLog] = useState(null);

  // Rate limit reset state
  const [resetIpInput, setResetIpInput] = useState('');
  const [resetStatus, setResetStatus] = useState(null); // { type: 'success'|'error', msg }

  // Edit user state
  const [editingUser, setEditingUser] = useState(null); // { _id, name, email, role }
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', role: '' });
  const [editUserSaving, setEditUserSaving] = useState(false);
  const [editUserStatus, setEditUserStatus] = useState(null);

  // DB browser state
  const [dbBrowseCol, setDbBrowseCol] = useState('users');
  const [dbBrowseDocs, setDbBrowseDocs] = useState([]);
  const [dbBrowseTotal, setDbBrowseTotal] = useState(0);
  const [dbBrowseOffset, setDbBrowseOffset] = useState(0);
  const [dbBrowseSearch, setDbBrowseSearch] = useState('');
  const [dbBrowseLoading, setDbBrowseLoading] = useState(false);
  const [dbBrowseExpanded, setDbBrowseExpanded] = useState(null);

  // Env vars state
  const [envVars, setEnvVars] = useState(null);
  const [envRevealAll, setEnvRevealAll] = useState(false);

  // R2 file browser state
  const [r2Files, setR2Files] = useState([]);
  const [r2FilesLoading, setR2FilesLoading] = useState(false);
  const [r2NextToken, setR2NextToken] = useState(null);
  const [r2FilesLoaded, setR2FilesLoaded] = useState(false);

  // Server restart state
  const [restartLoading, setRestartLoading] = useState(false);
  const [restartStatus, setRestartStatus] = useState(null);

  // ── fetchers ───────────────────────────────────────────────────────────────
  const fetchOverview = useCallback(async () => {
    const [apiRes, sysRes, errRes] = await Promise.all([
      fetch(`${API}/stats/api?hours=24`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/stats/system`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/errors?hours=24`, { headers: { Authorization: `Bearer ${token()}` } }),
    ]);
    if (apiRes.ok && sysRes.ok && errRes.ok) {
      const [api, sys, err] = await Promise.all([apiRes.json(), sysRes.json(), errRes.json()]);
      setOverview({ api, sys, err });
      setSystemStats(sys);
    }
  }, []);

  const fetchLogs = useCallback(async (filter = logFilter) => {
    const params = new URLSearchParams();
    if (filter.type && filter.type !== 'ALL') params.set('type', filter.type);
    if (filter.method) params.set('method', filter.method);
    if (filter.route) params.set('route', filter.route);
    if (filter.statusCode) params.set('statusCode', filter.statusCode);
    params.set('limit', filter.limit);
    params.set('offset', filter.offset);

    const res = await fetch(`${API}/logs?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs);
      setLogsTotal(data.total);
    }
  }, [logFilter]);

  const fetchErrors = useCallback(async () => {
    const res = await fetch(`${API}/errors?hours=24`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setErrors(await res.json());
  }, []);

  const fetchDB = useCallback(async () => {
    const [dbRes, healthRes, r2Res] = await Promise.all([
      fetch(`${API}/stats/db`,       { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/stats/db-health`,{ headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/stats/r2`,       { headers: { Authorization: `Bearer ${token()}` } }),
    ]);
    if (dbRes.ok)    setDbStats(await dbRes.json());
    if (healthRes.ok) setDbHealth(await healthRes.json());
    if (r2Res.ok)    setR2Stats(await r2Res.json());
  }, []);

  const fetchHotels = useCallback(async () => {
    const res = await fetch(`${API}/hotels`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setHotels(await res.json());
  }, []);

  const fetchUsers = useCallback(async () => {
    const res = await fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setUsers(await res.json());
  }, []);

  const fetchCleanup = useCallback(async () => {
    const res = await fetch(`${API}/cleanup/stats`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setCleanupStats(await res.json());
  }, []);

  const fetchTickets = useCallback(async (filter) => {
    const f = filter || ticketFilter;
    const params = new URLSearchParams();
    if (f.status)   params.set('status',   f.status);
    if (f.priority) params.set('priority', f.priority);
    if (f.category) params.set('category', f.category);
    const res = await fetch(`${SUPPORT_API}/tickets?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setTickets(await res.json());
  }, [ticketFilter]);

  const applyTicketFilter = (patch) => {
    const next = { ...ticketFilter, ...patch };
    setTicketFilter(next);
    fetchTickets(next);
  };

  const expandTicket = async (ticket) => {
    if (expandedTicketId === ticket._id) { setExpandedTicketId(null); setExpandedTicketDetail(null); return; }
    setExpandedTicketId(ticket._id);
    setExpandedTicketDetail(null);
    setTicketReply('');
    setTicketResolution(ticket.resolutionNote || '');
    setTicketStatusEdit(ticket.status);
    const res = await fetch(`${SUPPORT_API}/tickets/${ticket._id}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setExpandedTicketDetail(await res.json());
  };

  const updateTicket = async (id) => {
    setTicketActionLoading(true);
    try {
      const body = { status: ticketStatusEdit };
      if (ticketResolution.trim()) body.resolutionNote = ticketResolution.trim();
      const res = await fetch(`${SUPPORT_API}/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        fetchTickets();
        const dr = await fetch(`${SUPPORT_API}/tickets/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
        if (dr.ok) setExpandedTicketDetail(await dr.json());
        setActionStatus({ type: 'success', msg: 'Ticket updated.' });
        setTimeout(() => setActionStatus(null), 3000);
      }
    } finally { setTicketActionLoading(false); }
  };

  const sendTicketReply = async (id) => {
    if (!ticketReply.trim()) return;
    setTicketActionLoading(true);
    try {
      const res = await fetch(`${SUPPORT_API}/tickets/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ message: ticketReply })
      });
      if (res.ok) {
        setTicketReply('');
        const dr = await fetch(`${SUPPORT_API}/tickets/${id}`, { headers: { Authorization: `Bearer ${token()}` } });
        if (dr.ok) setExpandedTicketDetail(await dr.json());
        fetchTickets();
      }
    } finally { setTicketActionLoading(false); }
  };

  const fetchMaintenance = useCallback(async () => {
    const res = await fetch(`${API}/maintenance`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) {
      const m = await res.json();
      setMaintenance(m);
      setMaintForm({
        isActive:       m.isActive || false,
        message:        m.message  || '',
        scheduledStart: m.scheduledStart ? new Date(m.scheduledStart).toISOString().slice(0, 16) : '',
        scheduledEnd:   m.scheduledEnd   ? new Date(m.scheduledEnd).toISOString().slice(0, 16)   : '',
      });
    }
  }, []);

  const saveMaintenance = async () => {
    setMaintSaving(true);
    try {
      const body = {
        isActive:       maintForm.isActive,
        message:        maintForm.message || undefined,
        scheduledStart: maintForm.scheduledStart || null,
        scheduledEnd:   maintForm.scheduledEnd   || null,
      };
      const res = await fetch(`${API}/maintenance`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body)
      });
      const d = await res.json();
      if (res.ok) {
        setMaintStatus({ type: 'success', msg: d.message });
        fetchMaintenance();
      } else {
        setMaintStatus({ type: 'error', msg: d.message });
      }
    } finally {
      setMaintSaving(false);
      setTimeout(() => setMaintStatus(null), 4000);
    }
  };

  const fetchSystem = useCallback(async () => {
    const [sysRes, rlRes] = await Promise.all([
      fetch(`${API}/stats/system`, { headers: { Authorization: `Bearer ${token()}` } }),
      fetch(`${API}/stats/ratelimits?hours=1`, { headers: { Authorization: `Bearer ${token()}` } }),
    ]);
    if (sysRes.ok) setSystemStats(await sysRes.json());
    if (rlRes.ok) setRateLimits(await rlRes.json());
  }, []);

  const fetchDbBrowse = useCallback(async (col, offset, search) => {
    const c = col ?? dbBrowseCol;
    const o = offset ?? dbBrowseOffset;
    const s = search !== undefined ? search : dbBrowseSearch;
    setDbBrowseLoading(true);
    try {
      const params = new URLSearchParams({ limit: 20, offset: o });
      if (s) params.set('search', s);
      const res = await fetch(`${API}/db/browse/${c}?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        const data = await res.json();
        setDbBrowseDocs(data.documents);
        setDbBrowseTotal(data.total);
        setDbBrowseOffset(o);
      }
    } finally { setDbBrowseLoading(false); }
  }, [dbBrowseCol, dbBrowseOffset, dbBrowseSearch]);

  const fetchEnv = useCallback(async () => {
    const res = await fetch(`${API}/env`, { headers: { Authorization: `Bearer ${token()}` } });
    if (res.ok) setEnvVars(await res.json());
  }, []);

  const fetchR2Files = useCallback(async (token2) => {
    setR2FilesLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (token2) params.set('token', token2);
      const res = await fetch(`${API}/storage/files?${params}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) {
        const data = await res.json();
        setR2Files(prev => token2 ? [...prev, ...(data.files || [])] : (data.files || []));
        setR2NextToken(data.nextToken || null);
        setR2FilesLoaded(true);
      }
    } finally { setR2FilesLoading(false); }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'OVERVIEW') await fetchOverview();
      else if (tab === 'LOGS') await fetchLogs();
      else if (tab === 'ERRORS') await fetchErrors();
      else if (tab === 'DATABASE') await fetchDB();
      else if (tab === 'SYSTEM') { await fetchSystem(); await fetchMaintenance(); }
      else if (tab === 'ACCESS') await fetchHotels();
      else if (tab === 'USERS') await fetchUsers();
      else if (tab === 'CLEANUP') await fetchCleanup();
      else if (tab === 'SUPPORT') await fetchTickets();
      else if (tab === 'DB_BROWSE') await fetchDbBrowse();
      else if (tab === 'ENV') await fetchEnv();
      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  }, [tab, fetchOverview, fetchLogs, fetchErrors, fetchDB, fetchSystem, fetchHotels, fetchUsers, fetchCleanup, fetchTickets, fetchMaintenance, fetchDbBrowse, fetchEnv]);

  useEffect(() => { refresh(); }, [tab]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { if (!loading) refresh(); }, 30000);
    return () => clearInterval(id);
  }, [refresh, loading]);

  const applyLogFilter = (patch) => {
    const next = { ...logFilter, ...patch, offset: 0 };
    setLogFilter(next);
    fetchLogs(next);
  };

  const purgeLogs = async () => {
    if (!confirm('Delete all log entries older than 30 days?')) return;
    const res = await fetch(`${API}/logs/purge?days=30`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    });
    if (res.ok) { const d = await res.json(); alert(d.message); refresh(); }
  };

  const deleteAllLogs = async () => {
    if (!confirm('Delete ALL logs permanently? This cannot be undone.')) return;
    const res = await fetch(`${API}/logs/all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token()}` }
    });
    if (res.ok) { const d = await res.json(); alert(d.message); setLogs([]); setLogsTotal(0); }
  };

  const handleResetIP = async (ip) => {
    const target = ip || resetIpInput.trim();
    if (!target) return;
    setResetStatus(null);
    const res = await fetch(`${API}/rate-limits/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ ip: target })
    });
    const data = await res.json();
    setResetStatus({ type: res.ok ? 'success' : 'error', msg: data.message });
    if (res.ok) { setResetIpInput(''); fetchSystem(); }
    setTimeout(() => setResetStatus(null), 4000);
  };

  // Generic confirm-then-action helper
  const runConfirmed = async (label, desc, danger, apiFn) => {
    setConfirmAction({ label, desc, danger, onConfirm: async () => {
      setConfirmLoading(true);
      try {
        const msg = await apiFn();
        setActionStatus({ type: 'success', msg });
        refresh();
      } catch (e) {
        setActionStatus({ type: 'error', msg: e.message || 'Action failed.' });
      } finally {
        setConfirmLoading(false);
        setConfirmAction(null);
        setTimeout(() => setActionStatus(null), 4000);
      }
    }});
  };

  const safeJson = async (res) => {
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error(`Server error (${res.status}). Is the backend running?`);
    }
    return res.json();
  };

  const devPatch = async (url, body) => {
    const res = await fetch(`${API}${url}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(body) });
    const d = await safeJson(res);
    if (!res.ok) throw new Error(d.message);
    return d.message;
  };

  const devDelete = async (url) => {
    const res = await fetch(`${API}${url}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
    const d = await safeJson(res);
    if (!res.ok) throw new Error(d.message);
    return d.message;
  };

  const errorCount = errors.errors?.length ?? 0;
  const warnCount = errors.warnings?.length ?? 0;

  // ── nav metadata ───────────────────────────────────────────────────────────
  const NAV = [
    { group: 'Monitor',         t: 'OVERVIEW',  Icon: BarChart3,     label: 'Overview'         },
    { group: 'Monitor',         t: 'LOGS',       Icon: Activity,      label: 'Logs',      badge: logsTotal },
    { group: 'Monitor',         t: 'ERRORS',     Icon: AlertTriangle, label: 'Errors',    badge: errorCount + warnCount },
    { group: 'Infrastructure',  t: 'SYSTEM',     Icon: Server,        label: 'System'           },
    { group: 'Infrastructure',  t: 'DATABASE',   Icon: Database,      label: 'Database'         },
    { group: 'Infrastructure',  t: 'ENV',        Icon: Package,       label: 'Env Vars'         },
    { group: 'Data',            t: 'DB_BROWSE',  Icon: FolderOpen,    label: 'DB Browse'        },
    { group: 'Management',      t: 'USERS',      Icon: Users,         label: 'Users'            },
    { group: 'Management',      t: 'ACCESS',     Icon: Building2,     label: 'Hotels'           },
    { group: 'Operations',      t: 'CLEANUP',    Icon: Wrench,        label: 'Cleanup'          },
    { group: 'Operations',      t: 'SUPPORT',    Icon: HelpCircle,    label: 'Support',   badge: tickets.filter(x => x.status === 'OPEN' || x.status === 'IN_PROGRESS').length },
  ];
  const current = NAV.find(n => n.t === tab) || NAV[0];
  const CurrentIcon = current.Icon;

  // ── render ───────────────────────────────────────────────────────────────────
  // Navigation lives in the main app sidebar (App.jsx) — this just renders a slim
  // section header + the content, so there is only ONE sidebar in the whole app.
  return (
    <div className="min-h-screen bg-gray-50/50">

      {/* Slim section header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 h-12 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <CurrentIcon className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="text-sm font-black text-gray-900 truncate">{current.label}</span>
          <span className="hidden sm:inline text-xs text-gray-400 ml-1 shrink-0">· {current.group}</span>
        </div>
        <RefreshBar onRefresh={refresh} loading={loading} lastRefreshed={lastRefreshed} />
      </header>

      <div className="p-4 sm:p-6 space-y-4">

          {/* ── OVERVIEW ─────────────────────────────────────────────────── */}
          {tab === 'OVERVIEW' && overview && (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Activity} label="Total Requests (24h)" value={fmt(overview.api.totalRequests)} color="blue" />
                <StatCard icon={AlertTriangle} label="Errors (24h)" value={fmt(errorCount)} color="red" danger={errorCount > 0} />
                <StatCard icon={AlertCircle} label="Warnings (24h)" value={fmt(warnCount)} color="yellow" />
                <StatCard icon={Clock} label="Avg Response" value={fmtTime(overview.api.responseTime?.avg)} sub={`Max: ${fmtTime(overview.api.responseTime?.max)}`} color="green" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top routes */}
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" /> Top Routes (24h)
                  </h3>
                  <div className="space-y-1.5">
                    {(overview.api.byRoute || []).slice(0, 8).map((r, i) => (
                      <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${METHOD_COLOR[r._id?.method] || 'bg-gray-100 text-gray-600'}`}>
                          {r._id?.method}
                        </span>
                        <span className="font-mono text-gray-700 flex-1 truncate">{r._id?.route}</span>
                        <span className="font-bold text-gray-900 shrink-0">{fmt(r.count)}</span>
                        <span className="text-gray-400 shrink-0">{fmtTime(r.avgTime)}</span>
                        {r.errors > 0 && <span className="text-red-500 font-bold shrink-0">{r.errors}✕</span>}
                      </div>
                    ))}
                    {(!overview.api.byRoute || overview.api.byRoute.length === 0) && (
                      <p className="text-xs text-gray-400 text-center py-4">No traffic data yet</p>
                    )}
                  </div>
                </div>

                {/* Right column: devices + status breakdown */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Monitor className="w-3.5 h-3.5" /> Devices
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(overview.api.byDevice || []).map((d, _i) => (
                        <div key={_i} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs">
                          <DeviceIcon device={d._id} />
                          <span className="font-medium text-gray-700">{d._id || 'Unknown'}</span>
                          <span className="font-black text-gray-900">{fmt(d.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" /> HTTP Status Codes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {(overview.api.statusBreakdown || []).map((s, i) => (
                        <div key={i} className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                          s._id < 300 ? 'bg-green-50 border-green-200 text-green-700' :
                          s._id < 400 ? 'bg-blue-50 border-blue-200 text-blue-700' :
                          s._id < 500 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                          'bg-red-50 border-red-200 text-red-700'
                        }`}>
                          {s._id} <span className="font-black">×{fmt(s.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" /> Top IPs
                    </h3>
                    <div className="space-y-1">
                      {(overview.api.topIPs || []).slice(0, 5).map((ip, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-gray-600 flex-1">{ip._id}</span>
                          <DeviceIcon device={ip.device} />
                          <span className="font-bold text-gray-900">{fmt(ip.count)} req</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hourly timeline */}
              {(overview.api.byHour || []).length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5" /> Requests Timeline (24h)
                  </h3>
                  <div className="flex items-end gap-1 h-16 bg-gray-50 rounded-xl p-3 overflow-x-auto">
                    {(() => {
                      const max = Math.max(...overview.api.byHour.map(h => h.count), 1);
                      return overview.api.byHour.map((h, i) => (
                        <div key={i} className="flex flex-col items-center gap-0.5 flex-1 min-w-3" title={`${h._id}: ${h.count} requests`}>
                          <div
                            className="w-full rounded-sm bg-violet-500 transition-all"
                            style={{ height: `${(h.count / max) * 36}px`, minHeight: 2 }}
                          />
                          {h.errors > 0 && <div className="w-1 h-1 rounded-full bg-red-500" />}
                        </div>
                      ));
                    })()}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Each bar = 1 hour · Red dots = errors</p>
                </div>
              )}
            </div>
          )}

          {/* ── REQUEST LOGS ─────────────────────────────────────────────── */}
          {tab === 'LOGS' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1.5 text-xs">
                  <Filter className="w-3 h-3 text-gray-400" />
                  <select value={logFilter.type} onChange={e => applyLogFilter({ type: e.target.value })}
                    className="bg-transparent text-xs font-medium text-gray-700 outline-none">
                    <option value="ALL">All Events</option>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warnings</option>
                    <option value="ERROR">Errors</option>
                  </select>
                </div>
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-40">
                  <Search className="w-3 h-3 text-gray-400" />
                  <input
                    value={logFilter.route}
                    onChange={e => applyLogFilter({ route: e.target.value })}
                    placeholder="Search events…"
                    className="bg-transparent text-xs outline-none flex-1 text-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button onClick={purgeLogs} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition">
                    <Trash2 className="w-3 h-3" /> Purge Old
                  </button>
                  <button onClick={deleteAllLogs} className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition">
                    <Trash2 className="w-3 h-3" /> Delete All
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400">{fmt(logsTotal)} total entries · showing {logs.length}</p>

              {/* Activity feed */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                {logs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">No activity found.</div>
                ) : logs.map((log) => {
                  const isError   = log.type === 'ERROR';
                  const isWarning = log.type === 'WARNING';
                  const isSuccess = log.statusCode && log.statusCode < 300;
                  const dotColor  = isError ? 'bg-red-500' : isWarning ? 'bg-yellow-400' : isSuccess ? 'bg-green-500' : 'bg-gray-300';
                  const role      = ROLE_LABEL[log.userRole] || null;

                  const typeBadge = isError
                    ? 'bg-red-100 text-red-700'
                    : isWarning
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700';

                  return (
                    <div key={log._id}>
                      <button
                        onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition ${isError ? 'bg-red-50/40' : isWarning ? 'bg-yellow-50/30' : ''}`}
                      >
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

                        {/* Message */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{describeLog(log)}</p>
                        </div>

                        {/* Type badge + time */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${typeBadge}`}>
                            {log.type}
                          </span>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                          <ChevronRight className={`w-3.5 h-3.5 text-gray-300 transition-transform ${expandedLog === log._id ? 'rotate-90' : ''}`} />
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {expandedLog === log._id && (
                        <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-1.5 text-xs text-gray-600">
                          <div className="flex flex-wrap gap-x-6 gap-y-1">
                            <span><span className="text-gray-400">Time: </span>{new Date(log.createdAt).toLocaleString()}</span>
                            {log.ip && <span><span className="text-gray-400">IP: </span><span className="font-mono">{log.ip}</span></span>}
                            {log.userRole && <span><span className="text-gray-400">Role: </span>{ROLE_LABEL[log.userRole] || log.userRole}</span>}
                            {log.route && <span><span className="text-gray-400">Route: </span><span className="font-mono">{log.method} {log.route}</span></span>}
                          </div>
                          {log.metadata && (
                            <div className="mt-1.5 bg-gray-100 rounded-lg p-2">
                              <p className="text-[10px] font-bold text-gray-500 mb-1">Details</p>
                              <pre className="text-gray-700 text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(log.metadata, null, 2)}</pre>
                            </div>
                          )}
                          {log.stack && (
                            <div className="mt-1.5 bg-red-900/90 rounded-lg p-3">
                              <p className="text-[10px] font-bold text-red-300 mb-1">Stack Trace</p>
                              <pre className="text-red-200 text-[10px] whitespace-pre-wrap break-all">{log.stack}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {logsTotal > logFilter.limit && (
                <div className="flex items-center gap-3 justify-center text-xs">
                  <button
                    disabled={logFilter.offset === 0}
                    onClick={() => { const next = { ...logFilter, offset: Math.max(0, logFilter.offset - logFilter.limit) }; setLogFilter(next); fetchLogs(next); }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 font-medium"
                  >← Prev</button>
                  <span className="text-gray-400">
                    {logFilter.offset + 1}–{Math.min(logFilter.offset + logFilter.limit, logsTotal)} of {fmt(logsTotal)}
                  </span>
                  <button
                    disabled={logFilter.offset + logFilter.limit >= logsTotal}
                    onClick={() => { const next = { ...logFilter, offset: logFilter.offset + logFilter.limit }; setLogFilter(next); fetchLogs(next); }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 font-medium"
                  >Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ── ERRORS & WARNINGS ─────────────────────────────────────────── */}
          {tab === 'ERRORS' && (
            <div className="space-y-6">
              {/* Error heatmap by route */}
              {errors.errorsByRoute?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Error Hotspots (24h)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {errors.errorsByRoute.map((r, i) => (
                      <div key={i} className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs">
                        <span className="text-red-600 font-black text-base">{r.count}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-red-800 truncate">{r._id?.route}</div>
                          <div className="text-red-400 text-[10px]">HTTP {r._id?.statusCode} · last {timeAgo(r.lastSeen)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error list */}
              <div>
                <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5" /> Errors ({errorCount})
                </h3>
                <div className="space-y-2">
                  {errors.errors?.length === 0 && (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-100 rounded-xl p-4 text-sm font-medium">
                      <CheckCircle className="w-4 h-4" /> No errors in the last 24h
                    </div>
                  )}
                  {errors.errors?.map((e, i) => (
                    <ErrorCard key={i} log={e} type="error" />
                  ))}
                </div>
              </div>

              {/* Warning list */}
              <div>
                <h3 className="text-xs font-bold text-yellow-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Warnings ({warnCount})
                </h3>
                <div className="space-y-2">
                  {errors.warnings?.length === 0 && (
                    <div className="flex items-center gap-2 text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
                      No warnings in the last 24h
                    </div>
                  )}
                  {errors.warnings?.map((w, i) => (
                    <ErrorCard key={i} log={w} type="warning" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── DATABASE ──────────────────────────────────────────────────── */}
          {tab === 'DATABASE' && dbStats && (
            <div className="space-y-6">
              {/* Storage health bar */}
              {dbHealth && (
                <div className={`rounded-xl border p-4 ${dbHealth.status === 'DANGER' ? 'bg-red-50 border-red-200' : dbHealth.status === 'WARNING' ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                      {dbHealth.status === 'DANGER' && <AlertOctagon className="w-4 h-4 text-red-600" />}
                      {dbHealth.status === 'WARNING' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                      {dbHealth.status === 'OK' && <CheckCircle className="w-4 h-4 text-green-600" />}
                      MongoDB Storage Usage
                    </span>
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${dbHealth.status === 'DANGER' ? 'bg-red-100 text-red-700' : dbHealth.status === 'WARNING' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {dbHealth.usedMB} MB / {dbHealth.limitMB} MB · {dbHealth.usedPct}%
                    </span>
                  </div>
                  <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-gray-200">
                    <div
                      className={`h-3 rounded-full transition-all ${dbHealth.status === 'DANGER' ? 'bg-red-500' : dbHealth.status === 'WARNING' ? 'bg-yellow-400' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(dbHealth.usedPct, 100)}%` }}
                    />
                  </div>
                  {dbHealth.status !== 'OK' && (
                    <p className={`text-xs mt-1.5 font-medium ${dbHealth.status === 'DANGER' ? 'text-red-700' : 'text-yellow-700'}`}>
                      {dbHealth.status === 'DANGER' ? '⚠ Critical: approaching storage limit. Delete old logs or upgrade your MongoDB plan.' : '⚡ Warning: storage above 80%. Monitor closely and consider purging old logs.'}
                    </p>
                  )}
                </div>
              )}

              {/* R2 Storage card */}
              {r2Stats && (
                r2Stats.configured ? (
                  <div className={`rounded-xl border p-4 ${r2Stats.status === 'DANGER' ? 'bg-red-50 border-red-200' : r2Stats.status === 'WARNING' ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-orange-500" />
                        Cloudflare R2 Storage
                      </span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${r2Stats.status === 'DANGER' ? 'bg-red-100 text-red-700' : r2Stats.status === 'WARNING' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {r2Stats.usedMB} MB / {r2Stats.limitGB} GB free · {r2Stats.usedPct}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
                      <div
                        className={`h-3 rounded-full transition-all ${r2Stats.status === 'DANGER' ? 'bg-red-500' : r2Stats.status === 'WARNING' ? 'bg-yellow-400' : 'bg-orange-500'}`}
                        style={{ width: `${Math.min(r2Stats.usedPct, 100)}%`, minWidth: r2Stats.totalObjects > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{fmt(r2Stats.totalObjects)} file{r2Stats.totalObjects !== 1 ? 's' : ''} stored</span>
                      <span>{r2Stats.bucket}</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 p-4 flex items-center gap-3 text-sm text-gray-400">
                    <Globe className="w-4 h-4 shrink-0" />
                    Cloudflare R2 not configured — add CF_R2_* keys to .env
                  </div>
                )
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard icon={Database} label="Database" value={dbStats.database} color="violet" />
                <StatCard icon={HardDrive} label="Data Size" value={fmtBytes(dbStats.totalSize)} color="blue" />
                <StatCard icon={HardDrive} label="Storage Size" value={fmtBytes(dbStats.storageSize)} color="indigo" />
                <StatCard icon={Zap} label="Index Size" value={fmtBytes(dbStats.indexSize)} color="green" />
              </div>

              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Collections</h3>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse min-w-150">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-100">
                          <th className="px-4 py-3 text-left">Collection</th>
                          <th className="px-4 py-3 text-right">Documents</th>
                          <th className="px-4 py-3 text-right">Data Size</th>
                          <th className="px-4 py-3 text-right">Avg Doc</th>
                          <th className="px-4 py-3 text-right">Storage</th>
                          <th className="px-4 py-3 text-right">Indexes</th>
                          <th className="px-4 py-3 text-right">Index Size</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {dbStats.collections.map((c, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono font-semibold text-gray-800">{c.name}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(c.count)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{fmtBytes(c.size)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">{fmtBytes(c.avgObjSize)}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{fmtBytes(c.storageSize)}</td>
                            <td className="px-4 py-3 text-right text-gray-400">{c.nindexes}</td>
                            <td className="px-4 py-3 text-right text-gray-400">{fmtBytes(c.totalIndexSize)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400">MongoDB {dbStats.mongoVersion} · Logs auto-purge after 30 days via TTL index.</p>

              {/* R2 File Browser */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Image className="w-3.5 h-3.5 text-orange-500" /> R2 Files (ID Proofs)
                  </h3>
                  {!r2FilesLoaded && (
                    <button
                      onClick={() => fetchR2Files()}
                      disabled={r2FilesLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-100 transition"
                    >
                      {r2FilesLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />} Load Files
                    </button>
                  )}
                  {r2FilesLoaded && (
                    <button onClick={() => fetchR2Files()} disabled={r2FilesLoading}
                      className="flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50 transition">
                      <RefreshCw className={`w-3 h-3 ${r2FilesLoading ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
                {r2FilesLoaded && (
                  r2Files.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">No files in R2 bucket.</div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-100">
                              <th className="px-4 py-2.5 text-left">File Key</th>
                              <th className="px-4 py-2.5 text-right">Size</th>
                              <th className="px-4 py-2.5 text-right">Last Modified</th>
                              <th className="px-4 py-2.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {r2Files.map((f, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-2.5 font-mono text-gray-700 truncate max-w-xs">{f.key}</td>
                                <td className="px-4 py-2.5 text-right text-gray-500">{fmtBytes(f.size)}</td>
                                <td className="px-4 py-2.5 text-right text-gray-400">{f.lastModified ? new Date(f.lastModified).toLocaleDateString() : '—'}</td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center gap-1.5 justify-end">
                                    {process.env.CF_R2_PUBLIC_URL && (
                                      <a href={`${process.env.CF_R2_PUBLIC_URL}/${f.key}`} target="_blank" rel="noreferrer"
                                        className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-100 transition">
                                        <Eye className="w-2.5 h-2.5" /> View
                                      </a>
                                    )}
                                    <button
                                      onClick={() => runConfirmed('Delete R2 File', `Delete "${f.key}"? This permanently removes the ID proof photo.`, true, async () => {
                                        const res = await fetch(`${API}/storage/file`, {
                                          method: 'DELETE',
                                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                                          body: JSON.stringify({ key: f.key })
                                        });
                                        const d = await res.json();
                                        if (!res.ok) throw new Error(d.message);
                                        setR2Files(prev => prev.filter(x => x.key !== f.key));
                                        return d.message;
                                      })}
                                      className="flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded text-[10px] font-bold hover:bg-red-100 transition"
                                    >
                                      <Trash className="w-2.5 h-2.5" /> Del
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {r2NextToken && (
                        <div className="p-3 border-t border-gray-100 text-center">
                          <button onClick={() => fetchR2Files(r2NextToken)} disabled={r2FilesLoading}
                            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-600 transition">
                            Load more…
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* ── SYSTEM ────────────────────────────────────────────────────── */}
          {tab === 'SYSTEM' && systemStats && (
            <div className="space-y-6">

              {/* Server memory-pressure warning — only meaningful on the real server */}
              {(() => {
                const memPct = Number(systemStats.os.memUsagePercent) || 0;
                if (systemStats.env !== 'production' || memPct < 85) return null;
                const critical = memPct >= 90;
                return (
                  <div className={`rounded-xl border p-4 ${critical ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="flex items-start gap-3">
                      {critical
                        ? <AlertOctagon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        : <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />}
                      <div className="flex-1">
                        <p className={`text-sm font-black ${critical ? 'text-red-700' : 'text-yellow-700'}`}>
                          {critical ? 'Critical: server memory almost full' : 'Warning: server memory running high'}
                        </p>
                        <p className={`text-xs mt-1 leading-relaxed ${critical ? 'text-red-600' : 'text-yellow-700'}`}>
                          OS memory is at <strong>{memPct}%</strong> ({systemStats.os.freeMemMB} MB free of {systemStats.os.totalMemMB} MB).
                          {critical
                            ? ' Upgrade the server now to avoid crashes.'
                            : ' If it stays above ~85% consistently, plan to upgrade the server.'}
                          {' '}Increase the EC2 instance size (e.g. <strong>t3.small</strong> → 2 GB or <strong>t3.medium</strong> → 4 GB):
                          stop the instance → <em>Actions → Change instance type</em> → start. Attach an Elastic IP first so the public IP doesn’t change.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard icon={Clock} label="Uptime" value={systemStats.node.uptimeHuman} color="green" />
                <StatCard icon={Cpu} label="Heap Used" value={`${systemStats.memory.heapUsedMB} MB`} sub={`of ${systemStats.memory.heapTotalMB} MB`} color="blue" />
                <StatCard icon={HardDrive} label="RSS Memory" value={`${systemStats.memory.rssMB} MB`} color="indigo" />
                <StatCard icon={Server} label="OS Memory" value={`${systemStats.os.memUsagePercent}%`} sub={`${systemStats.os.freeMemMB} MB free`} color="violet" danger={systemStats.env === 'production' && Number(systemStats.os.memUsagePercent) >= 90} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Node.js info */}
                <InfoGroup title="Node.js Process" icon={Terminal} rows={[
                  ['Version', systemStats.node.version],
                  ['Platform', `${systemStats.node.platform} (${systemStats.node.arch})`],
                  ['PID', systemStats.node.pid],
                  ['Environment', systemStats.env],
                  ['Uptime', systemStats.node.uptimeHuman],
                ]} />

                {/* MongoDB info */}
                <InfoGroup title="MongoDB Connection" icon={Database} rows={[
                  ['Status', systemStats.mongodb.state],
                  ['Host', systemStats.mongodb.host],
                  ['Port', systemStats.mongodb.port],
                  ['Database', systemStats.mongodb.name],
                ]} statusField="Status" />

                {/* OS info */}
                <InfoGroup title="Operating System" icon={Server} rows={[
                  ['Type', systemStats.os.type],
                  ['Release', systemStats.os.release],
                  ['Hostname', systemStats.os.hostname],
                  ['CPUs', `${systemStats.os.cpus}× ${systemStats.os.cpuModel}`],
                  ['Total Memory', `${systemStats.os.totalMemMB} MB`],
                  ['Free Memory', `${systemStats.os.freeMemMB} MB`],
                ]} />

                {/* Rate limit config */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" /> Rate Limit Manager
                  </h3>

                  {/* Config summary */}
                  {rateLimits && (
                    <div className="space-y-1.5">
                      {Object.entries(rateLimits.config).map(([key, cfg]) => (
                        <div key={key} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                          <span className="font-mono font-semibold text-gray-700 capitalize">{key}</span>
                          <span className="text-gray-500">{cfg.description}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Manual IP reset */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Reset by IP</p>
                    <div className="flex gap-2">
                      <input
                        value={resetIpInput}
                        onChange={e => setResetIpInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleResetIP()}
                        placeholder="e.g. 127.0.0.1"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-violet-500"
                      />
                      <button
                        onClick={() => handleResetIP()}
                        disabled={!resetIpInput.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg text-xs font-bold transition"
                      >
                        <Unlock className="w-3 h-3" /> Reset
                      </button>
                    </div>
                    {resetStatus && (
                      <div className={`mt-2 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium ${resetStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {resetStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                        {resetStatus.msg}
                      </div>
                    )}
                  </div>

                  {/* Throttled IPs with one-click reset */}
                  {rateLimits?.throttledIPs?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-2">Throttled IPs — last 1h</p>
                      <div className="space-y-1">
                        {rateLimits.throttledIPs.map((ip, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                            <span className="font-mono text-red-700 flex-1">{ip._id}</span>
                            <span className="font-black text-red-700 shrink-0">{ip.count}× 429</span>
                            <button
                              onClick={() => handleResetIP(ip._id)}
                              className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition shrink-0"
                            >
                              <Unlock className="w-2.5 h-2.5" /> Unblock
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Auth hits */}
                  {rateLimits?.authHits?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider mb-2">Auth Route Hits — last 1h</p>
                      <div className="space-y-1">
                        {rateLimits.authHits.slice(0, 5).map((ip, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <DeviceIcon device={ip.device} />
                            <span className="font-mono text-gray-600 flex-1">{ip._id}</span>
                            <span className="font-bold text-gray-700">{ip.count} req</span>
                            <button
                              onClick={() => handleResetIP(ip._id)}
                              className="flex items-center gap-1 px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-[10px] font-bold transition shrink-0"
                            >
                              <Unlock className="w-2.5 h-2.5" /> Reset
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {rateLimits && !rateLimits.throttledIPs?.length && !rateLimits.authHits?.length && (
                    <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                      <CheckCircle className="w-3.5 h-3.5" /> No throttled IPs in the last hour.
                    </div>
                  )}
                </div>
              </div>

              {/* Server Restart */}
              <div className="col-span-1 sm:col-span-2 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-orange-500" /> Server Process
                </h3>
                <p className="text-xs text-gray-400">
                  Triggers <code className="bg-gray-100 px-1 rounded">process.exit(0)</code> — PM2 auto-restarts the Node.js process within ~3 seconds. Use this after updating <code className="bg-gray-100 px-1 rounded">.env</code> on the server.
                </p>
                {restartStatus && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg font-medium ${restartStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {restartStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    {restartStatus.msg}
                  </div>
                )}
                <button
                  disabled={restartLoading}
                  onClick={async () => {
                    if (!confirm('Restart the backend server? It will be unavailable for ~3 seconds.')) return;
                    setRestartLoading(true);
                    setRestartStatus(null);
                    try {
                      const res = await fetch(`${API}/process/restart`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
                      const d = await res.json();
                      setRestartStatus({ type: 'success', msg: d.message });
                    } catch {
                      setRestartStatus({ type: 'error', msg: 'Request failed — server may already be restarting.' });
                    } finally {
                      setRestartLoading(false);
                      setTimeout(() => setRestartStatus(null), 6000);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                >
                  {restartLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  Restart Server
                </button>
              </div>

              {/* Maintenance Mode card */}
              <div className={`col-span-1 sm:col-span-2 border rounded-xl p-4 space-y-4 ${maintForm.isActive ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className={`w-3.5 h-3.5 ${maintForm.isActive ? 'text-red-500' : 'text-gray-400'}`} /> Maintenance Mode
                  </h3>
                  {maintenance && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      maintenance.effectivelyActive ? 'bg-red-100 text-red-700 animate-pulse' :
                      maintenance.scheduledStart    ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {maintenance.effectivelyActive ? '🔴 ACTIVE' : maintenance.scheduledStart ? '⏰ Scheduled' : '✅ Inactive'}
                    </span>
                  )}
                </div>

                {maintStatus && (
                  <div className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium ${maintStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {maintStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    {maintStatus.msg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Immediate toggle */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Immediate Toggle</label>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setMaintForm(f => ({ ...f, isActive: !f.isActive }))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${maintForm.isActive ? 'bg-red-500' : 'bg-gray-200'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${maintForm.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                      <span className={`text-xs font-bold ${maintForm.isActive ? 'text-red-600' : 'text-gray-500'}`}>
                        {maintForm.isActive ? 'MAINTENANCE ON' : 'System Normal'}
                      </span>
                    </div>
                    {maintForm.isActive && (
                      <p className="text-[10px] text-red-600 font-medium">⚠ All non-dev/admin staff will see maintenance screen immediately.</p>
                    )}
                  </div>

                  {/* Message */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Display Message</label>
                    <textarea
                      value={maintForm.message}
                      onChange={e => setMaintForm(f => ({ ...f, message: e.target.value }))}
                      rows={2}
                      placeholder="System is under maintenance. Please try again later."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                    />
                  </div>

                  {/* Scheduled start */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Scheduled Start (optional)</label>
                    <input
                      type="datetime-local"
                      value={maintForm.scheduledStart}
                      onChange={e => setMaintForm(f => ({ ...f, scheduledStart: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>

                  {/* Scheduled end */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Scheduled End (optional)</label>
                    <input
                      type="datetime-local"
                      value={maintForm.scheduledEnd}
                      onChange={e => setMaintForm(f => ({ ...f, scheduledEnd: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-400"
                    />
                  </div>
                </div>

                <button
                  onClick={saveMaintenance}
                  disabled={maintSaving}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 ${maintForm.isActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
                >
                  {maintSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                  {maintForm.isActive ? 'Activate Maintenance Mode' : 'Save / Deactivate'}
                </button>
              </div>
            </div>
          )}

          {/* ── HOTELS / ACCESS CONTROL ───────────────────────────────── */}
          {tab === 'ACCESS' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Manage hotel status and manager assignments across all properties.</p>
              {hotels.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">{loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'No hotels found.'}</div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-100">
                          <th className="px-4 py-3 text-left">Hotel</th>
                          <th className="px-4 py-3 text-left">Owner</th>
                          <th className="px-4 py-3 text-left">Manager</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {hotels.map(h => (
                          <tr key={h._id} className={`hover:bg-gray-50 transition-colors ${h.status === 'SUSPENDED' ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">{h.name}</div>
                              <div className="text-gray-400 text-[10px]">{h.city || h.address}</div>
                            </td>
                            <td className="px-4 py-3">
                              {h.owner ? (
                                <>
                                  <div className="font-medium text-gray-700">{h.owner.name}</div>
                                  <div className="text-gray-400 text-[10px]">{h.owner.email}</div>
                                </>
                              ) : <span className="text-gray-400">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {h.manager ? (
                                <>
                                  <div className="font-medium text-gray-700">{h.manager.name}</div>
                                  <div className="text-gray-400 text-[10px]">{h.manager.email}</div>
                                </>
                              ) : <span className="text-gray-400 italic">No manager</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                h.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                h.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                              }`}>{h.status}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 justify-end">
                                {h.status !== 'SUSPENDED' ? (
                                  <button
                                    onClick={() => runConfirmed('Suspend Hotel', `Suspend "${h.name}"? The guest portal will return "not found" for this hotel.`, true, () => devPatch(`/hotels/${h._id}/suspend`, { suspended: true }))}
                                    className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded text-[10px] font-bold hover:bg-yellow-100 transition"
                                  ><PauseCircle className="w-3 h-3" /> Suspend</button>
                                ) : (
                                  <button
                                    onClick={() => runConfirmed('Reactivate Hotel', `Reactivate "${h.name}"?`, false, () => devPatch(`/hotels/${h._id}/suspend`, { suspended: false }))}
                                    className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-[10px] font-bold hover:bg-green-100 transition"
                                  ><PlayCircle className="w-3 h-3" /> Reactivate</button>
                                )}
                                {h.manager && (
                                  <button
                                    onClick={() => runConfirmed('Remove Manager', `Remove ${h.manager.name} as manager of "${h.name}"? They can be reassigned later.`, true, () => devDelete(`/hotels/${h._id}/manager`))}
                                    className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 text-red-600 rounded text-[10px] font-bold hover:bg-red-100 transition"
                                  ><UserX className="w-3 h-3" /> Remove Mgr</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── USERS ─────────────────────────────────────────────────── */}
          {tab === 'USERS' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">All staff accounts (SUPER_ADMIN excluded). Suspend or force-logout any user.</p>
              {/* Role filter pills */}
              {['ALL', 'PROPERTY_OWNER', 'HOTEL_MANAGER', 'DEVELOPER'].map(role => {
                const count = role === 'ALL' ? users.length : users.filter(u => u.role === role).length;
                return (
                  <span key={role} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 mr-1">
                    {role === 'ALL' ? 'All' : role.replace('_', ' ')} <span className="font-black">{count}</span>
                  </span>
                );
              })}
              {users.filter(u => u.isVerified === false).length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 mr-1">
                  ⏳ Pending Verification <span className="font-black">{users.filter(u => u.isVerified === false).length}</span>
                </span>
              )}
              {users.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">{loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'No users found.'}</div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-100">
                          <th className="px-4 py-3 text-left">User</th>
                          <th className="px-4 py-3 text-left">Role</th>
                          <th className="px-4 py-3 text-left">Assigned To</th>
                          <th className="px-4 py-3 text-left">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {users.map(u => (
                          <tr key={u._id} className={`hover:bg-gray-50 transition-colors ${u.suspended ? 'opacity-60' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">{u.name}</div>
                              <div className="text-gray-400 text-[10px]">{u.email}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                u.role === 'PROPERTY_OWNER' ? 'bg-indigo-100 text-indigo-700' :
                                u.role === 'HOTEL_MANAGER' ? 'bg-blue-100 text-blue-700' :
                                'bg-violet-100 text-violet-700'
                              }`}>{u.role.replace(/_/g, ' ')}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {u.assignedProperty?.name || (u.role === 'PROPERTY_OWNER' ? `≤${u.maxHotelsAllowed} hotels` : '—')}
                            </td>
                            <td className="px-4 py-3">
                              {u.isVerified === false ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600">
                                  <AlertTriangle className="w-3 h-3" /> Pending Verification
                                </span>
                              ) : (
                                <span className={`flex items-center gap-1 text-[10px] font-bold ${u.suspended ? 'text-red-600' : 'text-green-600'}`}>
                                  {u.suspended ? <PauseCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                  {u.suspended ? 'Suspended' : 'Active'}
                                </span>
                              )}
                              {u.suspended && u.suspendedReason && <div className="text-[10px] text-red-400 mt-0.5">{u.suspendedReason}</div>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                {u.isVerified === false && (
                                  <button
                                    onClick={() => runConfirmed('Approve Account', `Approve ${u.name}'s account without requiring OTP verification?`, false, () => devPatch(`/users/${u._id}/approve`, {}))}
                                    className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-[10px] font-bold hover:bg-amber-100 transition"
                                  ><CheckCircle className="w-3 h-3" /> Approve</button>
                                )}
                                {u.isVerified !== false && u.suspended ? (
                                  <button
                                    onClick={() => runConfirmed('Reactivate User', `Restore access for ${u.name}?`, false, () => devPatch(`/users/${u._id}/suspend`, { suspended: false }))}
                                    className="flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 text-green-700 rounded text-[10px] font-bold hover:bg-green-100 transition"
                                  ><PlayCircle className="w-3 h-3" /> Reactivate</button>
                                ) : u.isVerified !== false ? (
                                  <button
                                    onClick={() => runConfirmed('Suspend User', `Suspend ${u.name}? They will be logged out immediately.`, true, () => devPatch(`/users/${u._id}/suspend`, { suspended: true }))}
                                    className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded text-[10px] font-bold hover:bg-yellow-100 transition"
                                  ><PauseCircle className="w-3 h-3" /> Suspend</button>
                                ) : null}
                                <button
                                  onClick={() => runConfirmed('Force Logout', `Revoke session for ${u.name}? Their current access token will expire within 2h.`, false, () => devDelete(`/users/${u._id}/session`))}
                                  className="flex items-center gap-1 px-2 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded text-[10px] font-bold hover:bg-gray-100 transition"
                                ><LogOut className="w-3 h-3" /> Logout</button>
                                <button
                                  onClick={() => {
                                    const pwd = prompt(`New password for ${u.name} (min 6 chars):`);
                                    if (!pwd || pwd.length < 6) return;
                                    runConfirmed('Reset Password', `Reset password for ${u.name}?`, true, () => devPatch(`/users/${u._id}/reset-password`, { newPassword: pwd }));
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 text-red-600 rounded text-[10px] font-bold hover:bg-red-100 transition"
                                ><KeyRound className="w-3 h-3" /> Pwd</button>
                                <button
                                  onClick={() => {
                                    setEditingUser(u);
                                    setEditUserForm({ name: u.name, email: u.email, role: u.role });
                                    setEditUserStatus(null);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 bg-violet-50 border border-violet-200 text-violet-700 rounded text-[10px] font-bold hover:bg-violet-100 transition"
                                ><Edit2 className="w-3 h-3" /> Edit</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── CLEANUP ───────────────────────────────────────────────── */}
          {tab === 'CLEANUP' && (
            <div className="space-y-6">
              <p className="text-xs text-gray-400">One-click cleanup tools to reclaim database storage.</p>

              {actionStatus && (
                <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${actionStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {actionStatus.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {actionStatus.msg}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Upload tokens */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-violet-500" /> Upload Tokens</h3>
                    <button onClick={() => { fetchCleanup(); }} className="p-1 rounded hover:bg-gray-100 text-gray-400"><RefreshCw className="w-3 h-3" /></button>
                  </div>
                  {cleanupStats ? (
                    <>
                      <div className="flex gap-4 text-xs">
                        <div><span className="text-gray-400">Total:</span> <span className="font-bold text-gray-900">{fmt(cleanupStats.totalTokens)}</span></div>
                        <div><span className="text-gray-400">Expired:</span> <span className={`font-bold ${cleanupStats.expiredTokens > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmt(cleanupStats.expiredTokens)}</span></div>
                      </div>
                      <button
                        disabled={cleanupStats.expiredTokens === 0}
                        onClick={() => runConfirmed('Purge Expired Tokens', `Delete ${cleanupStats.expiredTokens} expired upload token(s)?`, false, async () => {
                          const res = await fetch(`${API}/cleanup/tokens`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
                          const d = await res.json();
                          if (!res.ok) throw new Error(d.message);
                          return d.message;
                        })}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg text-xs font-bold transition"
                      ><Trash2 className="w-3.5 h-3.5" /> Purge {cleanupStats.expiredTokens} Expired Token(s)</button>
                    </>
                  ) : <div className="text-xs text-gray-400">Loading…</div>}
                </div>

                {/* Request logs */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-blue-500" /> Request Logs</h3>
                    <button onClick={fetchCleanup} className="p-1 rounded hover:bg-gray-100 text-gray-400"><RefreshCw className="w-3 h-3" /></button>
                  </div>
                  {cleanupStats ? (
                    <>
                      <div className="flex gap-4 text-xs">
                        <div><span className="text-gray-400">Total:</span> <span className="font-bold text-gray-900">{fmt(cleanupStats.totalLogs)}</span></div>
                        <div><span className="text-gray-400">&gt;30d old:</span> <span className={`font-bold ${cleanupStats.oldLogs30d > 0 ? 'text-yellow-600' : 'text-green-600'}`}>{fmt(cleanupStats.oldLogs30d)}</span></div>
                      </div>
                      <button
                        disabled={cleanupStats.oldLogs30d === 0}
                        onClick={() => runConfirmed('Purge Old Logs', `Delete ${cleanupStats.oldLogs30d} log entries older than 30 days?`, false, async () => {
                          const res = await fetch(`${API}/logs/purge?days=30`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } });
                          const d = await res.json();
                          if (!res.ok) throw new Error(d.message);
                          return d.message;
                        })}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-lg text-xs font-bold transition"
                      ><Trash2 className="w-3.5 h-3.5" /> Purge {cleanupStats.oldLogs30d} Old Log(s)</button>
                    </>
                  ) : <div className="text-xs text-gray-400">Loading…</div>}
                </div>
              </div>

              <p className="text-[10px] text-gray-400">Logs have a 30-day TTL index — MongoDB auto-purges them. Manual cleanup here frees storage immediately.</p>
            </div>
          )}

          {/* ── SUPPORT TICKETS ───────────────────────────────────────── */}
          {tab === 'SUPPORT' && (
            <div className="space-y-4">
              {/* Stat summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total',       val: tickets.length,                                               color: 'gray' },
                  { label: 'Open',        val: tickets.filter(t => t.status === 'OPEN').length,              color: 'yellow' },
                  { label: 'In Progress', val: tickets.filter(t => t.status === 'IN_PROGRESS').length,       color: 'blue' },
                  { label: 'Resolved',    val: tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length, color: 'green' },
                ].map(s => (
                  <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-100 rounded-xl p-3 text-center`}>
                    <div className={`text-xl font-black text-${s.color}-700`}>{s.val}</div>
                    <div className={`text-[10px] font-bold text-${s.color}-500 uppercase tracking-wider`}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Filter bar */}
              <div className="flex flex-wrap gap-2">
                <select value={ticketFilter.status} onChange={e => applyTicketFilter({ status: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-violet-400 font-medium text-gray-700">
                  <option value="">All Status</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <select value={ticketFilter.priority} onChange={e => applyTicketFilter({ priority: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-violet-400 font-medium text-gray-700">
                  <option value="">All Priority</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
                <select value={ticketFilter.category} onChange={e => applyTicketFilter({ category: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-violet-400 font-medium text-gray-700">
                  <option value="">All Categories</option>
                  <option value="BUG_REPORT">Bug Report</option>
                  <option value="TECHNICAL_ISSUE">Technical Issue</option>
                  <option value="FEATURE_REQUEST">Feature Request</option>
                  <option value="BILLING">Billing</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Ticket list */}
              {tickets.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : (
                    <><CheckCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p>No tickets found. All clear!</p></>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {tickets.map((t, idx) => {
                    const isExpanded = expandedTicketId === t._id;
                    return (
                      <div key={t._id} className={`border-b border-gray-100 last:border-0 ${isExpanded ? 'bg-violet-50/30' : ''}`}>
                        {/* Row */}
                        <button
                          onClick={() => expandTicket(t)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-start gap-3"
                        >
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-900 truncate">{t.subject}</span>
                              {t.priority === 'URGENT' && <span className="text-[10px] font-black text-red-600 animate-pulse">🚨 URGENT</span>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${TICKET_STATUS_STYLE[t.status] || 'bg-gray-100 text-gray-600'}`}>
                                {t.status.replace('_', ' ')}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${TICKET_PRIORITY_STYLE[t.priority] || 'bg-gray-100 text-gray-600'}`}>
                                {t.priority}
                              </span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${CAT_STYLE[t.category] || 'bg-gray-100 text-gray-600'}`}>
                                {t.category.replace(/_/g, ' ')}
                              </span>
                              {t.property && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Building2 className="w-2.5 h-2.5" />{t.property.name}</span>}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                              <span className="font-medium text-gray-600">{t.raisedBy?.name || 'Unknown'}</span>
                              <span>·</span>
                              <span className="uppercase">{t.raisedBy?.role?.replace(/_/g, ' ')}</span>
                              <span>·</span>
                              <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                              {t.replies?.length > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />{t.replies.length} repl{t.replies.length === 1 ? 'y' : 'ies'}</span>}
                            </div>
                          </div>
                          <div className={`shrink-0 text-gray-400 mt-0.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-4 border-t border-violet-100 bg-white">
                            {/* Description */}
                            <div className="pt-3">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</div>
                              <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 whitespace-pre-wrap">{t.description}</div>
                            </div>

                            {/* Status + resolution update */}
                            <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 space-y-3">
                              <div className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Update Ticket</div>
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Status</label>
                                  <select value={ticketStatusEdit} onChange={e => setTicketStatusEdit(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-violet-400">
                                    <option value="OPEN">Open</option>
                                    <option value="IN_PROGRESS">In Progress</option>
                                    <option value="RESOLVED">Resolved</option>
                                    <option value="CLOSED">Closed</option>
                                  </select>
                                </div>
                                <div className="flex-1 min-w-50">
                                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Resolution Note (optional)</label>
                                  <input
                                    value={ticketResolution}
                                    onChange={e => setTicketResolution(e.target.value)}
                                    placeholder="Brief note about how this was resolved..."
                                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-violet-400"
                                  />
                                </div>
                                <button
                                  onClick={() => updateTicket(t._id)}
                                  disabled={ticketActionLoading}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                                >
                                  {ticketActionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                  Save
                                </button>
                              </div>
                            </div>

                            {/* Existing resolution note */}
                            {expandedTicketDetail?.resolutionNote && (
                              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs">
                                <div className="font-bold text-green-700 flex items-center gap-1 mb-1"><CheckCircle className="w-3.5 h-3.5" /> Resolution Note</div>
                                <p className="text-green-800">{expandedTicketDetail.resolutionNote}</p>
                                {expandedTicketDetail.resolvedAt && (
                                  <p className="text-green-500 text-[10px] mt-1">Resolved {new Date(expandedTicketDetail.resolvedAt).toLocaleDateString()}</p>
                                )}
                              </div>
                            )}

                            {/* Reply thread */}
                            {expandedTicketDetail === null ? (
                              <div className="text-center py-3 text-gray-400 text-xs"><RefreshCw className="w-3.5 h-3.5 animate-spin inline mr-1" />Loading replies…</div>
                            ) : expandedTicketDetail.replies?.length > 0 ? (
                              <div className="space-y-2">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversation ({expandedTicketDetail.replies.length})</div>
                                {expandedTicketDetail.replies.map((r, i) => {
                                  const isDev = ['DEVELOPER', 'SUPER_ADMIN'].includes(r.fromRole);
                                  return (
                                    <div key={i} className={`rounded-xl p-3 text-xs ${isDev ? 'bg-violet-50 border border-violet-100' : 'bg-gray-50 border border-gray-100'}`}>
                                      <div className={`font-bold text-[10px] mb-1 flex items-center gap-1.5 ${isDev ? 'text-violet-700' : 'text-gray-600'}`}>
                                        {isDev ? <Terminal className="w-2.5 h-2.5" /> : <MessageSquare className="w-2.5 h-2.5" />}
                                        {r.fromUser?.name || 'User'} · {r.fromRole?.replace(/_/g, ' ')}
                                        <span className="text-[9px] text-gray-400 ml-auto font-normal">{timeAgo(r.createdAt)}</span>
                                      </div>
                                      <p className="text-gray-800 whitespace-pre-wrap">{r.message}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 text-center py-2">No replies yet — be the first to respond.</div>
                            )}

                            {/* Reply box */}
                            <div className="space-y-2">
                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reply as Developer</div>
                              <textarea
                                value={ticketReply}
                                onChange={e => setTicketReply(e.target.value)}
                                placeholder="Write your response to the reporter..."
                                rows={2}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                              />
                              <button
                                onClick={() => sendTicketReply(t._id)}
                                disabled={!ticketReply.trim() || ticketActionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                              >
                                {ticketActionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                Send Reply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── DB BROWSE ─────────────────────────────────────────── */}
          {tab === 'DB_BROWSE' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400">Browse raw MongoDB documents. Passwords and refresh tokens are hidden. Deletion only allowed on <code className="bg-gray-100 px-1 rounded">logs</code> and <code className="bg-gray-100 px-1 rounded">uploadtokens</code>.</p>

              {/* Controls */}
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={dbBrowseCol}
                  onChange={e => {
                    setDbBrowseCol(e.target.value);
                    setDbBrowseSearch('');
                    setDbBrowseOffset(0);
                    setDbBrowseExpanded(null);
                    fetchDbBrowse(e.target.value, 0, '');
                  }}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-violet-400 font-medium text-gray-700"
                >
                  <option value="users">users</option>
                  <option value="properties">properties</option>
                  <option value="bookings">bookings</option>
                  <option value="logs">logs</option>
                  <option value="uploadtokens">uploadtokens</option>
                  <option value="maintenancemodes">maintenancemodes</option>
                </select>
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 flex-1 min-w-48">
                  <Search className="w-3 h-3 text-gray-400 shrink-0" />
                  <input
                    value={dbBrowseSearch}
                    onChange={e => setDbBrowseSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setDbBrowseOffset(0); fetchDbBrowse(dbBrowseCol, 0, dbBrowseSearch); } }}
                    placeholder="Search by name, email, ID…"
                    className="bg-transparent text-xs outline-none flex-1 text-gray-700"
                  />
                </div>
                <button
                  onClick={() => { setDbBrowseOffset(0); fetchDbBrowse(dbBrowseCol, 0, dbBrowseSearch); }}
                  disabled={dbBrowseLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition"
                >
                  {dbBrowseLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Search
                </button>
              </div>

              <p className="text-xs text-gray-400">{fmt(dbBrowseTotal)} documents · showing {dbBrowseDocs.length}</p>

              {/* Documents */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                {dbBrowseDocs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">
                    {dbBrowseLoading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : 'No documents found. Click Search to load.'}
                  </div>
                ) : dbBrowseDocs.map((doc, i) => {
                  const isExpanded = dbBrowseExpanded === i;
                  const title = doc.name || doc.guestName || doc.email || doc.guestEmail || doc.subject || doc.route || String(doc._id);
                  const sub = doc.email || doc.guestEmail || doc.status || doc.type || '';
                  const isDeletable = ['logs', 'uploadtokens'].includes(dbBrowseCol);
                  return (
                    <div key={i}>
                      <button
                        onClick={() => setDbBrowseExpanded(isExpanded ? null : i)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition"
                      >
                        <span className="font-mono text-[10px] text-gray-300 w-6 shrink-0">{dbBrowseOffset + i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-800 truncate">{title}</div>
                          {sub && <div className="text-[10px] text-gray-400 truncate">{sub}</div>}
                        </div>
                        <span className="font-mono text-[10px] text-gray-300 shrink-0">{String(doc._id).slice(-6)}</span>
                        {isDeletable && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              runConfirmed('Delete Document', `Delete this ${dbBrowseCol} document?`, true, async () => {
                                const res = await fetch(`${API}/db/${dbBrowseCol}/${doc._id}`, {
                                  method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
                                });
                                const d = await res.json();
                                if (!res.ok) throw new Error(d.message);
                                fetchDbBrowse();
                                return d.message;
                              });
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded text-[10px] font-bold hover:bg-red-100 transition shrink-0"
                          ><Trash className="w-2.5 h-2.5" /></button>
                        )}
                        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                      {isExpanded && (
                        <div className="bg-gray-900 px-4 py-3 border-t border-gray-100">
                          <pre className="text-green-300 text-[10px] font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-80">
                            {JSON.stringify(doc, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {dbBrowseTotal > 20 && (
                <div className="flex items-center gap-3 justify-center text-xs">
                  <button disabled={dbBrowseOffset === 0}
                    onClick={() => { const o = Math.max(0, dbBrowseOffset - 20); fetchDbBrowse(dbBrowseCol, o, dbBrowseSearch); }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 font-medium">← Prev</button>
                  <span className="text-gray-400">{dbBrowseOffset + 1}–{Math.min(dbBrowseOffset + 20, dbBrowseTotal)} of {fmt(dbBrowseTotal)}</span>
                  <button disabled={dbBrowseOffset + 20 >= dbBrowseTotal}
                    onClick={() => { const o = dbBrowseOffset + 20; fetchDbBrowse(dbBrowseCol, o, dbBrowseSearch); }}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 font-medium">Next →</button>
                </div>
              )}
            </div>
          )}

          {/* ── ENV VARIABLES ────────────────────────────────────────── */}
          {tab === 'ENV' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Current <code className="bg-gray-100 px-1 rounded">process.env</code> values. Sensitive keys are partially masked. This is read-only — edit <code className="bg-gray-100 px-1 rounded">.env</code> on the server then restart.</p>
                {envVars && (
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${envVars.nodeEnv === 'production' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      NODE_ENV: {envVars.nodeEnv}
                    </span>
                    <button
                      onClick={() => setEnvRevealAll(v => !v)}
                      className="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-[10px] font-bold text-gray-600 transition"
                    >
                      {envRevealAll ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {envRevealAll ? 'Hide' : 'Show all'}
                    </button>
                  </div>
                )}
              </div>

              {!envVars ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wider border-b border-gray-100">
                          <th className="px-4 py-3 text-left">Variable</th>
                          <th className="px-4 py-3 text-left">Value</th>
                          <th className="px-4 py-3 text-center">Set</th>
                          <th className="px-4 py-3 text-center">Sensitive</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {envVars.vars.map((v, i) => (
                          <tr key={i} className={`hover:bg-gray-50 ${!v.isSet ? 'opacity-50' : ''}`}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{v.key}</td>
                            <td className="px-4 py-2.5 font-mono text-gray-600 max-w-xs truncate">
                              {!v.isSet ? (
                                <span className="text-red-400 italic">(not set)</span>
                              ) : v.sensitive && !envRevealAll ? (
                                <span className="text-gray-400">{v.display}</span>
                              ) : (
                                <span className="text-green-700">{v.display}</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {v.isSet
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />
                                : <X className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {v.sensitive
                                ? <Shield className="w-3.5 h-3.5 text-orange-400 mx-auto" />
                                : <span className="text-gray-300 text-[10px]">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 space-y-1">
                <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> To change an env variable:</p>
                <p>1. SSH into your EC2 server with your PEM key</p>
                <p>2. Run <code className="bg-amber-100 px-1 rounded">nano ~/backend/.env</code> and edit the value</p>
                <p>3. Click <strong>Restart Server</strong> in the System tab (or run <code className="bg-amber-100 px-1 rounded">pm2 restart all</code>)</p>
              </div>
            </div>
          )}

          {/* Loading placeholder */}
          {loading && !overview && !logs.length && (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading data…
            </div>
          )}

          {/* Global action status toast */}
          {actionStatus && tab !== 'CLEANUP' && (
            <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${actionStatus.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
              {actionStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {actionStatus.msg}
            </div>
          )}

          {/* Edit User modal */}
          {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-violet-600" /> Edit User
                  </h3>
                  <button onClick={() => setEditingUser(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
                </div>

                {editUserStatus && (
                  <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg font-medium ${editUserStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {editUserStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    {editUserStatus.msg}
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Name</label>
                    <input value={editUserForm.name} onChange={e => setEditUserForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Email</label>
                    <input type="email" value={editUserForm.email} onChange={e => setEditUserForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Role</label>
                    <select value={editUserForm.role} onChange={e => setEditUserForm(f => ({ ...f, role: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                      <option value="PROPERTY_OWNER">Property Owner</option>
                      <option value="HOTEL_MANAGER">Hotel Manager</option>
                      <option value="DEVELOPER">Developer</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button onClick={() => setEditingUser(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition">Cancel</button>
                  <button
                    disabled={editUserSaving}
                    onClick={async () => {
                      setEditUserSaving(true);
                      setEditUserStatus(null);
                      try {
                        const res = await fetch(`${API}/users/${editingUser._id}/profile`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
                          body: JSON.stringify(editUserForm)
                        });
                        const d = await res.json();
                        if (res.ok) {
                          setEditUserStatus({ type: 'success', msg: d.message });
                          fetchUsers();
                          setTimeout(() => setEditingUser(null), 1200);
                        } else {
                          setEditUserStatus({ type: 'error', msg: d.message });
                        }
                      } finally { setEditUserSaving(false); }
                    }}
                    className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2"
                  >
                    {editUserSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Save
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Confirm modal */}
          {confirmAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <h3 className="text-sm font-bold text-gray-900">{confirmAction.label}</h3>
                <p className="text-sm text-gray-600">{confirmAction.desc}</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmAction(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition">Cancel</button>
                  <button
                    onClick={confirmAction.onConfirm}
                    disabled={confirmLoading}
                    className={`flex-1 py-2 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${confirmAction.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}`}
                  >
                    {confirmLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ErrorCard({ log, type }) {
  const [expanded, setExpanded] = useState(false);
  const isError = type === 'error';
  return (
    <div className={`border rounded-xl overflow-hidden ${isError ? 'border-red-200 bg-red-50/40' : 'border-yellow-200 bg-yellow-50/40'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left hover:bg-black/5 transition"
      >
        <div className={`mt-0.5 shrink-0 ${isError ? 'text-red-500' : 'text-yellow-500'}`}>
          {isError ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {log.method && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${METHOD_COLOR[log.method] || 'bg-gray-100 text-gray-600'}`}>
                {log.method}
              </span>
            )}
            <span className="font-mono text-xs text-gray-700 truncate">{log.route}</span>
            {log.statusCode && <span className={`font-bold text-xs ${statusBadge(log.statusCode)}`}>{log.statusCode}</span>}
            <span className="text-[10px] text-gray-400 ml-auto shrink-0">{timeAgo(log.createdAt)}</span>
          </div>
          <p className="text-xs text-gray-600 mt-0.5 truncate">{log.message}</p>
        </div>
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>
      {expanded && (
        <div className="bg-gray-900 px-4 py-3 text-[11px] font-mono space-y-1">
          <div><span className="text-gray-500">ip: </span><span className="text-green-300">{log.ip}</span></div>
          <div><span className="text-gray-500">device: </span><span className="text-green-300">{log.device} · {log.os} · {log.browser}</span></div>
          <div><span className="text-gray-500">userId: </span><span className="text-green-300">{log.userId || 'anonymous'}</span></div>
          <div><span className="text-gray-500">responseTime: </span><span className="text-green-300">{fmtTime(log.responseTime)}</span></div>
          {log.stack && (
            <div className="mt-2 border-t border-gray-700 pt-2">
              <span className="text-red-400">stack trace:</span>
              <pre className="text-red-300 text-[10px] whitespace-pre-wrap break-all mt-1">{log.stack}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoGroup({ title, icon: Icon, rows, statusField }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" /> {title}
      </h3>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-gray-400 font-medium">{label}</span>
            <span className={`font-semibold ${
              statusField === label
                ? value === 'Connected' ? 'text-green-600' : 'text-red-600'
                : 'text-gray-800'
            }`}>{String(value ?? '—')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  Shield, UserPlus, Building2, Mail, Lock, Users, Activity, Globe, Search,
  Calendar, Filter, IndianRupee, Loader2, Terminal, CheckCircle, Edit2,
  Trash2, AlertTriangle, X, Eye, EyeOff, PauseCircle, PlayCircle, RefreshCw
} from 'lucide-react';

const API = 'http://localhost:5000/api';
const authHeader = () => ({ 'Authorization': `Bearer ${localStorage.getItem('hotel_auth_token')}`, 'Content-Type': 'application/json' });

// ── small modal wrapper ────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function StatusMsg({ s }) {
  if (!s?.message) return null;
  const cls = s.type === 'success' ? 'bg-green-50 text-green-700' : s.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700';
  return <div className={`p-3 rounded-lg text-xs font-bold ${cls}`}>{s.message}</div>;
}

// ── password field with show/hide ──────────────────────────────────────────
function PasswordInput({ name, value, onChange, placeholder = '', minLength = 6 }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minLength={minLength}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-9 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
      />
      <button type="button" onClick={() => setShow(v => !v)} className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('TENANTS');

  // ── Create owner form ────────────────────────────────────────────────────
  const [formData, setFormData]   = useState({ name: '', email: '', password: '', maxHotelsAllowed: 1 });
  const [createStatus, setCreateStatus] = useState({ type: '', message: '' });
  const [owners, setOwners]       = useState([]);
  const [isOwnersLoading, setIsOwnersLoading] = useState(true);

  // ── Edit owner modal ─────────────────────────────────────────────────────
  const [editOwner, setEditOwner] = useState(null); // owner object being edited
  const [editForm, setEditForm]   = useState({ name: '', email: '', maxHotelsAllowed: 1, password: '' });
  const [editStatus, setEditStatus] = useState({ type: '', message: '' });

  // ── Suspend modal ────────────────────────────────────────────────────────
  const [suspendTarget, setSuspendTarget] = useState(null); // { user, type: 'OWNER'|'DEV' }
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);

  // ── Delete confirm modal ─────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name, type }
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Developer accounts ───────────────────────────────────────────────────
  const [devForm, setDevForm]   = useState({ name: '', email: '', password: '' });
  const [devStatus, setDevStatus] = useState({ type: '', message: '' });
  const [developers, setDevelopers] = useState([]);
  const [isDevsLoading, setIsDevsLoading] = useState(false);
  const [editDev, setEditDev]   = useState(null);
  const [editDevForm, setEditDevForm] = useState({ name: '', email: '', password: '' });
  const [editDevStatus, setEditDevStatus] = useState({ type: '', message: '' });

  // ── Global bookings ──────────────────────────────────────────────────────
  const [bookings, setBookings] = useState([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);
  const [filters, setFilters]   = useState({ search: '', status: 'ALL', startDate: '', endDate: '' });

  // ════════════════════════════════════════════════════════════
  // FETCH
  // ════════════════════════════════════════════════════════════
  const fetchOwners = async () => {
    try {
      const res = await fetch(`${API}/admin/owners`, { headers: authHeader() });
      if (res.ok) setOwners(await res.json());
    } finally { setIsOwnersLoading(false); }
  };

  const fetchDevelopers = async () => {
    setIsDevsLoading(true);
    try {
      const res = await fetch(`${API}/admin/developers`, { headers: authHeader() });
      if (res.ok) setDevelopers(await res.json());
    } finally { setIsDevsLoading(false); }
  };

  const fetchGlobalBookings = async () => {
    setIsBookingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      const res = await fetch(`${API}/bookings/all?${params}`, { headers: authHeader() });
      if (res.ok) setBookings(await res.json());
    } finally { setIsBookingsLoading(false); }
  };

  useEffect(() => { fetchOwners(); }, []);
  useEffect(() => {
    if (activeTab === 'BOOKINGS') fetchGlobalBookings();
    if (activeTab === 'DEVELOPERS') fetchDevelopers();
  }, [activeTab]);

  // ════════════════════════════════════════════════════════════
  // CREATE OWNER
  // ════════════════════════════════════════════════════════════
  const handleCreateOwner = async (e) => {
    e.preventDefault();
    setCreateStatus({ type: 'loading', message: 'Creating owner...' });
    try {
      const res = await fetch(`${API}/admin/create-owner`, { method: 'POST', headers: authHeader(), body: JSON.stringify(formData) });
      const d = await res.json();
      if (res.ok) {
        setCreateStatus({ type: 'success', message: `${d.owner.email} provisioned.` });
        setFormData({ name: '', email: '', password: '', maxHotelsAllowed: 1 });
        fetchOwners();
      } else setCreateStatus({ type: 'error', message: d.message });
    } catch { setCreateStatus({ type: 'error', message: 'Connection failed.' }); }
  };

  // ════════════════════════════════════════════════════════════
  // EDIT OWNER
  // ════════════════════════════════════════════════════════════
  const openEditOwner = (owner) => {
    setEditOwner(owner);
    setEditForm({ name: owner.name, email: owner.email, maxHotelsAllowed: owner.maxHotelsAllowed, password: '' });
    setEditStatus({ type: '', message: '' });
  };

  const handleEditOwner = async (e) => {
    e.preventDefault();
    setEditStatus({ type: 'loading', message: 'Saving...' });
    const payload = { name: editForm.name, email: editForm.email, maxHotelsAllowed: editForm.maxHotelsAllowed };
    if (editForm.password) payload.password = editForm.password;
    try {
      const res = await fetch(`${API}/admin/owners/${editOwner._id}`, { method: 'PATCH', headers: authHeader(), body: JSON.stringify(payload) });
      const d = await res.json();
      if (res.ok) {
        setEditStatus({ type: 'success', message: 'Updated successfully.' });
        fetchOwners();
        setTimeout(() => setEditOwner(null), 800);
      } else setEditStatus({ type: 'error', message: d.message });
    } catch { setEditStatus({ type: 'error', message: 'Connection failed.' }); }
  };

  // ════════════════════════════════════════════════════════════
  // SUSPEND / UNSUSPEND
  // ════════════════════════════════════════════════════════════
  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setSuspendLoading(true);
    const { user, type } = suspendTarget;
    const willSuspend = !user.suspended;
    const endpoint = type === 'OWNER'
      ? `${API}/admin/owners/${user._id}/suspend`
      : `${API}/developer/users/${user._id}/suspend`;
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH', headers: authHeader(),
        body: JSON.stringify({ suspended: willSuspend, reason: suspendReason })
      });
      if (res.ok) {
        setSuspendTarget(null); setSuspendReason('');
        if (type === 'OWNER') fetchOwners(); else fetchDevelopers();
      }
    } finally { setSuspendLoading(false); }
  };

  // ════════════════════════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════════════════════════
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const url = deleteTarget.type === 'OWNER'
      ? `${API}/admin/owners/${deleteTarget.id}`
      : `${API}/admin/developers/${deleteTarget.id}`;
    try {
      const res = await fetch(url, { method: 'DELETE', headers: authHeader() });
      if (res.ok) {
        setDeleteTarget(null);
        if (deleteTarget.type === 'OWNER') fetchOwners(); else fetchDevelopers();
      }
    } finally { setDeleteLoading(false); }
  };

  // ════════════════════════════════════════════════════════════
  // CREATE DEVELOPER
  // ════════════════════════════════════════════════════════════
  const handleCreateDeveloper = async (e) => {
    e.preventDefault();
    setDevStatus({ type: 'loading', message: 'Creating...' });
    try {
      const res = await fetch(`${API}/admin/create-developer`, { method: 'POST', headers: authHeader(), body: JSON.stringify(devForm) });
      const d = await res.json();
      if (res.ok) {
        setDevStatus({ type: 'success', message: `${d.developer.email} created.` });
        setDevForm({ name: '', email: '', password: '' });
        fetchDevelopers();
      } else setDevStatus({ type: 'error', message: d.message });
    } catch { setDevStatus({ type: 'error', message: 'Connection failed.' }); }
  };

  // ════════════════════════════════════════════════════════════
  // EDIT DEVELOPER
  // ════════════════════════════════════════════════════════════
  const openEditDev = (dev) => {
    setEditDev(dev);
    setEditDevForm({ name: dev.name, email: dev.email, password: '' });
    setEditDevStatus({ type: '', message: '' });
  };

  const handleEditDev = async (e) => {
    e.preventDefault();
    setEditDevStatus({ type: 'loading', message: 'Saving...' });
    const payload = { name: editDevForm.name, email: editDevForm.email };
    if (editDevForm.password) payload.password = editDevForm.password;
    try {
      const res = await fetch(`${API}/admin/developers/${editDev._id}`, { method: 'PATCH', headers: authHeader(), body: JSON.stringify(payload) });
      const d = await res.json();
      if (res.ok) {
        setEditDevStatus({ type: 'success', message: 'Updated.' });
        fetchDevelopers();
        setTimeout(() => setEditDev(null), 700);
      } else setEditDevStatus({ type: 'error', message: d.message });
    } catch { setEditDevStatus({ type: 'error', message: 'Connection failed.' }); }
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  const tabCls = (t) => `px-5 py-3 text-sm font-bold flex items-center border-b-2 transition-colors ${activeTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Shield className="w-6 h-6 text-indigo-600 mr-2" /> Super Admin Command Center
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage tenant subscriptions and oversee global SaaS operations.</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-200 mb-8 overflow-x-auto">
        <button onClick={() => setActiveTab('TENANTS')} className={tabCls('TENANTS')}><Users className="w-4 h-4 mr-2" /> Tenant Management</button>
        <button onClick={() => setActiveTab('BOOKINGS')} className={tabCls('BOOKINGS')}><Globe className="w-4 h-4 mr-2" /> Global Bookings</button>
        <button onClick={() => setActiveTab('DEVELOPERS')} className={tabCls('DEVELOPERS')}><Terminal className="w-4 h-4 mr-2" /> Developer Accounts</button>
      </div>

      {/* ══ TENANTS ══════════════════════════════════════════════════════════ */}
      {activeTab === 'TENANTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Create form */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                <h2 className="text-xs font-bold text-gray-900 flex items-center uppercase tracking-wider">
                  <UserPlus className="w-4 h-4 text-gray-500 mr-2" /> New Tenant
                </h2>
              </div>
              <form onSubmit={handleCreateOwner} className="p-5 space-y-4">
                <StatusMsg s={createStatus} />
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Mail className="w-3 h-3 mr-1 text-gray-400" /> Email</label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Building2 className="w-3 h-3 mr-1 text-gray-400" /> Max Hotels</label>
                  <input type="number" min="1" required value={formData.maxHotelsAllowed} onChange={e => setFormData({ ...formData, maxHotelsAllowed: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50 text-indigo-900 font-bold" />
                </div>
                <div>
                  <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Lock className="w-3 h-3 mr-1 text-gray-400" /> Temporary Password</label>
                  <PasswordInput name="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                </div>
                <button type="submit" disabled={createStatus.type === 'loading'} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
                  {createStatus.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Provision Account
                </button>
              </form>
            </div>
          </div>

          {/* Owner table */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h2 className="text-xs font-bold text-gray-900 flex items-center uppercase tracking-wider"><Users className="w-4 h-4 text-gray-500 mr-2" /> Property Owners</h2>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">{owners.length} Total</span>
                  <button onClick={fetchOwners} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                      <th className="px-5 py-4 font-semibold">Owner</th>
                      <th className="px-5 py-4 font-semibold">Hotels</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {isOwnersLoading ? (
                      <tr><td colSpan="4" className="px-5 py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" /> Loading...</td></tr>
                    ) : owners.length === 0 ? (
                      <tr><td colSpan="4" className="px-5 py-8 text-center text-gray-400">No owners yet.</td></tr>
                    ) : owners.map(owner => (
                      <tr key={owner._id} className={`hover:bg-gray-50 transition-colors ${owner.suspended ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="font-bold text-gray-900">{owner.name}</div>
                          <div className="text-xs text-gray-500">{owner.email}</div>
                          {owner.suspended && <div className="text-[10px] text-red-500 font-bold mt-0.5">SUSPENDED · {owner.suspendedReason}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-md text-xs flex items-center w-max">
                            <Building2 className="w-3 h-3 mr-1" /> {owner.maxHotelsAllowed}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`flex items-center text-xs font-bold ${owner.suspended ? 'text-red-500' : 'text-green-600'}`}>
                            {owner.suspended ? <PauseCircle className="w-3 h-3 mr-1" /> : <Activity className="w-3 h-3 mr-1" />}
                            {owner.suspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => openEditOwner(owner)} title="Edit" className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { setSuspendTarget({ user: owner, type: 'OWNER' }); setSuspendReason(''); }} title={owner.suspended ? 'Reactivate' : 'Suspend'} className={`p-1.5 rounded-lg transition ${owner.suspended ? 'hover:bg-green-50 text-green-600' : 'hover:bg-yellow-50 text-yellow-600'}`}>
                              {owner.suspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setDeleteTarget({ id: owner._id, name: owner.name, type: 'OWNER' })} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ GLOBAL BOOKINGS ══════════════════════════════════════════════════ */}
      {activeTab === 'BOOKINGS' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <form onSubmit={e => { e.preventDefault(); fetchGlobalBookings(); }} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Search Guest</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input type="text" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Name or phone..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div className="w-full md:w-44">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                <div className="relative">
                  <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="w-full pl-9 pr-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">
                    <option value="ALL">All</option>
                    <option value="PENDING_ASSIGNMENT">Pending Room</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CHECKED_IN">Checked In</option>
                    <option value="CHECKED_OUT">Checked Out</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>
              <div className="w-full md:w-38">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">From</label>
                <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="w-full md:w-38">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">To</label>
                <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <button type="submit" className="w-full md:w-auto px-6 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-bold shadow-sm transition-colors">Apply</button>
            </form>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-175">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-5 py-4">Ref</th>
                    <th className="px-5 py-4">Property & Room</th>
                    <th className="px-5 py-4">Guest</th>
                    <th className="px-5 py-4">Dates</th>
                    <th className="px-5 py-4">Financials</th>
                    <th className="px-5 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {isBookingsLoading ? (
                    <tr><td colSpan="6" className="py-10 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" /> Querying...</td></tr>
                  ) : bookings.length === 0 ? (
                    <tr><td colSpan="6" className="py-10 text-center text-gray-400">No bookings match.</td></tr>
                  ) : bookings.map(bkg => (
                    <tr key={bkg._id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-mono text-xs font-bold text-indigo-600">{bkg._id.toString().slice(-6).toUpperCase()}</td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900 flex items-center gap-1"><Building2 className="w-3 h-3 text-gray-400" />{bkg.property?.name || '—'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {bkg.assignedRooms?.length > 0 ? bkg.assignedRooms.map(ar => `Room ${ar.room?.roomNumber}`).join(', ') : 'Unassigned'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900">{bkg.guestName}</div>
                        <div className="text-xs text-gray-500">{bkg.guestPhone}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-bold text-gray-700 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(bkg.checkIn).toLocaleDateString()} – {new Date(bkg.checkOut).toLocaleDateString()}</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block ${bkg.bookingType === 'FULL_DAY' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>{bkg.bookingType.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-bold text-gray-900 flex items-center"><IndianRupee className="w-3 h-3 mr-0.5" />{bkg.totalAmount}</div>
                        <div className="text-xs text-gray-500">Adv: ₹{bkg.advancePaid}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          bkg.status === 'PENDING_ASSIGNMENT' ? 'bg-yellow-100 text-yellow-700' :
                          bkg.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                          bkg.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' :
                          bkg.status === 'CHECKED_OUT' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'
                        }`}>{bkg.status.replace(/_/g, ' ')}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ DEVELOPER ACCOUNTS ═══════════════════════════════════════════════ */}
      {activeTab === 'DEVELOPERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                <h2 className="text-xs font-bold text-gray-900 flex items-center uppercase tracking-wider"><Terminal className="w-4 h-4 text-gray-500 mr-2" /> New Developer</h2>
              </div>
              <form onSubmit={handleCreateDeveloper} className="p-5 space-y-4">
                <StatusMsg s={devStatus} />
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                  <input type="text" required value={devForm.name} onChange={e => setDevForm({ ...devForm, name: e.target.value })} placeholder="e.g. John Dev" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Mail className="w-3 h-3 mr-1 text-gray-400" /> Email</label>
                  <input type="email" required value={devForm.email} onChange={e => setDevForm({ ...devForm, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Lock className="w-3 h-3 mr-1 text-gray-400" /> Password (min 8 chars)</label>
                  <PasswordInput name="password" value={devForm.password} onChange={e => setDevForm({ ...devForm, password: e.target.value })} minLength={8} />
                </div>
                <button type="submit" disabled={devStatus.type === 'loading'} className="w-full py-2 bg-gray-900 hover:bg-black disabled:opacity-60 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center gap-2">
                  {devStatus.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                  Create Account
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h2 className="text-xs font-bold text-gray-900 flex items-center uppercase tracking-wider"><Users className="w-4 h-4 text-gray-500 mr-2" /> Developer Accounts</h2>
                <div className="flex items-center gap-2">
                  <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">{developers.length}</span>
                  <button onClick={fetchDevelopers} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><RefreshCw className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                      <th className="px-5 py-4 font-semibold">Developer</th>
                      <th className="px-5 py-4 font-semibold">Joined</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                      <th className="px-5 py-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {isDevsLoading ? (
                      <tr><td colSpan="4" className="py-8 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-1" /> Loading...</td></tr>
                    ) : developers.length === 0 ? (
                      <tr><td colSpan="4" className="py-8 text-center text-gray-400">No developer accounts yet.</td></tr>
                    ) : developers.map(dev => (
                      <tr key={dev._id} className={`hover:bg-gray-50 transition-colors ${dev.suspended ? 'opacity-60' : ''}`}>
                        <td className="px-5 py-4">
                          <div className="font-bold text-gray-900">{dev.name}</div>
                          <div className="text-xs text-gray-500">{dev.email}</div>
                          {dev.suspended && <div className="text-[10px] text-red-500 font-bold mt-0.5">SUSPENDED</div>}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500">{new Date(dev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-5 py-4">
                          <span className={`flex items-center text-xs font-bold ${dev.suspended ? 'text-red-500' : 'text-green-600'}`}>
                            {dev.suspended ? <PauseCircle className="w-3 h-3 mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
                            {dev.suspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => openEditDev(dev)} title="Edit" className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => { setSuspendTarget({ user: dev, type: 'DEV' }); setSuspendReason(''); }} title={dev.suspended ? 'Reactivate' : 'Suspend'} className={`p-1.5 rounded-lg transition ${dev.suspended ? 'hover:bg-green-50 text-green-600' : 'hover:bg-yellow-50 text-yellow-600'}`}>
                              {dev.suspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setDeleteTarget({ id: dev._id, name: dev.name, type: 'DEV' })} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODALS ═══════════════════════════════════════════════════════════ */}

      {/* Edit Owner */}
      {editOwner && (
        <Modal title="Edit Owner Account" onClose={() => setEditOwner(null)}>
          <form onSubmit={handleEditOwner} className="space-y-4">
            <StatusMsg s={editStatus} />
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
              <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Mail className="w-3 h-3 mr-1 text-gray-400" /> Email</label>
              <input type="email" required value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Building2 className="w-3 h-3 mr-1 text-gray-400" /> Max Hotels Allowed</label>
              <input type="number" min="1" required value={editForm.maxHotelsAllowed} onChange={e => setEditForm({ ...editForm, maxHotelsAllowed: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50 font-bold" />
            </div>
            <div>
              <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Lock className="w-3 h-3 mr-1 text-gray-400" /> New Password <span className="text-gray-400 font-normal ml-1">(leave blank to keep current)</span></label>
              <PasswordInput name="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="Leave blank to keep current" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditOwner(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={editStatus.type === 'loading'} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                {editStatus.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Developer */}
      {editDev && (
        <Modal title="Edit Developer Account" onClose={() => setEditDev(null)}>
          <form onSubmit={handleEditDev} className="space-y-4">
            <StatusMsg s={editDevStatus} />
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
              <input type="text" required value={editDevForm.name} onChange={e => setEditDevForm({ ...editDevForm, name: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Mail className="w-3 h-3 mr-1 text-gray-400" /> Email</label>
              <input type="email" required value={editDevForm.email} onChange={e => setEditDevForm({ ...editDevForm, email: e.target.value })} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="flex items-center text-xs font-semibold text-gray-700 mb-1"><Lock className="w-3 h-3 mr-1 text-gray-400" /> New Password <span className="text-gray-400 font-normal ml-1">(min 8 chars)</span></label>
              <PasswordInput name="password" value={editDevForm.password} onChange={e => setEditDevForm({ ...editDevForm, password: e.target.value })} placeholder="Leave blank to keep current" minLength={8} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditDev(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={editDevStatus.type === 'loading'} className="flex-1 py-2 bg-gray-900 hover:bg-black disabled:opacity-60 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                {editDevStatus.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Suspend / Reactivate confirm */}
      {suspendTarget && (
        <Modal title={suspendTarget.user.suspended ? 'Reactivate Account' : 'Suspend Account'} onClose={() => setSuspendTarget(null)}>
          <div className="space-y-4">
            {!suspendTarget.user.suspended ? (
              <>
                <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">Suspending <strong>{suspendTarget.user.name}</strong> will immediately log them out and block future logins.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Reason (shown to user on login)</label>
                  <input type="text" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="e.g. Payment overdue" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 outline-none" />
                </div>
              </>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">Reactivating <strong>{suspendTarget.user.name}</strong> will restore their login access.</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setSuspendTarget(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleSuspend} disabled={suspendLoading} className={`flex-1 py-2 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${suspendTarget.user.suspended ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600'}`}>
                {suspendLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {suspendTarget.user.suspended ? 'Reactivate' : 'Suspend Account'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <Modal title="Confirm Delete" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">Permanently delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  Shield, UserPlus, Building2, Mail, Lock, Users, Activity, Globe, Search,
  Calendar, Filter, IndianRupee, Loader2, Terminal, CheckCircle, Edit2,
  Trash2, AlertTriangle, X, Eye, EyeOff, PauseCircle, PlayCircle, RefreshCw
} from 'lucide-react';

import { API, authHeaders as authHeader, STATUS_BADGE } from '../utils/api.js';

// ── Shared UI primitives ──────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function StatusMsg({ s }) {
  if (!s?.message) return null;
  const styles = {
    success: 'bg-green-50 text-green-700 border-green-200',
    error:   'bg-red-50 text-red-700 border-red-200',
    loading: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium ${styles[s.type] || styles.loading}`}>
      {s.type === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
      {s.message}
    </div>
  );
}

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
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
      />
      <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input
      {...props}
      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('TENANTS');

  const [formData, setFormData]     = useState({ name: '', email: '', password: '', maxHotelsAllowed: 1 });
  const [createStatus, setCreateStatus] = useState({ type: '', message: '' });
  const [owners, setOwners]         = useState([]);
  const [isOwnersLoading, setIsOwnersLoading] = useState(true);

  const [editOwner, setEditOwner]   = useState(null);
  const [editForm, setEditForm]     = useState({ name: '', email: '', maxHotelsAllowed: 1, password: '' });
  const [editStatus, setEditStatus] = useState({ type: '', message: '' });

  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [devForm, setDevForm]       = useState({ name: '', email: '', password: '' });
  const [devStatus, setDevStatus]   = useState({ type: '', message: '' });
  const [developers, setDevelopers] = useState([]);
  const [isDevsLoading, setIsDevsLoading] = useState(false);
  const [editDev, setEditDev]       = useState(null);
  const [editDevForm, setEditDevForm] = useState({ name: '', email: '', password: '' });
  const [editDevStatus, setEditDevStatus] = useState({ type: '', message: '' });

  const [bookings, setBookings]     = useState([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);
  const [filters, setFilters]       = useState({ search: '', status: 'ALL', startDate: '', endDate: '' });

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const fetchOwners = async () => {
    setIsOwnersLoading(true);
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreateOwner = async (e) => {
    e.preventDefault();
    setCreateStatus({ type: 'loading', message: 'Provisioning account…' });
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

  const openEditOwner = (owner) => {
    setEditOwner(owner);
    setEditForm({ name: owner.name, email: owner.email, maxHotelsAllowed: owner.maxHotelsAllowed, password: '' });
    setEditStatus({ type: '', message: '' });
  };

  const handleEditOwner = async (e) => {
    e.preventDefault();
    setEditStatus({ type: 'loading', message: 'Saving…' });
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

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    setSuspendLoading(true);
    const { user, type } = suspendTarget;
    const willSuspend = !user.suspended;
    const endpoint = type === 'OWNER' ? `${API}/admin/owners/${user._id}/suspend` : `${API}/developer/users/${user._id}/suspend`;
    try {
      const res = await fetch(endpoint, { method: 'PATCH', headers: authHeader(), body: JSON.stringify({ suspended: willSuspend, reason: suspendReason }) });
      if (res.ok) {
        setSuspendTarget(null); setSuspendReason('');
        if (type === 'OWNER') fetchOwners(); else fetchDevelopers();
      }
    } finally { setSuspendLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const url = deleteTarget.type === 'OWNER' ? `${API}/admin/owners/${deleteTarget.id}` : `${API}/admin/developers/${deleteTarget.id}`;
    try {
      const res = await fetch(url, { method: 'DELETE', headers: authHeader() });
      if (res.ok) {
        setDeleteTarget(null);
        if (deleteTarget.type === 'OWNER') fetchOwners(); else fetchDevelopers();
      }
    } finally { setDeleteLoading(false); }
  };

  const handleCreateDeveloper = async (e) => {
    e.preventDefault();
    setDevStatus({ type: 'loading', message: 'Creating…' });
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

  const openEditDev = (dev) => {
    setEditDev(dev);
    setEditDevForm({ name: dev.name, email: dev.email, password: '' });
    setEditDevStatus({ type: '', message: '' });
  };

  const handleEditDev = async (e) => {
    e.preventDefault();
    setEditDevStatus({ type: 'loading', message: 'Saving…' });
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

  // ── Tab button ─────────────────────────────────────────────────────────────
  const Tab = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        activeTab === id
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  // ── Card wrapper ───────────────────────────────────────────────────────────
  const Card = ({ children, className = '' }) => (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );

  const CardHeader = ({ title, icon: Icon, badge, action }) => (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {badge != null && (
          <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      {action}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 sm:p-8 max-w-7xl">

      {/* Page header */}
      <div className="mb-7">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
        <p className="text-sm text-gray-500 ml-10">Manage tenants, bookings, and developer accounts.</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-7 overflow-x-auto gap-1">
        <Tab id="TENANTS"    icon={Users}    label="Tenant Management" />
        <Tab id="BOOKINGS"   icon={Globe}    label="Global Bookings" />
        <Tab id="DEVELOPERS" icon={Terminal} label="Developer Accounts" />
      </div>

      {/* ── TENANTS ── */}
      {activeTab === 'TENANTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Create form */}
          <Card>
            <CardHeader title="New Tenant" icon={UserPlus} />
            <form onSubmit={handleCreateOwner} className="p-5 space-y-4">
              <StatusMsg s={createStatus} />
              <FormField label="Full Name">
                <Input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Jane Smith" />
              </FormField>
              <FormField label="Email Address">
                <Input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="jane@hotel.com" />
              </FormField>
              <FormField label="Max Hotels Allowed">
                <Input type="number" min="1" required value={formData.maxHotelsAllowed} onChange={e => setFormData({ ...formData, maxHotelsAllowed: e.target.value })} />
              </FormField>
              <FormField label="Temporary Password">
                <PasswordInput name="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
              </FormField>
              <button
                type="submit"
                disabled={createStatus.type === 'loading'}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {createStatus.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Provision Account
              </button>
            </form>
          </Card>

          {/* Owner table */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                title="Property Owners"
                icon={Users}
                badge={owners.length}
                action={
                  <button onClick={fetchOwners} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-3">Owner</th>
                      <th className="px-6 py-3">Hotels</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {isOwnersLoading ? (
                      <tr><td colSpan="4" className="py-12 text-center text-gray-400 text-sm"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…</td></tr>
                    ) : owners.length === 0 ? (
                      <tr><td colSpan="4" className="py-12 text-center text-gray-400 text-sm">No owners yet.</td></tr>
                    ) : owners.map(owner => (
                      <tr key={owner._id} className={`hover:bg-gray-50/60 transition-colors ${owner.suspended ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{owner.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{owner.email}</p>
                          {owner.suspended && (
                            <p className="text-[10px] text-red-500 font-medium mt-1">Suspended · {owner.suspendedReason}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
                            <Building2 className="w-3 h-3" /> {owner.maxHotelsAllowed}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${owner.suspended ? 'text-red-500' : 'text-emerald-600'}`}>
                            {owner.suspended ? <PauseCircle className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                            {owner.suspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => openEditOwner(owner)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition" title="Edit">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setSuspendTarget({ user: owner, type: 'OWNER' }); setSuspendReason(''); }}
                              className={`p-1.5 rounded-lg transition ${owner.suspended ? 'hover:bg-green-50 text-green-600' : 'hover:bg-amber-50 text-amber-600'}`}
                              title={owner.suspended ? 'Reactivate' : 'Suspend'}
                            >
                              {owner.suspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setDeleteTarget({ id: owner._id, name: owner.name, type: 'OWNER' })} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Delete">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── GLOBAL BOOKINGS ── */}
      {activeTab === 'BOOKINGS' && (
        <div className="space-y-5">
          <Card>
            <div className="p-5">
              <form onSubmit={e => { e.preventDefault(); fetchGlobalBookings(); }} className="flex flex-col md:flex-row gap-3 items-end">
                <div className="flex-1 space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">Search Guest</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input type="text" value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Name or phone…" className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                  </div>
                </div>
                <div className="w-full md:w-44 space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">Status</label>
                  <div className="relative">
                    <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="w-full pl-9 pr-3 py-2.5 border border-gray-300 bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition appearance-none">
                      <option value="ALL">All Statuses</option>
                      <option value="PENDING_ASSIGNMENT">Pending Room</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="CHECKED_IN">Checked In</option>
                      <option value="CHECKED_OUT">Checked Out</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="w-full md:w-40 space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">From</label>
                  <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
                <div className="w-full md:w-40 space-y-1.5">
                  <label className="text-xs font-medium text-gray-500">To</label>
                  <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
                </div>
                <button type="submit" className="w-full md:w-auto px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-semibold transition-colors">
                  Apply
                </button>
              </form>
            </div>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-200">
                <thead>
                  <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-3">Ref</th>
                    <th className="px-6 py-3">Property & Room</th>
                    <th className="px-6 py-3">Guest</th>
                    <th className="px-6 py-3">Dates</th>
                    <th className="px-6 py-3">Financials</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isBookingsLoading ? (
                    <tr><td colSpan="6" className="py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Querying…</td></tr>
                  ) : bookings.length === 0 ? (
                    <tr><td colSpan="6" className="py-12 text-center text-gray-400">No bookings match your filters.</td></tr>
                  ) : bookings.map(bkg => (
                    <tr key={bkg._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">{bkg._id.toString().slice(-6).toUpperCase()}</td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900 flex items-center gap-1.5"><Building2 className="w-3 h-3 text-gray-400" />{bkg.property?.name || '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{bkg.assignedRooms?.length > 0 ? bkg.assignedRooms.map(ar => `Room ${ar.room?.roomNumber}`).join(', ') : 'Unassigned'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{bkg.guestName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{bkg.guestPhone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-medium text-gray-700 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(bkg.checkIn).toLocaleDateString()} – {new Date(bkg.checkOut).toLocaleDateString()}</p>
                        <span className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${bkg.bookingType === 'FULL_DAY' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>{bkg.bookingType.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900 flex items-center text-sm"><IndianRupee className="w-3 h-3 mr-0.5" />{bkg.totalAmount}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Adv: ₹{bkg.advancePaid}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide border ${STATUS_BADGE[bkg.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {bkg.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── DEVELOPERS ── */}
      {activeTab === 'DEVELOPERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader title="New Developer" icon={Terminal} />
            <form onSubmit={handleCreateDeveloper} className="p-5 space-y-4">
              <StatusMsg s={devStatus} />
              <FormField label="Full Name">
                <Input type="text" required value={devForm.name} onChange={e => setDevForm({ ...devForm, name: e.target.value })} placeholder="John Dev" />
              </FormField>
              <FormField label="Email Address">
                <Input type="email" required value={devForm.email} onChange={e => setDevForm({ ...devForm, email: e.target.value })} />
              </FormField>
              <FormField label="Password (min 8 chars)">
                <PasswordInput name="password" value={devForm.password} onChange={e => setDevForm({ ...devForm, password: e.target.value })} minLength={8} />
              </FormField>
              <button
                type="submit"
                disabled={devStatus.type === 'loading'}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {devStatus.type === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                Create Account
              </button>
            </form>
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader
                title="Developer Accounts"
                icon={Users}
                badge={developers.length}
                action={
                  <button onClick={fetchDevelopers} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-3">Developer</th>
                      <th className="px-6 py-3">Joined</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {isDevsLoading ? (
                      <tr><td colSpan="4" className="py-12 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading…</td></tr>
                    ) : developers.length === 0 ? (
                      <tr><td colSpan="4" className="py-12 text-center text-gray-400">No developer accounts yet.</td></tr>
                    ) : developers.map(dev => (
                      <tr key={dev._id} className={`hover:bg-gray-50/60 transition-colors ${dev.suspended ? 'opacity-60' : ''}`}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{dev.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{dev.email}</p>
                          {dev.suspended && <p className="text-[10px] text-red-500 font-medium mt-1">Suspended</p>}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-400">{new Date(dev.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${dev.suspended ? 'text-red-500' : 'text-emerald-600'}`}>
                            {dev.suspended ? <PauseCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            {dev.suspended ? 'Suspended' : 'Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 justify-end">
                            <button onClick={() => openEditDev(dev)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button
                              onClick={() => { setSuspendTarget({ user: dev, type: 'DEV' }); setSuspendReason(''); }}
                              className={`p-1.5 rounded-lg transition ${dev.suspended ? 'hover:bg-green-50 text-green-600' : 'hover:bg-amber-50 text-amber-600'}`}
                            >
                              {dev.suspended ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setDeleteTarget({ id: dev._id, name: dev.name, type: 'DEV' })} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}

      {editOwner && (
        <Modal title="Edit Owner Account" onClose={() => setEditOwner(null)}>
          <form onSubmit={handleEditOwner} className="space-y-4">
            <StatusMsg s={editStatus} />
            <FormField label="Full Name"><Input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></FormField>
            <FormField label="Email Address"><Input type="email" required value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></FormField>
            <FormField label="Max Hotels Allowed"><Input type="number" min="1" required value={editForm.maxHotelsAllowed} onChange={e => setEditForm({ ...editForm, maxHotelsAllowed: e.target.value })} /></FormField>
            <FormField label={<>New Password <span className="font-normal text-gray-400">(leave blank to keep current)</span></>}>
              <PasswordInput name="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="Leave blank to keep current" />
            </FormField>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditOwner(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={editStatus.type === 'loading'} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
                {editStatus.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />} Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editDev && (
        <Modal title="Edit Developer Account" onClose={() => setEditDev(null)}>
          <form onSubmit={handleEditDev} className="space-y-4">
            <StatusMsg s={editDevStatus} />
            <FormField label="Full Name"><Input type="text" required value={editDevForm.name} onChange={e => setEditDevForm({ ...editDevForm, name: e.target.value })} /></FormField>
            <FormField label="Email Address"><Input type="email" required value={editDevForm.email} onChange={e => setEditDevForm({ ...editDevForm, email: e.target.value })} /></FormField>
            <FormField label="New Password (min 8 chars)">
              <PasswordInput name="password" value={editDevForm.password} onChange={e => setEditDevForm({ ...editDevForm, password: e.target.value })} placeholder="Leave blank to keep current" minLength={8} />
            </FormField>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditDev(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">Cancel</button>
              <button type="submit" disabled={editDevStatus.type === 'loading'} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
                {editDevStatus.type === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {suspendTarget && (
        <Modal title={suspendTarget.user.suspended ? 'Reactivate Account' : 'Suspend Account'} onClose={() => setSuspendTarget(null)}>
          <div className="space-y-4">
            {!suspendTarget.user.suspended ? (
              <>
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">Suspending <strong>{suspendTarget.user.name}</strong> will immediately log them out and block future logins.</p>
                </div>
                <FormField label="Reason (shown to user on login)">
                  <Input type="text" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="e.g. Payment overdue" />
                </FormField>
              </>
            ) : (
              <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">Reactivating <strong>{suspendTarget.user.name}</strong> will restore their login access immediately.</p>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setSuspendTarget(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">Cancel</button>
              <button
                onClick={handleSuspend}
                disabled={suspendLoading}
                className={`flex-1 py-2.5 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${suspendTarget.user.suspended ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                {suspendLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {suspendTarget.user.suspended ? 'Reactivate' : 'Suspend Account'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Confirm Delete" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">Permanently delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
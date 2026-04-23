import { useState, useEffect, useRef } from 'react';
import {
  Search, Plus, X, AlertCircle, Building, Loader2, IndianRupee, AlertTriangle,
  Users, Sparkles, CheckCircle2, Globe, QrCode, RefreshCw, ScanLine, Clock, CalendarDays
} from 'lucide-react';

import { API, authHeader as auth, INPUT_CLS, STATUS_BADGE } from '../utils/api.js';

const INITIAL_FORM = {
  guestName: '', guestPhone: '', guestCount: 1,
  bookingType: 'FULL_DAY', checkIn: '', checkOut: '',
  reqType: 'AC', totalAmount: '', advancePaid: '',
  paymentMethod: 'UPI', idProofUrl: '',
};

export default function BookingInflow({ user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookings, setBookings]   = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms]         = useState([]);
  const [activePropertyId, setActivePropertyId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isOverbooked, setIsOverbooked] = useState(false);

  const [qrModal, setQrModal] = useState({ open: false, status: 'idle', token: '', url: '', fileUrl: '', expiresAt: null });
  const [qrImg, setQrImg]     = useState('');
  const qrPollRef = useRef(null);

  const [guestHistory, setGuestHistory] = useState(null);
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);

  const [formData, setFormData] = useState(INITIAL_FORM);


  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        let currentPropId = activePropertyId;
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'PROPERTY_OWNER') {
          if (properties.length === 0) {
            const endpoint = user?.role === 'SUPER_ADMIN'
              ? `${API}/properties`
              : `${API}/properties/my-hotels`;
            const propRes = await fetch(endpoint, { headers: auth() });
            if (propRes.ok) {
              const propData = await propRes.json();
              setProperties(propData);
              if (!currentPropId) {
                currentPropId = user?.role === 'SUPER_ADMIN' ? 'ALL' : (propData.length > 0 ? propData[0]._id : '');
                setActivePropertyId(currentPropId);
              }
            } else if (!currentPropId && user?.role === 'SUPER_ADMIN') {
              currentPropId = 'ALL';
              setActivePropertyId('ALL');
            }
          }
        } else if (user?.role === 'HOTEL_MANAGER') {
          currentPropId = user.assignedProperty;
          setActivePropertyId(currentPropId);
        }

        if (currentPropId === 'ALL') {
          const res = await fetch(`${API}/bookings/all`, { headers: auth() });
          if (res.ok) setBookings(await res.json());
          setRooms([]);
        } else if (currentPropId) {
          const [bkgRes, roomRes] = await Promise.all([
            fetch(`${API}/bookings/property/${currentPropId}`, { headers: auth() }),
            fetch(`${API}/properties/${currentPropId}/rooms`, { headers: auth() }),
          ]);
          if (bkgRes.ok)  setBookings(await bkgRes.json());
          if (roomRes.ok) setRooms(await roomRes.json());
        }
      } catch (e) { console.error(e); }
      finally { setIsLoading(false); }
    };
    fetchData();
  }, [user, activePropertyId, properties.length]);


  useEffect(() => {
    if (!formData.checkIn || !formData.checkOut || rooms.length === 0) { setIsOverbooked(false); return; }
    const start = new Date(formData.checkIn), end = new Date(formData.checkOut);
    if (start >= end) { setIsOverbooked(false); return; }
    const matching   = rooms.filter(r => formData.reqType === 'AC' ? !r.category.includes('NON_AC') : r.category.includes('NON_AC'));
    const overlapping = bookings.filter(b => {
      if (b.status !== 'CONFIRMED' && b.status !== 'CHECKED_IN') return false;
      if (b.reqType !== formData.reqType) return false;
      return new Date(b.checkIn) < end && new Date(b.checkOut) > start;
    });
    setIsOverbooked(matching.length === 0 || overlapping.length >= matching.length);
  }, [formData.checkIn, formData.checkOut, formData.reqType, rooms, bookings]);


  useEffect(() => {
    const phone = formData.guestPhone.trim();
    if (phone.length < 10) { setGuestHistory(null); setIsSearchingGuest(false); return; }
    setIsSearchingGuest(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/bookings/guest/${phone}`, { headers: auth() });
        setGuestHistory(res.ok ? await res.json() : null);
      } catch { setGuestHistory(null); }
      finally { setIsSearchingGuest(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [formData.guestPhone]);

  useEffect(() => () => { if (qrPollRef.current) clearInterval(qrPollRef.current); }, []);


  const handleInput = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const adjustGuests = d => setFormData(p => ({ ...p, guestCount: Math.max(1, p.guestCount + d) }));

  const startQrPoll = (tok) => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    qrPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/public/upload-status/${tok}`);
        const data = await res.json();
        if (data.status === 'UPLOADED') {
          clearInterval(qrPollRef.current);
          setFormData(p => ({ ...p, idProofUrl: data.fileUrl }));
          setQrModal(p => ({ ...p, status: 'done', fileUrl: data.fileUrl }));
        } else if (data.status === 'EXPIRED') {
          clearInterval(qrPollRef.current);
          setQrModal(p => ({ ...p, status: 'expired' }));
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const generateUploadQR = async () => {
    setQrModal({ open: true, status: 'generating', token: '', url: '', fileUrl: '', expiresAt: null });
    setQrImg('');
    try {
      const res = await fetch(`${API}/public/upload-token`, { method: 'POST' });
      const data = await res.json();
      const uploadUrl = `${window.location.origin}/upload-id/${data.token}`;
      const QRCode = await import('qrcode');
      const img = await QRCode.toDataURL(uploadUrl, { width: 256, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } });
      setQrImg(img);
      setQrModal({ open: true, status: 'ready', token: data.token, url: uploadUrl, fileUrl: '', expiresAt: data.expiresAt });
      startQrPoll(data.token);
    } catch { setQrModal(p => ({ ...p, status: 'error' })); }
  };

  const closeQrModal = () => {
    if (qrPollRef.current) clearInterval(qrPollRef.current);
    setQrModal({ open: false, status: 'idle', token: '', url: '', fileUrl: '', expiresAt: null });
  };

  const resetForm = () => setFormData(INITIAL_FORM);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/bookings/create`, {
        method: 'POST',
        headers: { ...auth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, propertyId: activePropertyId }),
      });
      const data = await res.json();
      if (res.ok) {
        const bkgRes = await fetch(`${API}/bookings/property/${activePropertyId}`, { headers: auth() });
        if (bkgRes.ok) setBookings(await bkgRes.json());
        setIsModalOpen(false); setGuestHistory(null); closeQrModal(); setQrImg(''); resetForm();
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch { alert('Failed to connect to server.'); }
  };

  return (
    <div className="p-5 sm:p-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" /> Booking Inflow
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Capture guest details, dates, and payments.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center w-full sm:w-auto gap-2.5">
          {(user?.role === 'PROPERTY_OWNER' || user?.role === 'SUPER_ADMIN') && (
            <select
              value={activePropertyId}
              onChange={e => setActivePropertyId(e.target.value)}
              className="w-full sm:w-auto border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              {user?.role === 'SUPER_ADMIN' && <option value="ALL">All Properties</option>}
              {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={!activePropertyId || activePropertyId === 'ALL'}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> New Booking
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-180">
            <thead>
              <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3.5">Ref</th>
                <th className="px-6 py-3.5">Guest</th>
                <th className="px-6 py-3.5">Dates</th>
                <th className="px-6 py-3.5">Room Type</th>
                <th className="px-6 py-3.5">Financials</th>
                <th className="px-6 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan="6" className="py-16 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Loading bookings…</td></tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <CalendarDays className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No bookings yet</p>
                    </div>
                  </td>
                </tr>
              ) : bookings.map(bkg => (
                <tr key={bkg._id || bkg.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-blue-600">
                    #{(bkg._id || bkg.id).toString().slice(-6).toUpperCase()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{bkg.guestName}</p>
                      {bkg.source === 'ONLINE' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                          <Globe className="w-2.5 h-2.5" /> Online
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Users className="w-3 h-3" /> {bkg.guestCount || 1} {bkg.source === 'ONLINE' ? 'Room' : 'Guest'}{(bkg.guestCount || 1) > 1 ? 's' : ''}
                    </p>
                    {(user?.role === 'SUPER_ADMIN' || activePropertyId === 'ALL') && bkg.property?.name && (
                      <p className="text-[10px] text-indigo-600 font-medium mt-0.5 flex items-center gap-1">
                        <Building className="w-3 h-3" /> {bkg.property.name}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-medium text-gray-700">
                      {new Date(bkg.checkIn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      {' – '}
                      {new Date(bkg.checkOut).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{bkg.bookingType === 'FULL_DAY' ? 'Full Day' : 'Half Day'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${bkg.reqType === 'AC' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {bkg.reqType}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-gray-900 flex items-center text-sm"><IndianRupee className="w-3 h-3 mr-0.5" />{bkg.totalAmount || 0}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Adv ₹{bkg.advancePaid || 0} · {bkg.paymentMethod || 'UPI'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE[bkg.status] || 'bg-gray-100 text-gray-600'}`}>
                      {bkg.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── QR Modal ── */}
      {qrModal.open && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-blue-600" /> Guest ID Upload
              </h3>
              <button onClick={closeQrModal} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 flex flex-col items-center text-center space-y-4">
              {qrModal.status === 'generating' && (
                <div className="py-8 flex flex-col items-center gap-3 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <p className="text-sm">Generating secure QR code…</p>
                </div>
              )}
              {qrModal.status === 'ready' && (
                <>
                  <p className="text-xs text-gray-500">Ask the guest to scan this QR code to upload their ID proof.</p>
                  <div className="p-3 border-2 border-blue-100 rounded-xl bg-white">
                    <img src={qrImg} alt="Upload QR" className="w-52 h-52" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                    <Clock className="w-3.5 h-3.5" /> Expires in 15 minutes · Single-use
                  </div>
                  <div className="w-full">
                    <p className="text-[10px] text-gray-400 mb-1.5">Or share link manually:</p>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                      <span className="text-[10px] text-gray-500 truncate flex-1">{qrModal.url}</span>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(qrModal.url)} className="text-[10px] text-blue-600 font-semibold hover:text-blue-800 shrink-0">Copy</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for upload…
                  </div>
                </>
              )}
              {qrModal.status === 'done' && (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  <div>
                    <h4 className="text-base font-bold text-gray-900">ID Received</h4>
                    <p className="text-sm text-gray-500 mt-1">Guest's ID has been uploaded successfully.</p>
                  </div>
                  {qrModal.fileUrl && (
                    <a href={qrModal.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">View document</a>
                  )}
                  <button onClick={closeQrModal} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition">Done</button>
                </>
              )}
              {qrModal.status === 'expired' && (
                <>
                  <Clock className="w-10 h-10 text-orange-400" />
                  <div>
                    <h4 className="text-base font-bold text-gray-900">QR Expired</h4>
                    <p className="text-sm text-gray-500 mt-1">Generate a new QR code to continue.</p>
                  </div>
                  <button onClick={generateUploadQR} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Generate New QR
                  </button>
                </>
              )}
              {qrModal.status === 'error' && (
                <>
                  <AlertCircle className="w-10 h-10 text-red-400" />
                  <div>
                    <h4 className="text-base font-bold text-gray-900">Generation Failed</h4>
                    <p className="text-sm text-gray-500 mt-1">Could not connect to server. Please retry.</p>
                  </div>
                  <button onClick={generateUploadQR} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Retry
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Booking Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h2 className="text-base font-bold text-gray-900">New Reservation</h2>
              <button onClick={() => { setIsModalOpen(false); setGuestHistory(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-7 overflow-y-auto flex-1">

              {/* Section 1: Guest */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">1 · Guest Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <input type="tel" name="guestPhone" required value={formData.guestPhone} onChange={handleInput} className={INPUT_CLS} placeholder="Phone Number" />
                    {isSearchingGuest && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
                  </div>
                  <input type="text" name="guestName" required value={formData.guestName} onChange={handleInput} className={INPUT_CLS} placeholder="Full Name" />

                  {/* CRM card */}
                  {guestHistory && (
                    <div className="sm:col-span-2 bg-blue-50 border border-blue-100 rounded-xl p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-blue-900 flex items-center gap-1">
                              Returning Guest <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </p>
                            <p className="text-xs text-blue-600">{guestHistory.guestName} · {guestHistory.totalStays} past stay{guestHistory.totalStays > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => setFormData(p => ({ ...p, guestName: guestHistory.guestName }))} className="w-full sm:w-auto bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 transition">
                          Auto-fill
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Number of Guests</p>
                    <div className="flex items-center border border-gray-300 rounded-xl overflow-hidden h-10">
                      <button type="button" onClick={() => adjustGuests(-1)} className="px-4 h-full text-gray-500 bg-gray-50 hover:bg-gray-100 border-r border-gray-300 transition font-medium">−</button>
                      <div className="flex-1 text-center text-sm font-bold text-gray-900">{formData.guestCount}</div>
                      <button type="button" onClick={() => adjustGuests(1)} className="px-4 h-full text-gray-500 bg-gray-50 hover:bg-gray-100 border-l border-gray-300 transition font-medium">+</button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Guest ID</p>
                    {formData.idProofUrl ? (
                      <div className="flex items-center gap-2 border border-emerald-200 bg-emerald-50 rounded-xl px-3 h-10">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-medium text-emerald-700 flex-1 truncate">ID Uploaded</span>
                        <button type="button" onClick={generateUploadQR} className="text-[10px] text-gray-400 hover:text-gray-600 underline">Replace</button>
                      </div>
                    ) : (
                      <button type="button" onClick={generateUploadQR} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 rounded-xl px-3 h-10 text-sm text-blue-600 font-medium hover:bg-blue-50 transition">
                        <QrCode className="w-4 h-4" /> Scan QR to Upload ID
                      </button>
                    )}
                  </div>

                  {formData.guestCount > 2 && (
                    <div className="sm:col-span-2 flex items-start gap-2.5 bg-orange-50 border border-orange-200 p-3 rounded-xl text-xs text-orange-700">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <p><strong>{formData.guestCount} guests</strong> may require multiple rooms or extra mattress adjustments during assignment.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Stay */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">2 · Stay Details</p>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                    {['FULL_DAY', 'HALF_DAY'].map(t => (
                      <button key={t} type="button" onClick={() => setFormData(p => ({ ...p, bookingType: t }))}
                        className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition ${formData.bookingType === t ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        {t === 'FULL_DAY' ? 'Full Day' : 'Half Day'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Check-in</p>
                    <input type={formData.bookingType === 'HALF_DAY' ? 'datetime-local' : 'date'} required name="checkIn" value={formData.checkIn} onChange={handleInput} className={INPUT_CLS} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Check-out</p>
                    <input type={formData.bookingType === 'HALF_DAY' ? 'datetime-local' : 'date'} required name="checkOut" value={formData.checkOut} onChange={handleInput} className={INPUT_CLS} />
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-500 mb-1.5">Room Preference</p>
                    <div className="flex gap-2">
                      {['AC', 'NON_AC'].map(t => (
                        <button key={t} type="button" onClick={() => setFormData(p => ({ ...p, reqType: t }))}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${formData.reqType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {t === 'AC' ? '❄️ AC Room' : '🌬️ Non-AC Room'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Billing */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">3 · Billing & Payment</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Total Amount (₹)</p>
                    <input type="number" min="0" required name="totalAmount" value={formData.totalAmount} onChange={handleInput} className={INPUT_CLS} placeholder="0" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Advance Paid (₹)</p>
                    <input type="number" min="0" required name="advancePaid" value={formData.advancePaid} onChange={handleInput} className={INPUT_CLS} placeholder="0" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Payment Method</p>
                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleInput} className={INPUT_CLS + ' bg-white'}>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                  {isOverbooked && (
                    <div className="sm:col-span-3 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">No Rooms Available</p>
                        <p className="text-xs text-red-600 mt-0.5">All {formData.reqType} rooms are booked for these dates. You can still force-save to the queue.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => { setIsModalOpen(false); setGuestHistory(null); }} className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
                  Cancel
                </button>
                <button type="submit" className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition shadow-sm">
                  {isOverbooked ? 'Force Save Anyway' : 'Save Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
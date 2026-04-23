import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, DoorOpen, DoorClosed, AlertCircle, X, MapPin, Building, Loader2, User, Users, Filter, CalendarDays, Search, CheckCircle, LogOut, Clock, IndianRupee, AlertTriangle, CreditCard, Trash2, Globe, QrCode, RefreshCw, ExternalLink, ScanLine, ShieldCheck } from 'lucide-react';
import { API, authHeader, authHeaders } from '../utils/api.js';

// Reusable confirmation dialog
function ConfirmModal({ title, message, confirmLabel = 'Confirm', confirmClass = 'bg-red-600 hover:bg-red-700', onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onCancel} className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
            Cancel
          </button>
          <button onClick={onConfirm} className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition ${confirmClass}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Inventory({ user }) {
  // --- CORE STATE ---
  const [properties, setProperties] = useState([]);
  const [activePropertyId, setActivePropertyId] = useState('ALL'); 
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  const [rooms, setRooms] = useState([]);
  const [allBookings, setAllBookings] = useState([]); 
  const [activeBookings, setActiveBookings] = useState([]); 
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const [activeAssignment, setActiveAssignment] = useState(null);
  
  // NEW: State to hold multiple rooms and their guest counts
  // Format: { 'roomId1': 2, 'roomId2': 3 }
  const [selectedRooms, setSelectedRooms] = useState({});

  // --- QUEUE UI & SETTLEMENT STATE ---
  const [queueTab, setQueueTab] = useState('ACTIVE'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [checkinBooking, setCheckinBooking] = useState(null);
  const [checkoutBooking, setCheckoutBooking] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { type, booking }

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');

  // --- ID PROOF QR STATE (for online booking check-in) ---
  const [idQr, setIdQr] = useState({ status: 'idle', token: '', qrImg: '', fileUrl: '' });
  // idle | generating | ready | done | error | expired
  const idQrPollRef = useRef(null);

  const [roomForm, setRoomForm] = useState({
    roomNumber: '',
    category: 'DELUXE_AC',
    capacity: 2,
    basePrice: 1500
  });

  // --- 1. FETCH PROPERTIES ON LOAD ---
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const token = localStorage.getItem('hotel_auth_token');
        
        if (user?.role === 'SUPER_ADMIN' || user?.role === 'PROPERTY_OWNER') {
          const endpoint = user?.role === 'SUPER_ADMIN' 
            ? 'http://localhost:5000/api/properties' 
            : 'http://localhost:5000/api/properties/my-hotels';

          const response = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (response.ok) {
            const data = await response.json();
            setProperties(data);
          }
        } else if (user?.role === 'HOTEL_MANAGER') {
          setActivePropertyId(user.assignedProperty);
        }
      } catch (error) {
        console.error("Failed to fetch properties");
      }
    };
    fetchProperties();
  }, [user]);

  // --- 2. FETCH ROOMS & ALL BOOKINGS ---
  const fetchInventoryData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('hotel_auth_token');
      
      const targetPropertyIds = activePropertyId === 'ALL' 
        ? properties.map(p => p._id) 
        : [activePropertyId];

      if (targetPropertyIds.length === 0 && (user?.role === 'PROPERTY_OWNER' || user?.role === 'SUPER_ADMIN')) {
        setIsLoading(false);
        return; 
      }

      let fetchedRooms = [];
      let fetchedAllBookings = [];

      await Promise.all(targetPropertyIds.map(async (propId) => {
        if (!propId) return;

        const [roomRes, bkgRes] = await Promise.all([
          fetch(`http://localhost:5000/api/properties/${propId}/rooms`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`http://localhost:5000/api/bookings/property/${propId}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (roomRes.ok) {
          const rData = await roomRes.json();
          fetchedRooms.push(...rData);
        }
        
        if (bkgRes.ok) {
          const bData = await bkgRes.json();
          fetchedAllBookings.push(...bData);
        }
      }));

      const active = fetchedAllBookings.filter(b => b.status === 'CONFIRMED' || b.status === 'CHECKED_IN');

      setRooms(fetchedRooms);
      setAllBookings(fetchedAllBookings);
      setActiveBookings(active);

    } catch (error) {
      console.error("Failed to fetch inventory data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activePropertyId !== '') {
      fetchInventoryData();
    }
  }, [activePropertyId, properties]);

  // --- 3. FILTERING & UTILITIES ---
  const filteredRooms = rooms.filter(room => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'AC' && !room.category.includes('NON_AC')) return true;
    if (categoryFilter === 'NON_AC' && room.category.includes('NON_AC')) return true;
    return false;
  });

  const getPropertyName = (propId) => {
    const prop = properties.find(p => p._id === propId);
    return prop ? prop.name : 'Unknown Property';
  };

  // HELPER: Gets a comma separated list of room numbers from the new array format
  const getAssignedRoomNumbers = (bkg) => {
    if (bkg.assignedRooms && bkg.assignedRooms.length > 0) {
      return bkg.assignedRooms.map(ar => ar.room?.roomNumber || 'Unknown').join(', ');
    }
    return 'Pending';
  };

  const processedBookings = allBookings
    .filter(bkg => {
      if (queueTab === 'ACTIVE') {
        if (!['PENDING_ASSIGNMENT', 'CHECKED_IN'].includes(bkg.status)) return false;
      } else if (queueTab === 'UPCOMING') {
        if (bkg.status !== 'CONFIRMED') return false;
      } else if (queueTab === 'HISTORY') {
        if (!['CHECKED_OUT', 'CANCELLED'].includes(bkg.status)) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = bkg.guestName?.toLowerCase().includes(q);
        const idMatch = (bkg._id || bkg.id).toString().slice(-6).toLowerCase().includes(q);
        if (!nameMatch && !idMatch) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.status === 'PENDING_ASSIGNMENT' && b.status !== 'PENDING_ASSIGNMENT') return -1;
      if (a.status !== 'PENDING_ASSIGNMENT' && b.status === 'PENDING_ASSIGNMENT') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  // --- QR ID PROOF HELPERS ---
  useEffect(() => () => { if (idQrPollRef.current) clearInterval(idQrPollRef.current); }, []);

  const startIdQrPoll = (token) => {
    if (idQrPollRef.current) clearInterval(idQrPollRef.current);
    idQrPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/public/upload-status/${token}`);
        const data = await res.json();
        if (data.status === 'UPLOADED') {
          clearInterval(idQrPollRef.current);
          setIdQr(prev => ({ ...prev, status: 'done', fileUrl: data.fileUrl }));
        } else if (data.status === 'EXPIRED') {
          clearInterval(idQrPollRef.current);
          setIdQr(prev => ({ ...prev, status: 'expired' }));
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const generateIdQr = async () => {
    setIdQr({ status: 'generating', token: '', qrImg: '', fileUrl: '' });
    try {
      const res = await fetch('http://localhost:5000/api/public/upload-token', { method: 'POST' });
      const data = await res.json();
      const uploadUrl = `${window.location.origin}/upload-id/${data.token}`;
      const QRCode = await import('qrcode');
      const img = await QRCode.toDataURL(uploadUrl, { width: 200, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } });
      setIdQr({ status: 'ready', token: data.token, qrImg: img, fileUrl: '' });
      startIdQrPoll(data.token);
    } catch {
      setIdQr({ status: 'error', token: '', qrImg: '', fileUrl: '' });
    }
  };

  const resetIdQr = (booking) => {
    if (idQrPollRef.current) clearInterval(idQrPollRef.current);
    const hasId = booking?.documentUrl && booking.documentUrl !== 'pending_upload';
    setIdQr({ status: hasId ? 'done' : 'idle', token: '', qrImg: '', fileUrl: hasId ? booking.documentUrl : '' });
  };

  // --- 4. API ACTIONS ---
  const handleAddRoom = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: 'Saving room to database...' });

    try {
      const token = localStorage.getItem('hotel_auth_token');
      const response = await fetch(`http://localhost:5000/api/properties/${activePropertyId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(roomForm)
      });
      
      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: `Room ${data.room.roomNumber} created successfully!` });
        setRoomForm({ ...roomForm, roomNumber: '' }); 
        fetchInventoryData(); 
        setTimeout(() => setIsAddRoomModalOpen(false), 1500); 
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to connect to server.' });
    }
  };

  const openAssignModal = (booking) => {
    setActiveAssignment(booking);
    setSelectedRooms({}); // Reset selections
  };

  // MULTI-ROOM TOGGLE LOGIC
  const toggleRoomSelection = (roomId, isChecked) => {
    if (isChecked) {
      setSelectedRooms(prev => ({ ...prev, [roomId]: 1 })); // Default to 1 guest
    } else {
      setSelectedRooms(prev => {
        const copy = { ...prev };
        delete copy[roomId];
        return copy;
      });
    }
  };

  const updateRoomGuests = (roomId, delta) => {
    setSelectedRooms(prev => ({
      ...prev,
      [roomId]: Math.max(1, prev[roomId] + delta) // Prevent going below 1
    }));
  };

  const confirmAssignment = async () => {
    const selectedRoomIds = Object.keys(selectedRooms);
    if (selectedRoomIds.length === 0) return alert("Please select at least one room!");

    // Format the payload exactly as the new backend route expects
    const assignments = selectedRoomIds.map(roomId => ({
      roomId,
      guestsInRoom: selectedRooms[roomId]
    }));

    try {
      const token = localStorage.getItem('hotel_auth_token');
      const response = await fetch(`http://localhost:5000/api/bookings/${activeAssignment._id}/assign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ assignments }) // Pass the array
      });

      const data = await response.json();

      if (response.ok) {
        setActiveAssignment(null);
        fetchInventoryData(); 
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      alert("Failed to connect to server.");
    }
  };

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      const token = localStorage.getItem('hotel_auth_token');
      const payload = {
        status: newStatus,
        additionalPayment: Number(paymentAmount) || 0,
        paymentMethod: paymentMethod,
        ...(idQr.fileUrl ? { documentUrl: idQr.fileUrl } : {})
      };

      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        fetchInventoryData();
        setCheckinBooking(null);
        setCheckoutBooking(null);
        if (idQrPollRef.current) clearInterval(idQrPollRef.current);
        setIdQr({ status: 'idle', token: '', qrImg: '', fileUrl: '' });
      } else {
        const data = await response.json();
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      alert("Failed to update booking status.");
    }
  };

  const initiateCheckIn = (booking) => {
    setCheckinBooking(booking);
    setPaymentAmount('');
    setPaymentMethod('UPI');
    resetIdQr(booking);
  };

  const initiateCheckout = (booking) => {
    setCheckoutBooking(booking);
    const total = booking.totalAmount || 0;
    const paid = booking.advancePaid || 0;
    const balance = Math.max(0, total - paid);
    setPaymentAmount(balance > 0 ? balance.toString() : '');
    setPaymentMethod('UPI');
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      const token = localStorage.getItem('hotel_auth_token');
      const response = await fetch(`http://localhost:5000/api/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'CANCELLED' })
      });
      if (response.ok) {
        setConfirmAction(null);
        fetchInventoryData();
      } else {
        const data = await response.json();
        alert(`Error: ${data.message}`);
      }
    } catch {
      alert('Failed to cancel booking.');
    }
  };

  return (
    <div className="p-5 sm:p-8 flex flex-col lg:flex-row gap-6 relative min-h-[calc(100vh-56px)] lg:h-[calc(100vh-56px)] lg:overflow-hidden">

      {/* ── Left: Room Grid ── */}
      <div className="flex-1 lg:overflow-y-auto lg:pr-1 lg:pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-blue-600" /> Property Inventory
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage rooms and live assignments.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="flex-1 sm:flex-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              <option value="ALL">All Categories</option>
              <option value="AC">AC Rooms</option>
              <option value="NON_AC">Non-AC Rooms</option>
            </select>
            {(user?.role === 'PROPERTY_OWNER' || user?.role === 'SUPER_ADMIN') && (
              <select
                value={activePropertyId}
                onChange={e => setActivePropertyId(e.target.value)}
                className="flex-1 sm:flex-none border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="ALL">{user?.role === 'SUPER_ADMIN' ? 'All Properties' : 'All My Properties'}</option>
                {properties.map(prop => <option key={prop._id} value={prop._id}>{prop.name}</option>)}
              </select>
            )}
            {(user?.role === 'PROPERTY_OWNER' || user?.role === 'SUPER_ADMIN') && (
              <button
                onClick={() => { setStatus({ type: '', message: '' }); setIsAddRoomModalOpen(true); }}
                disabled={activePropertyId === 'ALL' || !activePropertyId}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Room
              </button>
            )}
          </div>
        </div>

        {/* Room table */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-125">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-3.5">Room</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Status / Occupant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan="3" className="py-16 text-center text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Syncing…</td></tr>
                ) : filteredRooms.length === 0 ? (
                  <tr><td colSpan="3" className="py-16 text-center text-gray-400">No rooms found.</td></tr>
                ) : filteredRooms.map(room => {
                  const occupant = activeBookings.find(b =>
                    b.assignedRooms?.some(ar => (ar.room?._id || ar.room) === room._id)
                  );
                  return (
                    <tr key={room._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900 text-base">{room.roomNumber}</p>
                        {activePropertyId === 'ALL' && (
                          <p className="text-[10px] text-indigo-600 font-medium flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" /> {getPropertyName(room.property)}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${!room.category.includes('NON_AC') ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                          {room.category.replace(/_/g, ' ')}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><Users className="w-3 h-3" /> Max {room.capacity}</p>
                      </td>
                      <td className="px-6 py-4">
                        {room.currentStatus === 'AVAILABLE' && !occupant ? (
                          <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-semibold">
                            <DoorOpen className="w-4 h-4" /> Available
                          </span>
                        ) : (
                          <div>
                            <span className="flex items-center gap-1 text-red-500 text-xs font-bold mb-1">
                              <DoorClosed className="w-3.5 h-3.5" /> Occupied
                            </span>
                            {occupant && (
                              <>
                                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                                  <User className="w-3 h-3 text-gray-400" /> {occupant.guestName}
                                  <span className="text-gray-400 font-normal text-xs">({occupant.guestCount || 1})</span>
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">Leaves: {new Date(occupant.checkOut).toLocaleDateString()}</p>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Right: Booking Queue ── */}
      <div className="w-full lg:w-96 flex flex-col lg:h-full shrink-0">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col max-h-[600px] lg:max-h-none lg:h-full overflow-hidden">

          <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-600" /> Booking Queue
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search guest or ID…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>

          <div className="flex border-b border-gray-100 shrink-0">
            {['ACTIVE', 'UPCOMING', 'HISTORY'].map(t => (
              <button key={t} onClick={() => setQueueTab(t)} className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${queueTab === t ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
            {isLoading ? (
               <div className="text-sm text-center text-gray-400 py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2"/> Syncing...</div>
            ) : processedBookings.length === 0 ? (
              <div className="text-sm text-center text-gray-400 py-4 mt-4">
                {searchQuery ? 'No matching bookings found.' : `Queue is empty for ${queueTab.toLowerCase()}.`}
              </div>
            ) : (
              processedBookings.map(bkg => {
                const assignedRoomStr = getAssignedRoomNumbers(bkg);
                const isPending = bkg.status === 'PENDING_ASSIGNMENT';
                
                const total = bkg.totalAmount || 0;
                const paid = bkg.advancePaid || 0;
                const balanceDue = Math.max(0, total - paid);

                return (
                  <div key={bkg._id} className={`border rounded-xl p-4 shadow-sm transition-all ${isPending ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-sm text-gray-900 flex items-center gap-1.5 flex-wrap">
                        {bkg.guestName}
                        {bkg.source === 'ONLINE' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                            <Globe className="w-2.5 h-2.5 mr-0.5" /> Online
                          </span>
                        )}
                        <span className="text-xs text-gray-400 font-normal">
                          ({bkg.guestCount || 1} {bkg.source === 'ONLINE' ? 'room(s)' : 'guests'})
                        </span>
                      </span>
                        {activePropertyId === 'ALL' && (
                           <span className="text-[10px] font-bold text-indigo-600 flex items-center mt-1">
                             <Building className="w-3 h-3 mr-1" /> {getPropertyName(bkg.property?._id || bkg.property)}
                           </span>
                        )}
                        <span className="text-[10px] text-gray-400 font-mono mt-1 block">ID: {(bkg._id || bkg.id).toString().slice(-6).toUpperCase()}</span>
                      </div>
                      
                      {isPending && <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-yellow-100 text-yellow-800 flex items-center shrink-0 ml-2"><AlertCircle className="w-3 h-3 mr-1" /> Action Req</span>}
                      {bkg.status === 'CONFIRMED' && <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-blue-100 text-blue-700 shrink-0 ml-2">Assigned</span>}
                      {bkg.status === 'CHECKED_IN' && <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-green-100 text-green-700 shrink-0 ml-2">In Room</span>}
                      {bkg.status === 'CHECKED_OUT' && <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-gray-100 text-gray-600 shrink-0 ml-2">Checked Out</span>}
                      {bkg.status === 'CANCELLED' && <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-red-100 text-red-600 shrink-0 ml-2">Cancelled</span>}
                    </div>
                    
                    <div className="text-xs text-gray-500 font-medium mb-3 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {new Date(bkg.checkIn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — {new Date(bkg.checkOut).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 mb-3 flex justify-between items-center text-[11px]">
                      <div className="flex flex-col">
                        <span className="text-gray-400 font-semibold mb-0.5 text-[9px] uppercase tracking-wider">Total</span>
                        <span className="flex items-center font-bold text-gray-700"><IndianRupee className="w-3 h-3 mr-0.5"/> {total}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-gray-400 font-semibold mb-0.5 text-[9px] uppercase tracking-wider">Paid</span>
                        <span className="font-bold text-gray-700">₹{paid}</span>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <span className="text-gray-400 font-semibold mb-0.5 text-[9px] uppercase tracking-wider">Balance</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded ${balanceDue > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {balanceDue > 0 ? `Due: ₹${balanceDue}` : 'Fully Paid'}
                        </span>
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openAssignModal(bkg)}
                          className="flex-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors">
                          <MapPin className="w-3.5 h-3.5 mr-1.5" /> Assign Room(s)
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: 'cancel', booking: bkg })}
                          title="Cancel booking"
                          className="p-2 border border-red-200 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {bkg.status === 'CONFIRMED' && (
                      <div className="flex gap-2">
                        <div className="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 py-2 px-3 rounded-lg flex-1 text-center truncate">
                          Room(s): {assignedRoomStr}
                        </div>
                        <button
                          onClick={() => initiateCheckIn(bkg)}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Check-In
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: 'cancel', booking: bkg })}
                          title="Cancel booking"
                          className="p-2 border border-red-200 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {bkg.status === 'CHECKED_IN' && (
                      <div className="flex flex-col gap-2">
                        <div className="text-xs font-bold text-gray-700 bg-gray-50 border border-gray-200 py-2 px-3 rounded-lg w-full text-center truncate">
                          Room(s): {assignedRoomStr}
                        </div>
                        <button 
                          onClick={() => initiateCheckout(bkg)}
                          className={`w-full text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${balanceDue > 0 ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-800 hover:bg-gray-900'}`}>
                          <LogOut className="w-3.5 h-3.5 mr-1" /> Check-Out
                        </button>
                      </div>
                    )}
                    
                    {(bkg.status === 'CHECKED_OUT' || bkg.status === 'CANCELLED') && (
                       <div className="text-center text-[10px] text-gray-400 font-semibold uppercase tracking-wider py-1 border-t border-gray-100 mt-2">
                         Archived Record
                       </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODAL 1: ADD ROOM (ADMIN & OWNER ONLY)     */}
      {/* ========================================== */}
      {isAddRoomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 bg-gray-50 shrink-0">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Building className="w-5 h-5 mr-2 text-blue-600" /> Add New Room
              </h2>
              <button onClick={() => setIsAddRoomModalOpen(false)} className="p-1"><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <form onSubmit={handleAddRoom} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {status.message && (
                <div className={`p-3 rounded-lg text-xs font-bold ${status.type === 'success' ? 'bg-green-50 text-green-700' : status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                  {status.message}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Room No.</label>
                  <input type="text" required value={roomForm.roomNumber} onChange={(e) => setRoomForm({...roomForm, roomNumber: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. 101" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select value={roomForm.category} onChange={(e) => setRoomForm({...roomForm, category: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="STANDARD_NON_AC">Standard Non-AC</option>
                    <option value="DELUXE_AC">Deluxe AC</option>
                    <option value="PREMIUM_SUITE">Premium Suite</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Capacity</label>
                  <input type="number" min="1" required value={roomForm.capacity} onChange={(e) => setRoomForm({...roomForm, capacity: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Base Price (₹)</label>
                  <input type="number" min="0" required value={roomForm.basePrice} onChange={(e) => setRoomForm({...roomForm, basePrice: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 mt-6">
                <button type="submit" disabled={status.type === 'loading'} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex justify-center items-center">
                  {status.type === 'loading' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DoorOpen className="w-4 h-4 mr-2" />}
                  Save Room to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: ASSIGN ROOM (MULTI-ROOM ENGINE)   */}
      {/* ========================================== */}
      {activeAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900">Assign Rooms to {activeAssignment.guestName}</h2>
              <button onClick={() => setActiveAssignment(null)} className="p-1"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              
              {/* SMART GUEST DISTRIBUTION HEADER */}
              {(() => {
                const totalNeeded = activeAssignment.guestCount || 1;
                const totalAllocated = Object.values(selectedRooms).reduce((acc, val) => acc + val, 0);
                const isMismatch = totalNeeded !== totalAllocated;

                return (
                  <div className={`text-sm p-3 rounded-lg mb-6 border flex items-start ${isMismatch ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-blue-50 text-blue-800 border-blue-100'}`}>
                    <Users className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${isMismatch ? 'text-orange-600' : 'text-blue-600'}`} />
                    <div>
                      <p>Guest requested <strong>{activeAssignment.reqType}</strong> for <strong>{totalNeeded} guest(s)</strong>.</p>
                      <div className="mt-1 font-bold">
                        Allocated: <span className={isMismatch ? 'text-orange-600' : 'text-green-600'}>{totalAllocated}</span> / {totalNeeded}
                      </div>
                      {isMismatch && <p className="text-xs text-orange-600 mt-1">Please distribute exactly {totalNeeded} guests across selected rooms to confirm.</p>}
                    </div>
                  </div>
                );
              })()}

              <label className="block text-sm font-semibold text-gray-700 mb-2">Select & Distribute</label>
              <div className="space-y-2">
                {rooms
                  .filter(r => (r.property?._id || r.property) === (activeAssignment.property?._id || activeAssignment.property))
                  .map(room => {
                  const isCompatible = !room.category.includes('NON_AC') ? activeAssignment.reqType === 'AC' : activeAssignment.reqType === 'NON_AC';
                  const isDisabled = !isCompatible;
                  
                  const isSelected = !!selectedRooms[room._id];
                  const guestsInThisRoom = selectedRooms[room._id] || 0;
                  const needsExtraBed = isSelected && guestsInThisRoom > room.capacity;
                  const extraBedsNeeded = guestsInThisRoom - room.capacity;
                  
                  return (
                    <div key={room._id} className={`flex flex-col p-3 border rounded-lg transition-colors ${isDisabled ? 'opacity-50 bg-gray-50 cursor-not-allowed' : isSelected ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-300'}`}>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center cursor-pointer flex-1">
                          <input 
                            type="checkbox" 
                            disabled={isDisabled} 
                            checked={isSelected} 
                            onChange={(e) => toggleRoomSelection(room._id, e.target.checked)} 
                            className="mr-3 h-4 w-4 text-blue-600 rounded" 
                          />
                          <div>
                            <div className={`text-sm font-bold ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>Room {room.roomNumber}</div>
                            <div className="text-xs text-gray-500">{room.category.replace('_', ' ')} • Cap: {room.capacity}</div>
                          </div>
                        </label>

                        {/* Guest Counter appears only when room is checked */}
                        {isSelected && (
                          <div className="flex items-center bg-white border border-gray-300 rounded overflow-hidden shadow-sm h-8 ml-2">
                            <button type="button" onClick={(e) => { e.preventDefault(); updateRoomGuests(room._id, -1); }} className="px-2 text-gray-500 hover:bg-gray-100 font-bold border-r border-gray-300">-</button>
                            <span className="px-3 text-xs font-bold text-gray-900">{guestsInThisRoom}</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); updateRoomGuests(room._id, 1); }} className="px-2 text-gray-500 hover:bg-gray-100 font-bold border-l border-gray-300">+</button>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 mt-1">
                        {!isCompatible && <span className="text-[10px] text-red-500 font-bold bg-red-50 px-2 py-1 rounded">WRONG TYPE</span>}
                        {needsExtraBed && (
                          <span className="text-[10px] text-orange-700 font-bold bg-orange-100 px-2 py-1 rounded flex items-center">
                            <Plus className="w-3 h-3 mr-0.5" /> {extraBedsNeeded} EXTRA BED{extraBedsNeeded > 1 ? 'S' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl shrink-0 flex justify-end">
              {(() => {
                const totalNeeded = activeAssignment.guestCount || 1;
                const totalAllocated = Object.values(selectedRooms).reduce((acc, val) => acc + val, 0);
                const isValid = totalNeeded === totalAllocated && totalAllocated > 0;

                return (
                  <button 
                    onClick={confirmAssignment} 
                    disabled={!isValid} 
                    className={`w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${isValid ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                  >
                    Confirm Secure Assignment
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 3: CHECK-IN & INITIAL PAYMENT        */}
      {/* ========================================== */}
      {checkinBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <CheckCircle className="w-5 h-5 mr-2 text-green-600" /> Check-In Guest
              </h2>
              <button onClick={() => setCheckinBooking(null)} className="p-1"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="text-center mb-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Guest Arrival</p>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xl font-bold text-gray-900">{checkinBooking.guestName}</p>
                  {checkinBooking.source === 'ONLINE' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                      <Globe className="w-3 h-3 mr-0.5" /> Online
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-600 font-bold mt-1">Room(s) {getAssignedRoomNumbers(checkinBooking)}</p>
                {checkinBooking.guestEmail && (
                  <p className="text-xs text-gray-400 mt-0.5">{checkinBooking.guestEmail} · {checkinBooking.guestPhone}</p>
                )}
              </div>

              {/* ID PROOF SECTION — only for online bookings */}
              {checkinBooking.source === 'ONLINE' && (
                <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 flex items-center gap-2 border-b border-gray-100">
                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Guest ID Proof</span>
                    {idQr.status === 'done' && (
                      <span className="ml-auto text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Verified</span>
                    )}
                    {idQr.status !== 'done' && (
                      <span className="ml-auto text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Pending</span>
                    )}
                  </div>

                  <div className="p-4">
                    {/* Already has ID */}
                    {idQr.status === 'done' && (
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700">ID document received</p>
                          <a href={idQr.fileUrl} target="_blank" rel="noreferrer"
                            className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-0.5">
                            <ExternalLink className="w-3 h-3" /> View uploaded document
                          </a>
                        </div>
                        <button onClick={generateIdQr} className="text-[10px] text-gray-400 hover:text-gray-600 underline shrink-0">Replace</button>
                      </div>
                    )}

                    {/* Idle — no ID yet */}
                    {idQr.status === 'idle' && (
                      <div className="flex flex-col items-center gap-2 py-1 text-center">
                        <p className="text-xs text-gray-500">No ID uploaded. Generate a QR for the guest to scan.</p>
                        <button onClick={generateIdQr}
                          className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition">
                          <QrCode className="w-3.5 h-3.5" /> Generate QR Code
                        </button>
                      </div>
                    )}

                    {/* Generating */}
                    {idQr.status === 'generating' && (
                      <div className="flex items-center justify-center gap-2 py-2 text-indigo-500">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">Generating QR code...</span>
                      </div>
                    )}

                    {/* Ready — show QR */}
                    {idQr.status === 'ready' && (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-2 border border-indigo-100 rounded-lg bg-white">
                          <img src={idQr.qrImg} alt="Upload QR" className="w-36 h-36" />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center">Guest scans this to upload their ID</p>
                        <div className="flex items-center gap-1 text-[10px] text-indigo-500 animate-pulse">
                          <ScanLine className="w-3 h-3" /> Waiting for upload...
                        </div>
                      </div>
                    )}

                    {/* Expired */}
                    {idQr.status === 'expired' && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
                        <p className="text-xs text-gray-500 flex-1">QR expired.</p>
                        <button onClick={generateIdQr} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                          <RefreshCw className="w-3 h-3" /> New QR
                        </button>
                      </div>
                    )}

                    {/* Error */}
                    {idQr.status === 'error' && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-xs text-gray-500 flex-1">Failed to generate QR.</p>
                        <button onClick={generateIdQr} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800">
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(() => {
                const total = checkinBooking.totalAmount || 0;
                const previouslyPaid = checkinBooking.advancePaid || 0;
                const paymentNow = Number(paymentAmount) || 0; 
                const newBalanceDue = Math.max(0, total - previouslyPaid - paymentNow);

                return (
                  <>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 font-medium">Total Bill</span>
                        <span className="font-bold">₹{total}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-3 pb-3 border-b border-gray-200">
                        <span className="text-gray-600 font-medium">Already Paid</span>
                        <span className="font-bold text-green-600">₹{previouslyPaid}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-bold uppercase tracking-wider text-xs">New Balance Due</span>
                        <span className={`text-lg font-black ${newBalanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          ₹{newBalanceDue}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Collect Now (₹)</label>
                        <input 
                          type="number" 
                          min="0"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-green-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Method</label>
                        <select 
                          value={paymentMethod} 
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="UPI">UPI</option>
                          <option value="CASH">Cash</option>
                          <option value="CARD">Card</option>
                        </select>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setCheckinBooking(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition w-full sm:w-auto">Cancel</button>
              <button 
                onClick={() => handleStatusUpdate(checkinBooking._id, 'CHECKED_IN')}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition shadow-sm w-full sm:w-auto flex items-center justify-center">
                <CheckCircle className="w-4 h-4 mr-2" /> Confirm & Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* CONFIRM MODAL: CANCEL BOOKING             */}
      {/* ========================================== */}
      {confirmAction?.type === 'cancel' && (
        <ConfirmModal
          title="Cancel Booking?"
          message={`This will permanently cancel the booking for ${confirmAction.booking.guestName}. This action cannot be undone.`}
          confirmLabel="Yes, Cancel Booking"
          confirmClass="bg-red-600 hover:bg-red-700"
          onConfirm={() => handleCancelBooking(confirmAction.booking._id)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ========================================== */}
      {/* MODAL 4: CHECK-OUT & SETTLEMENT BALANCE    */}
      {/* ========================================== */}
      {checkoutBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 shrink-0">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <LogOut className="w-5 h-5 mr-2 text-gray-600" /> Check-Out Guest
              </h2>
              <button onClick={() => setCheckoutBooking(null)} className="p-1"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="mb-6 text-center">
                <p className="text-sm font-medium text-gray-500 mb-1">Guest Departure</p>
                <p className="text-xl font-bold text-gray-900">{checkoutBooking.guestName}</p>
                <p className="text-xs text-indigo-600 font-bold mt-1">Room(s) {getAssignedRoomNumbers(checkoutBooking)}</p>
              </div>

              {(() => {
                const total = checkoutBooking.totalAmount || 0;
                const previouslyPaid = checkoutBooking.advancePaid || 0;
                const paymentNow = Number(paymentAmount) || 0;
                const newBalanceDue = Math.max(0, total - previouslyPaid - paymentNow);

                return (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 font-medium">Total Bill</span>
                        <span className="font-bold">₹{total}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-3 pb-3 border-b border-gray-200">
                        <span className="text-gray-600 font-medium">Total Paid so far</span>
                        <span className="font-bold text-green-600">₹{previouslyPaid}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-bold uppercase tracking-wider text-xs">Remaining Balance</span>
                        <span className={`text-xl font-black ${newBalanceDue > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          ₹{newBalanceDue}
                        </span>
                      </div>
                    </div>

                    {(total - previouslyPaid) > 0 ? (
                      <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                        <div className="flex items-start mb-3">
                          <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-red-600" />
                          <p className="text-sm font-bold text-red-800">Settle outstanding balance to check out.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-red-800 mb-1">Final Payment (₹)</label>
                            <input 
                              type="number" 
                              min="0"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 bg-white" 
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-red-800 mb-1">Method</label>
                            <select 
                              value={paymentMethod} 
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-red-500"
                            >
                              <option value="UPI">UPI</option>
                              <option value="CASH">Cash</option>
                              <option value="CARD">Card</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-100 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 mr-2 text-green-600" />
                        <span className="font-bold text-sm">Account is fully settled! Ready for check-out.</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setCheckoutBooking(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition w-full sm:w-auto">Cancel</button>
              <button 
                onClick={() => handleStatusUpdate(checkoutBooking._id, 'CHECKED_OUT')}
                className="px-5 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-bold transition shadow-sm w-full sm:w-auto flex items-center justify-center">
                <LogOut className="w-4 h-4 mr-2" /> Confirm & Check-Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
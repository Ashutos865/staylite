import { useState, useEffect, useCallback } from 'react';
import {
  Search, MapPin, Calendar, Users, ArrowLeft, Phone, Mail, Wifi,
  ParkingCircle, Utensils, Waves, CheckCircle, Clock, AlertTriangle,
  CreditCard, Banknote, ChevronRight, Hotel, X, Loader2, ExternalLink,
  BedDouble, AlertCircle
} from 'lucide-react';

const API = 'http://localhost:5000/api/public';

const HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80',
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
  'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80',
];

const ROOM_IMAGES = {
  STANDARD_NON_AC: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80',
  DELUXE_AC:       'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&q=80',
  PREMIUM_SUITE:   'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=600&q=80',
};

const AMENITY_ICONS = { WiFi: Wifi, Parking: ParkingCircle, Restaurant: Utensils, Pool: Waves };
const getHotelImage = (id, photos) => (photos && photos[0]) || HOTEL_IMAGES[parseInt(id.slice(-2), 16) % HOTEL_IMAGES.length];

const STATUS_STYLES = {
  PENDING_ASSIGNMENT: { label: 'Awaiting Room Assignment', color: 'bg-amber-100 text-amber-800' },
  CONFIRMED:          { label: 'Confirmed',                color: 'bg-blue-100 text-blue-700' },
  CHECKED_IN:         { label: 'Checked In',               color: 'bg-green-100 text-green-700' },
  CHECKED_OUT:        { label: 'Checked Out',              color: 'bg-gray-100 text-gray-600' },
  CANCELLED:          { label: 'Cancelled',                color: 'bg-red-100 text-red-700' },
};

const fmtDate   = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtPrice  = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const nightCount = (a, b) => Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));

const updateMeta = (title, desc) => {
  document.title = title;
  const m = document.querySelector('meta[name="description"]');
  if (m) m.setAttribute('content', desc);
};

export default function GuestPortal() {
  const [screen, setScreen]           = useState('HOME');
  const [hotels, setHotels]           = useState([]);
  const [loadingHotels, setLoadingHotels] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // date range for availability check (on hotel detail screen)
  const [availDates, setAvailDates]   = useState({ checkIn: '', checkOut: '' });
  const [availability, setAvailability] = useState([]); // per-category availability
  const [availLoading, setAvailLoading] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [form, setForm] = useState({
    guestName: '', guestPhone: '', guestEmail: '',
    checkIn: '', checkOut: '', roomsRequested: 1,
    bookingType: 'FULL_DAY', reqType: 'NON_AC', paymentMethod: 'CASH'
  });
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmed, setConfirmed]     = useState(null);

  const [trackId, setTrackId]         = useState('');
  const [tracked, setTracked]         = useState(null);
  const [trackError, setTrackError]   = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [showTrack, setShowTrack]     = useState(false);

  // ---- fetch hotels ----
  const fetchHotels = useCallback(async (q = '') => {
    setLoadingHotels(true);
    try {
      const res = await fetch(q ? `${API}/hotels?search=${encodeURIComponent(q)}` : `${API}/hotels`);
      if (res.ok) setHotels(await res.json());
    } catch { /* silent */ }
    finally { setLoadingHotels(false); }
  }, []);

  // ---- fetch availability when dates selected on hotel detail ----
  const fetchAvailability = useCallback(async (hotelId, checkIn, checkOut) => {
    if (!checkIn || !checkOut || checkIn >= checkOut) return;
    setAvailLoading(true);
    try {
      const res = await fetch(`${API}/hotels/${hotelId}/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
      if (res.ok) setAvailability(await res.json());
      else setAvailability([]);
    } catch { setAvailability([]); }
    finally { setAvailLoading(false); }
  }, []);

  // ---- on mount: load hotels + handle Cashfree return ----
  useEffect(() => {
    fetchHotels();
    updateMeta(
      'StayLite Book Hotels Online | Best Prices Guaranteed',
      'Discover and book the best hotels at the best prices. Instant confirmation, secure Cashfree payment.'
    );

    const params = new URLSearchParams(window.location.search);
    const cfOrderId = params.get('cf_order_id');
    const bkId     = params.get('booking_id');
    if (cfOrderId && bkId) verifyAndConfirm(cfOrderId, bkId);
  }, []);

  // ---- availability auto-fetch when dates change on hotel detail ----
  useEffect(() => {
    if (screen === 'HOTEL' && selectedHotel && availDates.checkIn && availDates.checkOut) {
      fetchAvailability(selectedHotel._id, availDates.checkIn, availDates.checkOut);
    }
  }, [availDates, screen, selectedHotel]);

  const verifyAndConfirm = async (orderId, bookingId) => {
    try {
      await fetch(`${API}/payments/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, bookingId })
      });
      const bRes = await fetch(`${API}/bookings/${bookingId}`);
      if (bRes.ok) { setConfirmed(await bRes.json()); setScreen('CONFIRM'); }
      window.history.replaceState({}, '', '/');
    } catch { /* show confirm with partial data */ }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchHotels(searchInput);
    setScreen('HOTELS');
  };

  const openHotel = (hotel) => {
    setSelectedHotel(hotel);
    setAvailability([]);
    setAvailDates({ checkIn: '', checkOut: '' });
    setScreen('HOTEL');
    updateMeta(`${hotel.name} — Book Now | StayLite`, `Book a room at ${hotel.name}, ${hotel.address}.`);
  };

  const getAvailForCategory = (cat) => availability.find(a => a.category === cat.category);

  const openBooking = (hotel, cat) => {
    const avail = getAvailForCategory(cat);
    if (avail?.soldOut) return; // shouldn't happen (button disabled), but guard anyway

    setSelectedHotel(hotel);
    setSelectedCategory(cat);
    setSubmitError('');
    setForm(f => ({
      ...f,
      reqType: cat.reqType,
      checkIn:  availDates.checkIn  || '',
      checkOut: availDates.checkOut || '',
      roomsRequested: 1,
      bookingType: 'FULL_DAY',
    }));
    setScreen('BOOK');
    updateMeta(`Book ${cat.label} at ${hotel.name} — StayLite`, `Reserve a ${cat.label} starting from ${fmtPrice(cat.minPrice)}/night.`);
  };

  // max rooms allowed = available count for that category (if dates searched), else uncapped
  const maxRooms = () => {
    if (!selectedCategory) return 10;
    const avail = availability.find(a => a.category === selectedCategory.category);
    return avail ? avail.available : 10;
  };

  const priceEstimate = () => {
    if (!form.checkIn || !form.checkOut || !selectedCategory) return null;
    return selectedCategory.minPrice * nightCount(form.checkIn, form.checkOut) * (form.roomsRequested || 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, propertyId: selectedHotel._id })
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.message || 'Something went wrong. Please try again.');
        return;
      }
      if (form.paymentMethod === 'CASHFREE') {
        await triggerCashfree(data.bookingId, data.totalAmount);
      } else {
        setConfirmed(data);
        setScreen('CONFIRM');
        updateMeta('Booking Confirmed — StayLite', 'Your hotel booking is confirmed.');
      }
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally { setSubmitting(false); }
  };

  const triggerCashfree = async (bookingId) => {
    try {
      const orderRes = await fetch(`${API}/payments/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId })
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setSubmitError(orderData.message || 'Payment gateway error.'); return; }

      const loadSDK = () => new Promise((resolve) => {
        if (window.Cashfree) { resolve(); return; }
        const s = document.createElement('script');
        s.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
        s.onload = resolve;
        document.head.appendChild(s);
      });
      await loadSDK();
      const cf = window.Cashfree({ mode: orderData.environment === 'PROD' ? 'production' : 'sandbox' });
      cf.checkout({ paymentSessionId: orderData.paymentSessionId, redirectTarget: '_self' });
    } catch { setSubmitError('Could not initiate payment. Please pay at the hotel.'); }
  };

  const handleTrack = async (e) => {
    e.preventDefault();
    if (!trackId.trim()) return;
    setTrackLoading(true); setTrackError(''); setTracked(null);
    try {
      const res = await fetch(`${API}/bookings/${trackId.trim()}`);
      if (res.ok) setTracked(await res.json());
      else { const d = await res.json(); setTrackError(d.message || 'Booking not found.'); }
    } catch { setTrackError('Could not connect. Please try again.'); }
    finally { setTrackLoading(false); }
  };

  // ===========================================================================
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">

      {/* ---- NAVBAR ---- */}
      <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-lg">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between" aria-label="Main navigation">
          <button onClick={() => { setScreen('HOME'); fetchHotels(); updateMeta('StayLite — Book Hotels Online', ''); }}
            className="flex items-center font-bold text-lg tracking-tight" aria-label="StayLite home">
            <Hotel className="w-5 h-5 mr-2 text-indigo-400" />StayLite
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setShowTrack(true)}
              className="hidden sm:flex items-center text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
              <Search className="w-4 h-4 mr-1.5" />Track Booking
            </button>
            <a href="/login"
              className="text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg font-semibold flex items-center transition-colors">
              Staff Login<ExternalLink className="w-3 h-3 ml-1.5 opacity-70" />
            </a>
          </div>
        </nav>
      </header>

      {/* ---- TRACK MODAL ---- */}
      {showTrack && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowTrack(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Track Your Booking</h2>
              <button onClick={() => setShowTrack(false)} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleTrack} className="space-y-3">
              <input type="text" value={trackId} onChange={e => setTrackId(e.target.value)}
                placeholder="Enter booking ID (e.g. 6876AB3C)"
                aria-label="Booking reference ID"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              {trackError && <p className="text-xs text-red-600 font-medium" role="alert">{trackError}</p>}
              <button type="submit" disabled={trackLoading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm flex items-center justify-center disabled:opacity-60 transition-colors">
                {trackLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}Track
              </button>
            </form>
            {tracked && (
              <div className="mt-5 p-4 bg-gray-50 rounded-xl space-y-2 text-sm">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold">{tracked.hotel}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_STYLES[tracked.status]?.color}`}>
                    {STATUS_STYLES[tracked.status]?.label}
                  </span>
                </div>
                <p className="text-gray-500 text-xs">{tracked.hotelAddress}</p>
                <p className="text-gray-700"><Calendar className="w-3.5 h-3.5 inline mr-1" />{fmtDate(tracked.checkIn)} → {fmtDate(tracked.checkOut)}</p>
                <p className="text-gray-700">Ref: <strong className="font-mono">{tracked.bookingRef}</strong> · {fmtPrice(tracked.totalAmount)}</p>
                {tracked.assignedRooms?.length > 0 && (
                  <p className="text-green-700 font-semibold text-xs">Rooms: {tracked.assignedRooms.map(r => r.room?.roomNumber).filter(Boolean).join(', ')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <main>
        {/* ========================================== */}
        {/* HOME                                       */}
        {/* ========================================== */}
        {screen === 'HOME' && (
          <>
            <section className="relative h-[480px] sm:h-[540px] flex items-center justify-center text-white overflow-hidden" aria-label="Hotel search hero">
              <img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=85"
                alt="Luxury hotel with swimming pool" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
              <div className="relative z-10 text-center px-4 w-full max-w-3xl mx-auto">
                <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-3 drop-shadow-lg">Find Your Perfect Stay</h1>
                <p className="text-slate-200 text-base sm:text-lg mb-8 font-light">Browse curated hotels, check live prices, and book in minutes.</p>
                <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl p-2 flex flex-col sm:flex-row gap-2" role="search">
                  <div className="relative flex-1">
                    <MapPin className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" aria-hidden="true" />
                    <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
                      placeholder="City or hotel name..."
                      aria-label="Search hotels"
                      className="w-full pl-10 pr-4 py-3 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-colors">
                    <Search className="w-4 h-4" />Search Hotels
                  </button>
                </form>
              </div>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14" aria-label="Available hotels">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Available Hotels</h2>
                  <p className="text-gray-500 text-sm mt-1">Instant booking confirmation</p>
                </div>
                {loadingHotels && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
              </div>
              {!loadingHotels && hotels.length === 0 && (
                <div className="text-center py-20 text-gray-400">
                  <Hotel className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="font-semibold">No hotels listed yet.</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {hotels.map((hotel, i) => <HotelCard key={hotel._id} hotel={hotel} index={i} onSelect={openHotel} />)}
              </div>
            </section>

            <footer className="bg-slate-900 text-slate-400 py-12 px-4">
              <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
                <div>
                  <div className="flex items-center font-bold text-white text-lg mb-2"><Hotel className="w-5 h-5 mr-2 text-indigo-400" />StayLite</div>
                  <p className="text-sm">Simple, transparent hotel booking. No hidden fees.</p>
                </div>
                <address className="not-italic">
                  <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wider">Contact</h3>
                  <p className="text-sm"><Mail className="w-3.5 h-3.5 inline mr-2" />support@staylite.in</p>
                  <p className="text-sm mt-1"><Phone className="w-3.5 h-3.5 inline mr-2" />1800-XXX-XXXX</p>
                </address>
                <div>
                  <h3 className="font-semibold text-white mb-3 text-sm uppercase tracking-wider">Quick Links</h3>
                  <ul className="text-sm space-y-1">
                    <li><button onClick={() => setShowTrack(true)} className="hover:text-white transition-colors">Track Booking</button></li>
                    <li><a href="/login" className="hover:text-white transition-colors">Staff Login</a></li>
                  </ul>
                </div>
              </div>
              <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-700 text-xs text-center">
                &copy; {new Date().getFullYear()} StayLite. Payments secured by Cashfree Payments.
              </div>
            </footer>
          </>
        )}

        {/* ========================================== */}
        {/* SEARCH RESULTS                             */}
        {/* ========================================== */}
        {screen === 'HOTELS' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
            <button onClick={() => setScreen('HOME')} className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1.5" />Back to Home
            </button>
            <h1 className="text-xl font-bold mb-1">{searchInput ? `Results for "${searchInput}"` : 'All Hotels'}</h1>
            <p className="text-gray-500 text-sm mb-8">{hotels.length} hotel{hotels.length !== 1 ? 's' : ''} found</p>
            {loadingHotels ? (
              <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" /></div>
            ) : hotels.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="font-semibold">No hotels match your search.</p>
                <button onClick={() => { setSearchInput(''); fetchHotels(); }} className="text-indigo-600 text-sm mt-2 underline">View all hotels</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {hotels.map((hotel, i) => <HotelCard key={hotel._id} hotel={hotel} index={i} onSelect={openHotel} />)}
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* HOTEL DETAIL                               */}
        {/* ========================================== */}
        {screen === 'HOTEL' && selectedHotel && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
            <button onClick={() => setScreen('HOME')} className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1.5" />All Hotels
            </button>

            {/* Hotel banner */}
            <div className="rounded-2xl overflow-hidden mb-8 shadow-lg">
              <img src={getHotelImage(selectedHotel._id, selectedHotel.photos)}
                alt={`${selectedHotel.name} hotel`} className="w-full h-56 sm:h-72 object-cover" />
            </div>

            <div className="mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">{selectedHotel.name}</h1>
                  <p className="text-gray-500 flex items-center mt-1.5 text-sm">
                    <MapPin className="w-4 h-4 mr-1 text-indigo-500" />{selectedHotel.address}{selectedHotel.city && `, ${selectedHotel.city}`}
                  </p>
                </div>
                {selectedHotel.contactNumber && (
                  <a href={`tel:${selectedHotel.contactNumber}`}
                    className="flex items-center text-sm font-semibold text-indigo-600 border border-indigo-200 rounded-xl px-4 py-2 hover:bg-indigo-50 transition-colors">
                    <Phone className="w-4 h-4 mr-2" />{selectedHotel.contactNumber}
                  </a>
                )}
              </div>
              {selectedHotel.description && (
                <p className="mt-4 text-gray-600 text-sm leading-relaxed max-w-2xl">{selectedHotel.description}</p>
              )}
              {selectedHotel.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {selectedHotel.amenities.map(a => {
                    const Icon = AMENITY_ICONS[a] || CheckCircle;
                    return (
                      <span key={a} className="flex items-center bg-indigo-50 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                        <Icon className="w-3.5 h-3.5 mr-1.5" />{a}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date search for availability */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-8">
              <h2 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />Check Room Availability
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-indigo-700 mb-1.5">Check-in</label>
                  <input type="date" value={availDates.checkIn} min={new Date().toISOString().split('T')[0]}
                    onChange={e => setAvailDates(d => ({ ...d, checkIn: e.target.value }))}
                    className="w-full border border-indigo-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-indigo-700 mb-1.5">Check-out</label>
                  <input type="date" value={availDates.checkOut} min={availDates.checkIn || new Date().toISOString().split('T')[0]}
                    onChange={e => setAvailDates(d => ({ ...d, checkOut: e.target.value }))}
                    className="w-full border border-indigo-200 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                </div>
                {availLoading && <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mb-2.5" />}
              </div>
              {availDates.checkIn && availDates.checkOut && availability.length > 0 && (
                <p className="text-xs text-indigo-600 mt-2 font-medium">
                  Showing availability for {nightCount(availDates.checkIn, availDates.checkOut)} night(s)
                </p>
              )}
            </div>

            {/* Room assignment notice */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8" role="note">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-amber-800">Room Assignment Notice</p>
                <p className="text-amber-700 mt-0.5">Specific room numbers are assigned by hotel staff after your booking is received. You will be informed at check-in.</p>
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 mb-4">Choose Room Type</h2>
            {selectedHotel.roomCategories?.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-2xl text-gray-400">
                <p className="font-semibold">No rooms configured yet.</p>
                <p className="text-sm mt-1">Contact the hotel directly.</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectedHotel.roomCategories?.map(cat => {
                const avail = getAvailForCategory(cat);
                return (
                  <RoomCard key={cat.category} cat={cat} avail={avail}
                    datesSelected={!!(availDates.checkIn && availDates.checkOut)}
                    onBook={() => openBooking(selectedHotel, cat)} />
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* BOOKING FORM                               */}
        {/* ========================================== */}
        {screen === 'BOOK' && selectedHotel && selectedCategory && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
            <button onClick={() => setScreen('HOTEL')} className="flex items-center text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1.5" />Back to {selectedHotel.name}
            </button>
            <h1 className="text-xl font-bold mb-8">Complete Your Reservation</h1>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5" aria-label="Booking form">

                {/* Guest Details */}
                <fieldset className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <legend className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 px-1">Guest Details</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="guestName">Full Name <span className="text-red-500">*</span></label>
                      <input id="guestName" type="text" required value={form.guestName}
                        onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))} placeholder="As on ID proof"
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="guestPhone">Phone Number <span className="text-red-500">*</span></label>
                      <input id="guestPhone" type="tel" required value={form.guestPhone}
                        onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))} placeholder="+91 XXXXX XXXXX"
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="guestEmail">
                        Email <span className="text-gray-400 font-normal">(optional — for confirmation)</span>
                      </label>
                      <input id="guestEmail" type="email" value={form.guestEmail}
                        onChange={e => setForm(f => ({ ...f, guestEmail: e.target.value }))} placeholder="you@example.com"
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                  </div>
                </fieldset>

                {/* Stay Details */}
                <fieldset className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <legend className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 px-1">Stay Details</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="bkCheckIn">Check-in <span className="text-red-500">*</span></label>
                      <input id="bkCheckIn" type="date" required value={form.checkIn} min={new Date().toISOString().split('T')[0]}
                        onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="bkCheckOut">Check-out <span className="text-red-500">*</span></label>
                      <input id="bkCheckOut" type="date" required value={form.checkOut} min={form.checkIn || new Date().toISOString().split('T')[0]}
                        onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))}
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>

                    {/* ROOMS — not guests */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="roomsReq">
                        Number of Rooms <span className="text-red-500">*</span>
                        {maxRooms() < 10 && (
                          <span className={`ml-2 font-bold ${maxRooms() <= 2 ? 'text-red-600' : 'text-indigo-600'}`}>
                            (max {maxRooms()} available)
                          </span>
                        )}
                      </label>
                      <input id="roomsReq" type="number" min="1" max={maxRooms()} required value={form.roomsRequested}
                        onChange={e => setForm(f => ({ ...f, roomsRequested: Math.min(Number(e.target.value), maxRooms()) }))}
                        className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Duration</label>
                      <select value={form.bookingType} onChange={e => setForm(f => ({ ...f, bookingType: e.target.value }))}
                        className="w-full border border-gray-300 bg-white rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                        <option value="FULL_DAY">Full Day</option>
                        <option value="HALF_DAY">Half Day</option>
                      </select>
                    </div>
                  </div>
                </fieldset>

                {/* Payment */}
                <fieldset className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                  <legend className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 px-1">Payment Method</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'CASH',     Icon: Banknote,    label: 'Pay at Hotel', sub: 'Cash on arrival' },
                      { value: 'CASHFREE', Icon: CreditCard,  label: 'Pay Online',   sub: 'UPI / Card / Net Banking' },
                    ].map(({ value, Icon, label, sub }) => (
                      <label key={value}
                        className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${form.paymentMethod === value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="paymentMethod" value={value} checked={form.paymentMethod === value}
                          onChange={() => setForm(f => ({ ...f, paymentMethod: value }))} className="sr-only" />
                        <Icon className={`w-5 h-5 ${form.paymentMethod === value ? 'text-indigo-600' : 'text-gray-400'}`} />
                        <div>
                          <p className="font-bold text-sm">{label}</p>
                          <p className="text-xs text-gray-500">{sub}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  {form.paymentMethod === 'CASHFREE' && (
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />Secured by Cashfree Payments.
                    </p>
                  )}
                </fieldset>

                {submitError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{submitError}
                  </div>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-colors">
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
                    : form.paymentMethod === 'CASHFREE'
                      ? <><CreditCard className="w-4 h-4" />Pay {priceEstimate() ? fmtPrice(priceEstimate()) : ''} Online</>
                      : <><CheckCircle className="w-4 h-4" />Confirm Booking</>}
                </button>
              </form>

              {/* Summary sidebar */}
              <aside className="lg:col-span-2">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sticky top-24 space-y-4">
                  <h2 className="font-bold text-sm uppercase tracking-wider text-gray-700">Summary</h2>
                  <img src={ROOM_IMAGES[selectedCategory.category]} alt={selectedCategory.label}
                    className="w-full h-36 object-cover rounded-xl" />
                  <div>
                    <p className="font-bold text-gray-900">{selectedHotel.name}</p>
                    <p className="text-xs text-gray-500 flex items-center mt-0.5"><MapPin className="w-3 h-3 mr-1" />{selectedHotel.address}</p>
                  </div>
                  <div className="text-sm space-y-2 border-t border-gray-100 pt-4">
                    <div className="flex justify-between"><span className="text-gray-500">Room Type</span><span className="font-semibold">{selectedCategory.label} ({selectedCategory.tag})</span></div>
                    {form.checkIn  && <div className="flex justify-between"><span className="text-gray-500">Check-in</span><span className="font-semibold">{fmtDate(form.checkIn)}</span></div>}
                    {form.checkOut && <div className="flex justify-between"><span className="text-gray-500">Check-out</span><span className="font-semibold">{fmtDate(form.checkOut)}</span></div>}
                    {form.checkIn && form.checkOut && <div className="flex justify-between"><span className="text-gray-500">Nights</span><span className="font-semibold">{nightCount(form.checkIn, form.checkOut)}</span></div>}
                    <div className="flex justify-between"><span className="text-gray-500">Rooms</span><span className="font-semibold">{form.roomsRequested}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Rate from</span><span className="font-semibold">{fmtPrice(selectedCategory.minPrice)}/night</span></div>
                  </div>
                  {priceEstimate() && (
                    <div className="border-t border-gray-100 pt-4 flex justify-between items-center">
                      <span className="font-bold text-gray-900">Estimated Total</span>
                      <span className="text-xl font-extrabold text-indigo-600">{fmtPrice(priceEstimate())}</span>
                    </div>
                  )}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />Room number assigned by hotel staff at check-in.
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* CONFIRMATION                               */}
        {/* ========================================== */}
        {screen === 'CONFIRM' && confirmed && (
          <div className="max-w-lg mx-auto px-4 py-16 text-center">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Booking Confirmed!</h1>
            <p className="text-gray-500 mb-8">Your reservation has been received. The hotel will assign your room(s).</p>

            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 mb-6 text-left">
              <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider mb-1">Booking Reference</p>
              <p className="text-3xl font-black text-indigo-700 font-mono tracking-widest mb-4">
                {confirmed.bookingRef || confirmed._id?.toString().slice(-8).toUpperCase()}
              </p>
              <div className="space-y-2 text-sm">
                {(confirmed.hotelName || confirmed.hotel) && (
                  <div className="flex justify-between"><span className="text-gray-500">Hotel</span><span className="font-semibold text-right">{confirmed.hotelName || confirmed.hotel}</span></div>
                )}
                {confirmed.checkIn  && <div className="flex justify-between"><span className="text-gray-500">Check-in</span><span className="font-semibold">{fmtDate(confirmed.checkIn)}</span></div>}
                {confirmed.checkOut && <div className="flex justify-between"><span className="text-gray-500">Check-out</span><span className="font-semibold">{fmtDate(confirmed.checkOut)}</span></div>}
                {confirmed.roomsBooked && <div className="flex justify-between"><span className="text-gray-500">Rooms Booked</span><span className="font-semibold">{confirmed.roomsBooked}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-indigo-600">{fmtPrice(confirmed.totalAmount)}</span></div>
                {confirmed.hotelContact && (
                  <div className="flex justify-between"><span className="text-gray-500">Hotel Contact</span>
                    <a href={`tel:${confirmed.hotelContact}`} className="font-semibold text-indigo-600">{confirmed.hotelContact}</a>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 text-left flex items-start gap-2 mb-8">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Carry a valid <strong>Government ID</strong> at check-in. Room(s) will be assigned by hotel staff on arrival.</p>
            </div>

            <p className="text-xs text-gray-400 mb-6">Save this reference number to track your booking status.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => setShowTrack(true)} className="px-6 py-3 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold text-sm transition-colors">Track Booking</button>
              <button onClick={() => { setScreen('HOME'); setConfirmed(null); fetchHotels(); }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors">Book Another Stay</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ---- HOTEL CARD ----
function HotelCard({ hotel, index, onSelect }) {
  const img      = getHotelImage(hotel._id, hotel.photos);
  const minPrice = hotel.roomCategories?.length > 0 ? Math.min(...hotel.roomCategories.map(c => c.minPrice)) : null;
  return (
    <article className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow group cursor-pointer"
      onClick={() => onSelect(hotel)} aria-label={`${hotel.name} — click to view rooms`}>
      <div className="relative h-48 overflow-hidden">
        <img src={img} alt={`${hotel.name}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {hotel.city && (
          <span className="absolute top-3 left-3 bg-white/90 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <MapPin className="w-3 h-3 text-indigo-500" />{hotel.city}
          </span>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold text-gray-900 text-base leading-snug mb-1">{hotel.name}</h3>
        <p className="text-gray-400 text-xs flex items-center mb-3"><MapPin className="w-3 h-3 mr-1" />{hotel.address}</p>
        {hotel.amenities?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {hotel.amenities.slice(0, 3).map(a => (
              <span key={a} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{a}</span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          {minPrice ? (
            <div>
              <span className="text-xs text-gray-400">From</span>
              <p className="font-extrabold text-indigo-600 text-lg leading-none">{fmtPrice(minPrice)}<span className="text-xs font-normal text-gray-400">/night</span></p>
            </div>
          ) : <span className="text-xs text-gray-400">Contact for pricing</span>}
          <span className="flex items-center text-xs font-bold text-indigo-600 group-hover:underline">
            View Rooms<ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </article>
  );
}

// ---- ROOM CARD ----
function RoomCard({ cat, avail, datesSelected, onBook }) {
  const soldOut  = datesSelected && avail?.soldOut;
  const lowStock = datesSelected && avail && !avail.soldOut && avail.available <= 2;

  return (
    <article className={`bg-white rounded-2xl overflow-hidden border shadow-sm transition-shadow ${soldOut ? 'border-gray-200 opacity-70' : 'border-gray-200 hover:shadow-md'}`}
      aria-label={`${cat.label} — ${soldOut ? 'Sold out' : `from ${fmtPrice(cat.minPrice)}/night`}`}>
      <div className="relative">
        <img src={ROOM_IMAGES[cat.category]} alt={`${cat.label} interior`} className="w-full h-40 object-cover" loading="lazy" />
        {soldOut && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-red-600 text-white text-sm font-extrabold px-4 py-2 rounded-xl tracking-wider">FULLY BOOKED</span>
          </div>
        )}
        {lowStock && !soldOut && (
          <span className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
            Only {avail.available} left!
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-gray-900">{cat.label}</h3>
          <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">{cat.tag}</span>
        </div>
        <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
          <BedDouble className="w-3.5 h-3.5" />
          {datesSelected && avail ? (
            soldOut ? <span className="text-red-600 font-semibold">All rooms booked for these dates</span>
              : <span className={lowStock ? 'text-orange-600 font-semibold' : 'text-gray-600'}>
                  {avail.available} of {avail.total} room{avail.total !== 1 ? 's' : ''} available
                </span>
          ) : `${cat.totalRooms} room${cat.totalRooms !== 1 ? 's' : ''} · Up to ${cat.capacity} guests/room`}
        </p>
        <div className="flex items-end justify-between mt-3">
          <div>
            <span className="text-xs text-gray-400">From</span>
            <p className="font-extrabold text-indigo-600 text-xl leading-none">
              {fmtPrice(cat.minPrice)}<span className="text-xs font-normal text-gray-400">/night</span>
            </p>
          </div>
          <button onClick={onBook} disabled={soldOut}
            className={`text-sm font-bold px-4 py-2 rounded-xl transition-colors ${soldOut ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
            {soldOut ? 'Unavailable' : 'Book Now'}
          </button>
        </div>
      </div>
    </article>
  );
}

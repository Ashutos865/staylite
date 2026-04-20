import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Search, X, Loader2,
  IndianRupee, Globe, LogIn, LogOut, BedDouble,
  CalendarDays, Building
} from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_STYLE = {
  PENDING_ASSIGNMENT: 'bg-yellow-100 text-yellow-700',
  CONFIRMED:          'bg-blue-100 text-blue-700',
  CHECKED_IN:        'bg-green-100 text-green-700',
  CHECKED_OUT:       'bg-gray-100 text-gray-500',
  CANCELLED:         'bg-red-100 text-red-600',
};

function getBookingType(booking, date) {
  const d  = new Date(date); d.setHours(0,0,0,0);
  const ci = new Date(booking.checkIn);  ci.setHours(0,0,0,0);
  const co = new Date(booking.checkOut); co.setHours(0,0,0,0);
  if (ci.getTime() === d.getTime()) return 'checkin';
  if (co.getTime() === d.getTime()) return 'checkout';
  return 'staying';
}

function BookingCard({ booking, highlightDate }) {
  const type    = highlightDate ? getBookingType(booking, highlightDate) : null;
  const isOnline = booking.source === 'ONLINE';
  const cin  = new Date(booking.checkIn);
  const cout = new Date(booking.checkOut);
  const nights = Math.max(1, Math.round((cout - cin) / 86400000));

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-gray-900 text-sm truncate">{booking.guestName}</span>
            {isOnline && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase shrink-0">
                <Globe className="w-2.5 h-2.5 mr-0.5" /> Online
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{booking.guestPhone}</p>
          {booking.guestEmail && <p className="text-[10px] text-gray-400">{booking.guestEmail}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${STATUS_STYLE[booking.status] || 'bg-gray-100 text-gray-500'}`}>
            {(booking.status || '').replace(/_/g, ' ')}
          </span>
          {type === 'checkin'  && <span className="text-[9px] font-bold text-green-600  bg-green-50  px-1.5 py-0.5 rounded flex items-center gap-0.5"><LogIn    className="w-2.5 h-2.5" /> Arriving</span>}
          {type === 'checkout' && <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded flex items-center gap-0.5"><LogOut   className="w-2.5 h-2.5" /> Departing</span>}
          {type === 'staying'  && <span className="text-[9px] font-bold text-blue-600   bg-blue-50   px-1.5 py-0.5 rounded flex items-center gap-0.5"><BedDouble className="w-2.5 h-2.5" /> Staying</span>}
        </div>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 pt-2 border-t border-gray-50">
        <span className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${booking.reqType === 'AC' ? 'bg-blue-400' : 'bg-gray-400'}`} />
          {booking.reqType} · {booking.bookingType === 'FULL_DAY' ? 'Full Day' : 'Half Day'}
        </span>
        <span>
          {cin.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {cout.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          <span className="text-gray-400 ml-1">({nights}N)</span>
        </span>
        <span className="flex items-center gap-0.5 font-semibold text-gray-700">
          <IndianRupee className="w-3 h-3" />{booking.totalAmount || 0}
        </span>
        {booking.assignedRooms?.length > 0 && (
          <span className="font-semibold text-indigo-600">
            Rm: {booking.assignedRooms.map(ar => ar.room?.roomNumber || ar.room).join(', ')}
          </span>
        )}
        {booking.property?.name && (
          <span className="flex items-center gap-0.5 text-indigo-500">
            <Building className="w-3 h-3" /> {booking.property.name}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BookingCalendar({ user }) {
  const todayRaw = new Date();
  todayRaw.setHours(0, 0, 0, 0);
  const TODAY_STR = todayRaw.toDateString();

  const [viewDate, setViewDate]       = useState(new Date(todayRaw.getFullYear(), todayRaw.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(new Date(todayRaw));
  const [searchQuery, setSearchQuery] = useState('');
  const [bookings, setBookings]       = useState([]);
  const [properties, setProperties]   = useState([]);
  const [activePropertyId, setActivePropertyId] = useState('');
  const [isLoading, setIsLoading]     = useState(true);
  const searchRef = useRef(null);

  // ── FETCH ────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('hotel_auth_token');
        let propId = activePropertyId;

        if ((user?.role === 'SUPER_ADMIN' || user?.role === 'PROPERTY_OWNER') && properties.length === 0) {
          const endpoint = user.role === 'SUPER_ADMIN'
            ? 'http://localhost:5000/api/properties'
            : 'http://localhost:5000/api/properties/my-hotels';
          const pr = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
          if (pr.ok) {
            const pd = await pr.json();
            setProperties(pd);
            if (!propId) {
              propId = user.role === 'SUPER_ADMIN' ? 'ALL' : (pd[0]?._id || '');
              setActivePropertyId(propId);
            }
          }
        } else if (user?.role === 'HOTEL_MANAGER') {
          propId = user.assignedProperty;
          if (!activePropertyId) setActivePropertyId(propId);
        }

        const url = propId === 'ALL'
          ? 'http://localhost:5000/api/bookings/all'
          : propId ? `http://localhost:5000/api/bookings/property/${propId}` : null;

        if (url) {
          const br = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (br.ok) setBookings(await br.json());
        }
      } catch (e) {
        console.error('Calendar load error', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user, activePropertyId, properties.length]);

  // ── CALENDAR GRID ─────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const start = new Date(year, month, 1);
    start.setDate(start.getDate() - start.getDay()); // back to Sunday
    const days = [];
    const cur = new Date(start);
    while (days.length < 42) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    return days;
  }, [viewDate]);

  // date string → bookings that include that date
  const bookingsByDate = useMemo(() => {
    const map = {};
    for (const bkg of bookings) {
      const ci = new Date(bkg.checkIn);  ci.setHours(0,0,0,0);
      const co = new Date(bkg.checkOut); co.setHours(0,0,0,0);
      const cur = new Date(ci);
      while (cur <= co) {
        const k = cur.toDateString();
        (map[k] = map[k] || []).push(bkg);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [bookings]);

  // ── SEARCH ────────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return bookings.filter(b =>
      b.guestName?.toLowerCase().includes(q) ||
      b.guestPhone?.includes(searchQuery.trim())
    );
  }, [bookings, searchQuery]);

  // bookings for selected date, split into groups
  const { arrivals, staying, departures } = useMemo(() => {
    if (!selectedDate) return { arrivals: [], staying: [], departures: [] };
    const list = bookingsByDate[selectedDate.toDateString()] || [];
    return {
      arrivals:   list.filter(b => getBookingType(b, selectedDate) === 'checkin'),
      staying:    list.filter(b => getBookingType(b, selectedDate) === 'staying'),
      departures: list.filter(b => getBookingType(b, selectedDate) === 'checkout'),
    };
  }, [selectedDate, bookingsByDate]);

  const totalOnDate = arrivals.length + staying.length + departures.length;

  const prevMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday   = () => {
    setViewDate(new Date(todayRaw.getFullYear(), todayRaw.getMonth(), 1));
    setSelectedDate(new Date(todayRaw));
    setSearchQuery('');
  };

  const isSearching = searchQuery.trim().length > 0;
  const curMonth = viewDate.getMonth();

  // ── RENDER ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
        <span className="text-gray-500 font-medium">Loading calendar...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking Calendar</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Click a date to see bookings · Search by guest name or phone</p>
        </div>
        {(user?.role === 'SUPER_ADMIN' || user?.role === 'PROPERTY_OWNER') && (
          <select
            value={activePropertyId}
            onChange={e => { setActivePropertyId(e.target.value); setBookings([]); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
          >
            {user?.role === 'SUPER_ADMIN' && <option value="ALL">All Properties</option>}
            {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* ── SEARCH ── */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={searchRef}
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); if (e.target.value) setSelectedDate(null); }}
          placeholder="Search guest name or phone number..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-sm"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
            <X className="w-4 h-4 text-gray-400 hover:text-gray-700" />
          </button>
        )}
      </div>

      {/* ── SEARCH RESULTS ── */}
      {isSearching ? (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
          {searchResults.length === 0 ? (
            <div className="text-center py-16 text-gray-300 bg-white border border-dashed border-gray-200 rounded-2xl">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-gray-400">No guests found</p>
              <p className="text-xs mt-1 text-gray-300">Try a different name or phone number</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {searchResults.map(bkg => (
                <BookingCard key={bkg._id} booking={bkg} />
              ))}
            </div>
          )}
        </div>

      ) : (
        // ── CALENDAR + DETAIL PANEL ──
        <div className="flex flex-col xl:flex-row gap-5 items-start">

          {/* CALENDAR */}
          <div className="flex-1 min-w-0">
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

              {/* Month nav */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-gray-900 select-none">
                    {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                  </h2>
                  <button
                    onClick={goToday}
                    className="text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full transition-colors"
                  >
                    Today
                  </button>
                </div>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="py-2.5 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider select-none">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7 divide-x divide-y divide-gray-50">
                {calendarDays.map((day, i) => {
                  const key   = day.toDateString();
                  const dayBkgs = bookingsByDate[key] || [];
                  const isToday    = key === TODAY_STR;
                  const isSelected = selectedDate && key === selectedDate.toDateString();
                  const inMonth    = day.getMonth() === curMonth;

                  const chkIn  = dayBkgs.filter(b => getBookingType(b, day) === 'checkin').length;
                  const chkOut = dayBkgs.filter(b => getBookingType(b, day) === 'checkout').length;
                  const stay   = dayBkgs.filter(b => getBookingType(b, day) === 'staying').length;

                  return (
                    <button
                      key={i}
                      onClick={() => { setSelectedDate(isSelected ? null : new Date(day)); }}
                      className={[
                        'relative flex flex-col min-h-16 sm:min-h-22 p-1.5 sm:p-2 text-left transition-all',
                        !inMonth ? 'bg-gray-50/60' : 'bg-white hover:bg-blue-50/40',
                        isSelected ? '!bg-blue-50 ring-2 ring-inset ring-blue-500' : '',
                      ].join(' ')}
                    >
                      {/* Date number */}
                      <span className={[
                        'inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm font-bold rounded-full mb-1 select-none',
                        isToday    ? 'bg-blue-600 text-white shadow-sm' :
                        isSelected ? 'bg-blue-100 text-blue-700' :
                        inMonth    ? 'text-gray-800' : 'text-gray-300',
                      ].join(' ')}>
                        {day.getDate()}
                      </span>

                      {/* Booking pills — desktop */}
                      {inMonth && dayBkgs.length > 0 && (
                        <div className="flex flex-col gap-0.5">
                          {chkIn > 0 && (
                            <div className="hidden sm:flex items-center gap-1 text-[9px] font-bold text-green-700 bg-green-50 rounded px-1 py-0.5 leading-none whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                              {chkIn} in
                            </div>
                          )}
                          {chkOut > 0 && (
                            <div className="hidden sm:flex items-center gap-1 text-[9px] font-bold text-orange-700 bg-orange-50 rounded px-1 py-0.5 leading-none whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                              {chkOut} out
                            </div>
                          )}
                          {stay > 0 && (
                            <div className="hidden sm:flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-50 rounded px-1 py-0.5 leading-none whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                              {stay} stay
                            </div>
                          )}
                          {/* Mobile: just dots */}
                          <div className="flex sm:hidden gap-0.5 mt-0.5 flex-wrap">
                            {chkIn  > 0 && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                            {chkOut > 0 && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                            {stay   > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 px-5 py-3 border-t border-gray-100 bg-gray-50/60">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Legend</span>
                <span className="flex items-center gap-1.5 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Check-in</span>
                <span className="flex items-center gap-1.5 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Check-out</span>
                <span className="flex items-center gap-1.5 text-[11px] text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Staying</span>
              </div>
            </div>
          </div>

          {/* ── DETAIL PANEL ── */}
          <div className="xl:w-96 w-full shrink-0">
            {selectedDate ? (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Panel header */}
                <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <div>
                    <h3 className="font-bold text-gray-900 text-sm leading-tight">
                      {selectedDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {totalOnDate === 0 ? 'No bookings' : `${totalOnDate} booking${totalOnDate !== 1 ? 's' : ''}`}
                      {arrivals.length   > 0 && <span className="ml-1.5 text-green-600 font-semibold">· {arrivals.length} arriving</span>}
                      {departures.length > 0 && <span className="ml-1.5 text-orange-600 font-semibold">· {departures.length} departing</span>}
                    </p>
                  </div>
                  <button onClick={() => setSelectedDate(null)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors mt-0.5">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Booking list */}
                <div className="divide-y divide-gray-50 max-h-[65vh] overflow-y-auto">
                  {totalOnDate === 0 ? (
                    <div className="py-14 text-center text-gray-300 flex flex-col items-center">
                      <CalendarDays className="w-9 h-9 mb-2 opacity-40" />
                      <p className="text-sm font-medium text-gray-400">No bookings on this date</p>
                    </div>
                  ) : (
                    <>
                      {arrivals.length > 0 && (
                        <div className="p-4">
                          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <LogIn className="w-3 h-3" /> Arrivals ({arrivals.length})
                          </p>
                          <div className="space-y-2">
                            {arrivals.map(b => <BookingCard key={b._id} booking={b} highlightDate={selectedDate} />)}
                          </div>
                        </div>
                      )}

                      {staying.length > 0 && (
                        <div className="p-4">
                          <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <BedDouble className="w-3 h-3" /> Staying ({staying.length})
                          </p>
                          <div className="space-y-2">
                            {staying.map(b => <BookingCard key={b._id} booking={b} highlightDate={selectedDate} />)}
                          </div>
                        </div>
                      )}

                      {departures.length > 0 && (
                        <div className="p-4">
                          <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <LogOut className="w-3 h-3" /> Departures ({departures.length})
                          </p>
                          <div className="space-y-2">
                            {departures.map(b => <BookingCard key={b._id} booking={b} highlightDate={selectedDate} />)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center min-h-52">
                <CalendarDays className="w-10 h-10 text-gray-200 mb-3" />
                <p className="text-sm font-semibold text-gray-400">Click any date</p>
                <p className="text-xs text-gray-300 mt-1">to view its bookings</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, LogOut, LogIn, IndianRupee, Sun, Moon,
  DoorOpen, Calendar, Building2, Banknote, CreditCard,
  Smartphone, Loader2, List, CheckCircle, FileSpreadsheet,
  FileText, Globe, Wifi, BarChart2, AlertCircle, X, Filter,
  Download, RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { API, getToken } from '../utils/api.js';

export default function Summary({ user }) {
  const [isLoading, setIsLoading]               = useState(true);
  const [selectedDate, setSelectedDate]         = useState(new Date().toISOString().split('T')[0]);
  const [selectedProperty, setSelectedProperty] = useState('ALL');
  const [properties, setProperties]             = useState([]);
  const [rooms, setRooms]                       = useState([]);
  const [bookings, setBookings]                 = useState([]);
  const [pdfOpen, setPdfOpen]                   = useState(false);

  // ── Fetch properties once (OWNER / SUPER_ADMIN only) ─────────────────────
  useEffect(() => {
    if (!user || (user.role !== 'PROPERTY_OWNER' && user.role !== 'SUPER_ADMIN')) return;
    const endpoint = user.role === 'SUPER_ADMIN'
      ? `${API}/properties`
      : `${API}/properties/my-hotels`;
    fetch(endpoint, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setProperties)
      .catch(console.error);
  }, [user?.role]);

  const propIds = properties.map(p => String(p._id)).sort().join(',');

  // ── Fetch rooms + bookings ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.role) return;
    const needsProps = (user.role === 'PROPERTY_OWNER' || user.role === 'SUPER_ADMIN')
      && selectedProperty === 'ALL';
    if (needsProps && propIds === '') return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = getToken();
        let targetProps = [];
        if (user.role === 'HOTEL_MANAGER') {
          const id = typeof user.assignedProperty === 'object'
            ? user.assignedProperty?._id : user.assignedProperty;
          if (id) targetProps = [String(id)];
        } else {
          targetProps = selectedProperty === 'ALL'
            ? properties.map(p => String(p._id))
            : [selectedProperty];
        }

        const roomArrays = await Promise.all(
          targetProps.map(pid =>
            fetch(`${API}/properties/${pid}/rooms`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : [])
          )
        );
        setRooms(roomArrays.flat());

        let bkgUrl = `${API}/bookings/all`;
        if (user.role === 'HOTEL_MANAGER') {
          const id = typeof user.assignedProperty === 'object'
            ? user.assignedProperty?._id : user.assignedProperty;
          if (id) bkgUrl += `?propertyId=${id}`;
        } else if (selectedProperty !== 'ALL') {
          bkgUrl += `?propertyId=${selectedProperty}`;
        }

        const br = await fetch(bkgUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (br.ok) setBookings(await br.json());
      } catch (e) {
        console.error('Summary fetch error:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user?.role, user?.assignedProperty, selectedProperty, propIds]); // eslint-disable-line

  // ── Date helpers ─────────────────────────────────────────────────────────
  const { targetDate, nextDate } = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return {
      targetDate: new Date(y, m - 1, d, 0, 0, 0, 0),
      nextDate:   new Date(y, m - 1, d + 1, 0, 0, 0, 0),
    };
  }, [selectedDate]);

  const displayDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }, [selectedDate]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const m = {
      fullDay: 0, halfDay: 0, checkIns: 0, checkOuts: 0,
      occupiedRoomIds: new Set(),
      revenueTotal: 0, revenueUPI: 0, revenueCash: 0, revenueCard: 0, revenueOnline: 0,
      onlineBookings: 0, totalBookings: bookings.length,
    };
    bookings.forEach(bkg => {
      const ci = new Date(bkg.checkIn);
      const co = new Date(bkg.checkOut);
      const isActiveOnDate = ci < nextDate && co > targetDate
        && (bkg.status === 'CONFIRMED' || bkg.status === 'CHECKED_IN');
      const isCheckInToday  = ci >= targetDate && ci < nextDate;
      const isCheckOutToday = co >= targetDate && co < nextDate;

      if (isActiveOnDate) {
        if (bkg.bookingType === 'FULL_DAY') m.fullDay++;
        if (bkg.bookingType === 'HALF_DAY') m.halfDay++;
        if (bkg.assignedRooms?.length) {
          bkg.assignedRooms.forEach(ar => m.occupiedRoomIds.add(String(ar.room?._id || ar.room)));
        } else if (bkg.room) {
          m.occupiedRoomIds.add(String(bkg.room._id || bkg.room));
        }
      }
      if (isCheckInToday  && bkg.status !== 'CANCELLED') m.checkIns++;
      if (isCheckOutToday && bkg.status !== 'CANCELLED' && bkg.status !== 'PENDING_ASSIGNMENT') m.checkOuts++;
      if (bkg.source === 'ONLINE' && isCheckInToday) m.onlineBookings++;
      if (isCheckInToday && bkg.status !== 'CANCELLED') {
        const amount = bkg.totalAmount || 0;
        m.revenueTotal  += amount;
        if (bkg.paymentMethod === 'UPI')      m.revenueUPI    += amount;
        if (bkg.paymentMethod === 'CASH')     m.revenueCash   += amount;
        if (bkg.paymentMethod === 'CARD')     m.revenueCard   += amount;
        if (bkg.paymentMethod === 'CASHFREE') m.revenueOnline += amount;
      }
    });
    const unavail     = rooms.filter(r => r.currentStatus === 'CLEANING' || r.currentStatus === 'MAINTENANCE').length;
    m.totalRooms      = rooms.length;
    m.unavailableRooms = unavail;
    m.occupiedRooms   = m.occupiedRoomIds.size;
    m.vacantRooms     = Math.max(0, m.totalRooms - m.occupiedRooms - unavail);
    m.occupancyPct    = m.totalRooms > 0 ? Math.round((m.occupiedRooms / m.totalRooms) * 100) : 0;
    return m;
  }, [bookings, rooms, targetDate, nextDate]);

  const totalPendingBalance = useMemo(() =>
    bookings.reduce((sum, bkg) => {
      if (bkg.status === 'CANCELLED' || bkg.status === 'CHECKED_OUT') return sum;
      const total = bkg.totalAmount || 0;
      const paid  = bkg.transactions?.length
        ? bkg.transactions.reduce((s, t) => s + (t.amount || 0), 0)
        : (bkg.advancePaid || 0);
      return sum + Math.max(0, total - paid);
    }, 0),
  [bookings]);

  // ── Excel export (direct download) ───────────────────────────────────────
  const exportToExcel = () => {
    const dateBookings = bookings.filter(bkg => {
      const ci = new Date(bkg.checkIn);
      return ci >= targetDate && ci < nextDate && bkg.status !== 'CANCELLED';
    });
    let sumTotal = 0, sumUPI = 0, sumCash = 0, sumCard = 0, sumOnline = 0;
    const rows = dateBookings.map(bkg => {
      const total  = bkg.totalAmount || 0;
      const upi    = bkg.paymentMethod === 'UPI'      ? total : 0;
      const cash   = bkg.paymentMethod === 'CASH'     ? total : 0;
      const card   = bkg.paymentMethod === 'CARD'     ? total : 0;
      const online = bkg.paymentMethod === 'CASHFREE' ? total : 0;
      sumTotal += total; sumUPI += upi; sumCash += cash; sumCard += card; sumOnline += online;
      return [
        new Date(bkg.checkIn).toLocaleDateString('en-GB'),
        new Date(bkg.checkOut).toLocaleDateString('en-GB'),
        bkg.guestName, bkg.guestPhone,
        bkg.assignedRooms?.length || (bkg.room ? 1 : 0),
        bkg.bookingType === 'FULL_DAY' ? 'Full Day' : 'Half Day',
        total, upi, cash, card, online,
        bkg.status.replace(/_/g, ' '),
      ];
    });
    const wsData = [
      [`FTD Report — ${displayDate}`], [],
      ['CI Date', 'CO Date', 'Guest Name', 'Phone', 'Rooms', 'Type', 'Total (₹)', 'UPI (₹)', 'Cash (₹)', 'Card (₹)', 'Cashfree (₹)', 'Status'],
      ...rows, [],
      ['Day Close Summary'],
      ['', '', '', '', '', '', sumTotal, sumUPI, sumCash, sumCard, sumOnline, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `Hotel_Report_${selectedDate}.xlsx`);
  };

  // ── PDF generate (called from preview modal with filtered bookings) ───────
  const generatePDF = (filteredBookings) => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text(`Hotel Day Close Report — ${displayDate}`, 14, 20);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}  ·  ${filteredBookings.length} bookings`, 14, 27);
    doc.setTextColor(0);

    const rows = filteredBookings.map((bkg, idx) => {
      const total  = bkg.totalAmount || 0;
      const txSum  = bkg.transactions?.length
        ? bkg.transactions.reduce((s, t) => s + (t.amount || 0), 0) : null;
      const paid   = txSum !== null ? txSum : (bkg.advancePaid || 0);
      const due    = Math.max(0, total - paid);
      return [
        idx + 1,
        bkg.guestName,
        bkg.guestPhone,
        new Date(bkg.checkIn).toLocaleDateString('en-GB'),
        new Date(bkg.checkOut).toLocaleDateString('en-GB'),
        bkg.bookingType?.replace('_', ' ') || '',
        bkg.source || 'WALK_IN',
        bkg.assignedRooms?.length || (bkg.room ? 1 : 0),
        total.toLocaleString('en-IN'),
        paid.toLocaleString('en-IN'),
        due > 0 ? due.toLocaleString('en-IN') : '—',
        bkg.paymentMethod || '—',
        bkg.status.replace(/_/g, ' '),
      ];
    });

    const totals = filteredBookings.reduce((acc, bkg) => {
      const amt = bkg.totalAmount || 0;
      acc.total += amt;
      if (bkg.paymentMethod === 'UPI')      acc.upi    += amt;
      if (bkg.paymentMethod === 'CASH')     acc.cash   += amt;
      if (bkg.paymentMethod === 'CARD')     acc.card   += amt;
      if (bkg.paymentMethod === 'CASHFREE') acc.online += amt;
      return acc;
    }, { total: 0, upi: 0, cash: 0, card: 0, online: 0 });

    doc.autoTable({
      startY: 33,
      head: [['#', 'Guest', 'Phone', 'Check-in', 'Check-out', 'Type', 'Source', 'Rooms', 'Total (₹)', 'Paid (₹)', 'Due (₹)', 'Payment', 'Status']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontSize: 7.5 },
      styles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Total (₹)', 'UPI (₹)', 'Cash (₹)', 'Card (₹)', 'Cashfree (₹)']],
      body: [[
        totals.total.toLocaleString('en-IN'),
        totals.upi.toLocaleString('en-IN'),
        totals.cash.toLocaleString('en-IN'),
        totals.card.toLocaleString('en-IN'),
        totals.online.toLocaleString('en-IN'),
      ]],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      styles: { fontSize: 8, fontStyle: 'bold' },
    });

    doc.save(`Hotel_Report_${selectedDate}.pdf`);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-8">

      {/* Header + Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Summary</h1>
          <p className="text-sm text-gray-500 mt-1">FTD occupancy, revenue, and balance breakdown.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex-1 sm:flex-none">
            <div className="flex items-center px-3 border-r border-gray-100 flex-1 sm:flex-none">
              <Calendar className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
              />
            </div>
            {(user?.role === 'PROPERTY_OWNER' || user?.role === 'SUPER_ADMIN') && (
              <div className="flex items-center px-3 flex-1 sm:flex-none">
                <Building2 className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <select
                  value={selectedProperty}
                  onChange={e => setSelectedProperty(e.target.value)}
                  className="w-full text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
                >
                  <option value="ALL">
                    {user?.role === 'SUPER_ADMIN' ? '🌍 All Properties' : '🏢 All My Properties'}
                  </option>
                  {properties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={exportToExcel}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </button>
            <button
              onClick={() => setPdfOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" /> PDF Preview
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p>Crunching numbers...</p>
        </div>
      ) : (
        <>
          {/* Section 1: Occupancy */}
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            Occupancy — {displayDate}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Full Day Stays"     value={metrics.fullDay}    icon={<Sun      className="w-5 h-5" />} color="bg-blue-50 text-blue-600" />
            <StatCard label="Half Day Stays"     value={metrics.halfDay}    icon={<Moon     className="w-5 h-5" />} color="bg-orange-50 text-orange-600" />
            <StatCard label="Today's Check-ins"  value={metrics.checkIns}   icon={<LogIn    className="w-5 h-5" />} color="bg-emerald-50 text-emerald-600" />
            <StatCard label="Today's Check-outs" value={metrics.checkOuts}  icon={<LogOut   className="w-5 h-5" />} color="bg-red-50 text-red-600" />

            {/* Vacant rooms */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-xs font-bold mb-1">Vacant Rooms</h3>
                <p className="text-2xl font-black text-gray-900">
                  {metrics.vacantRooms}
                  <span className="text-xs text-gray-400 font-medium ml-1">/ {metrics.totalRooms}</span>
                </p>
                {metrics.unavailableRooms > 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold mt-0.5">
                    {metrics.unavailableRooms} cleaning/maint.
                  </p>
                )}
              </div>
              <div className="p-3 rounded-full bg-green-50 text-green-600"><DoorOpen className="w-5 h-5" /></div>
            </div>

            {/* Occupancy % */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-xs font-bold mb-1">Occupancy Rate</h3>
                <p className="text-2xl font-black text-gray-900">{metrics.occupancyPct}%</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{metrics.occupiedRooms} occupied</p>
              </div>
              <div className="p-3 rounded-full bg-indigo-50 text-indigo-600"><BarChart2 className="w-5 h-5" /></div>
            </div>
          </div>

          {/* Section 2: Revenue */}
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Revenue — {displayDate}
          </h2>
          <p className="text-[11px] text-gray-400 mb-4">
            FTD: counts bookings that checked in on this date · {metrics.totalBookings} total bookings loaded
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            <div className="bg-indigo-600 p-5 sm:p-6 rounded-2xl shadow-md text-white flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-indigo-100 text-xs font-bold uppercase tracking-wider">Total Revenue</h3>
                <TrendingUp className="w-4 h-4 text-indigo-200" />
              </div>
              <p className="text-3xl sm:text-4xl font-black flex items-center">
                <IndianRupee className="w-6 h-6 mr-1" /> {metrics.revenueTotal.toLocaleString('en-IN')}
              </p>
            </div>
            <RevenueCard label="UPI Payments"     amount={metrics.revenueUPI}    icon={<Smartphone className="w-5 h-5" />} color="bg-purple-50 text-purple-600" />
            <RevenueCard label="Cash Collection"  amount={metrics.revenueCash}   icon={<Banknote   className="w-5 h-5" />} color="bg-emerald-50 text-emerald-600" />
            <RevenueCard label="Card Swipes"      amount={metrics.revenueCard}   icon={<CreditCard className="w-5 h-5" />} color="bg-blue-50 text-blue-600" />
            <RevenueCard label="Online (Cashfree)" amount={metrics.revenueOnline} icon={<Wifi      className="w-5 h-5" />} color="bg-teal-50 text-teal-600" />
          </div>

          {/* Revenue verification */}
          {metrics.revenueTotal > 0 && (() => {
            const sub  = metrics.revenueUPI + metrics.revenueCash + metrics.revenueCard + metrics.revenueOnline;
            const diff = metrics.revenueTotal - sub;
            return (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold mb-8 ${
                diff === 0
                  ? 'bg-green-50 text-green-700 border border-green-100'
                  : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                {diff === 0
                  ? <><CheckCircle className="w-4 h-4 shrink-0" /> Revenue breakdown verified — all payment methods account for ₹{metrics.revenueTotal.toLocaleString('en-IN')}</>
                  : <><AlertCircle className="w-4 h-4 shrink-0" /> Breakdown mismatch: ₹{Math.abs(diff).toLocaleString('en-IN')} unaccounted — check for mixed/unlisted payment methods</>
                }
              </div>
            );
          })()}

          {/* Section 3: Ledger */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
              <List className="w-4 h-4 mr-2" /> Financial Ledger & Balances
            </h2>
            {totalPendingBalance > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg text-xs font-bold text-red-700">
                <AlertCircle className="w-3.5 h-3.5" />
                Total Outstanding: ₹{totalPendingBalance.toLocaleString('en-IN')}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Guest & ID</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Stay Dates</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Billing Details</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Balance Status</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Booking Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {bookings.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-10 text-center text-gray-400">No records found.</td></tr>
                ) : (
                  [...bookings]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map(bkg => {
                      const total    = bkg.totalAmount || 0;
                      const txSum    = bkg.transactions?.length
                        ? bkg.transactions.reduce((s, t) => s + (t.amount || 0), 0) : null;
                      const paid     = txSum !== null ? txSum : (bkg.advancePaid || 0);
                      const balanceDue = Math.max(0, total - paid);
                      return (
                        <tr key={bkg._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              {bkg.guestName}
                              {bkg.source === 'ONLINE' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                                  <Globe className="w-2.5 h-2.5 mr-0.5" /> Online
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">#{(bkg._id || bkg.id).toString().slice(-6).toUpperCase()}</div>
                            {bkg.guestPhone && <div className="text-[10px] text-gray-400 mt-0.5">{bkg.guestPhone}</div>}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-900 font-medium">In: {new Date(bkg.checkIn).toLocaleDateString('en-IN')}</div>
                            <div className="text-xs text-gray-500 mt-0.5">Out: {new Date(bkg.checkOut).toLocaleDateString('en-IN')}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5 uppercase">{bkg.bookingType?.replace('_', ' ')}</div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900 flex items-center">
                              <IndianRupee className="w-3 h-3 mr-0.5" /> {total.toLocaleString('en-IN')} Total
                            </div>
                            <div className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1">
                              Paid: ₹{paid.toLocaleString('en-IN')}
                              <span className="text-[10px] tracking-wider border border-green-200 bg-green-50 px-1.5 rounded uppercase">{bkg.paymentMethod || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            {balanceDue > 0 ? (
                              <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-100 flex items-center w-max gap-1">
                                <AlertCircle className="w-3 h-3" /> Due: ₹{balanceDue.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-lg text-xs font-bold border border-green-100 flex items-center w-max gap-1">
                                <CheckCircle className="w-3 h-3" /> Settled
                              </span>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${
                              bkg.status === 'CONFIRMED'          ? 'bg-blue-100 text-blue-700'    :
                              bkg.status === 'CHECKED_IN'         ? 'bg-indigo-100 text-indigo-700' :
                              bkg.status === 'PENDING_ASSIGNMENT' ? 'bg-yellow-100 text-yellow-700' :
                              bkg.status === 'CANCELLED'          ? 'bg-red-100 text-red-700'       :
                                                                     'bg-gray-100 text-gray-600'
                            }`}>
                              {bkg.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* PDF Preview Modal */}
      {pdfOpen && (
        <PDFPreviewModal
          bookings={bookings}
          targetDate={targetDate}
          nextDate={nextDate}
          displayDate={displayDate}
          selectedDate={selectedDate}
          onClose={() => setPdfOpen(false)}
          onDownload={generatePDF}
        />
      )}
    </div>
  );
}

// ── PDF Preview Modal ────────────────────────────────────────────────────────
function PDFPreviewModal({ bookings, targetDate, nextDate, displayDate, selectedDate, onClose, onDownload }) {
  const [filters, setFilters] = useState({
    dateScope:     'selected',
    status:        'ALL',
    paymentMethod: 'ALL',
    bookingType:   'ALL',
    source:        'ALL',
  });

  const setF = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const resetFilters = () => setFilters({ dateScope: 'selected', status: 'ALL', paymentMethod: 'ALL', bookingType: 'ALL', source: 'ALL' });

  const filtered = useMemo(() => {
    return bookings.filter(bkg => {
      if (filters.dateScope === 'selected') {
        const ci = new Date(bkg.checkIn);
        if (ci < targetDate || ci >= nextDate) return false;
      }
      if (filters.status        !== 'ALL' && bkg.status        !== filters.status)        return false;
      if (filters.paymentMethod !== 'ALL' && bkg.paymentMethod !== filters.paymentMethod) return false;
      if (filters.bookingType   !== 'ALL' && bkg.bookingType   !== filters.bookingType)   return false;
      if (filters.source        !== 'ALL' && (bkg.source || 'WALK_IN') !== filters.source) return false;
      return true;
    });
  }, [bookings, filters, targetDate, nextDate]);

  const totals = useMemo(() => filtered.reduce((acc, bkg) => {
    const amt = bkg.totalAmount || 0;
    acc.total += amt;
    if (bkg.paymentMethod === 'UPI')      acc.upi    += amt;
    if (bkg.paymentMethod === 'CASH')     acc.cash   += amt;
    if (bkg.paymentMethod === 'CARD')     acc.card   += amt;
    if (bkg.paymentMethod === 'CASHFREE') acc.online += amt;
    return acc;
  }, { total: 0, upi: 0, cash: 0, card: 0, online: 0 }), [filtered]);

  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(15,23,42,0.85)' }}>

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 rounded-xl">
            <FileText className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">PDF Report Preview</h2>
            <p className="text-xs text-gray-400">
              {filtered.length} of {bookings.length} bookings · {displayDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDownload(filtered)}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5" /> Filters
          </div>

          <FSelect
            label="Date"
            value={filters.dateScope}
            onChange={v => setF('dateScope', v)}
            options={[
              { value: 'selected', label: `Selected Date` },
              { value: 'all',      label: 'All Loaded' },
            ]}
          />
          <FSelect
            label="Status"
            value={filters.status}
            onChange={v => setF('status', v)}
            options={[
              { value: 'ALL',                label: 'All Statuses' },
              { value: 'CONFIRMED',          label: 'Confirmed' },
              { value: 'CHECKED_IN',         label: 'Checked In' },
              { value: 'CHECKED_OUT',        label: 'Checked Out' },
              { value: 'PENDING_ASSIGNMENT', label: 'Pending' },
              { value: 'CANCELLED',          label: 'Cancelled' },
            ]}
          />
          <FSelect
            label="Payment"
            value={filters.paymentMethod}
            onChange={v => setF('paymentMethod', v)}
            options={[
              { value: 'ALL',      label: 'All Methods' },
              { value: 'UPI',      label: 'UPI' },
              { value: 'CASH',     label: 'Cash' },
              { value: 'CARD',     label: 'Card' },
              { value: 'CASHFREE', label: 'Cashfree' },
            ]}
          />
          <FSelect
            label="Type"
            value={filters.bookingType}
            onChange={v => setF('bookingType', v)}
            options={[
              { value: 'ALL',      label: 'All Types' },
              { value: 'FULL_DAY', label: 'Full Day' },
              { value: 'HALF_DAY', label: 'Half Day' },
            ]}
          />
          <FSelect
            label="Source"
            value={filters.source}
            onChange={v => setF('source', v)}
            options={[
              { value: 'ALL',     label: 'All Sources' },
              { value: 'WALK_IN', label: 'Walk-in' },
              { value: 'ONLINE',  label: 'Online' },
            ]}
          />

          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold ml-1"
          >
            <RefreshCw className="w-3 h-3" /> Reset
          </button>

          <span className="ml-auto text-xs text-gray-400 font-medium">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Scrollable preview area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-screen-xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden">

          {/* Report header */}
          <div className="bg-indigo-600 px-6 sm:px-8 py-6 text-white">
            <h1 className="text-xl sm:text-2xl font-black">Hotel Day Close Report</h1>
            <p className="text-indigo-200 text-sm mt-1">
              {displayDate} &nbsp;·&nbsp; {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
              {filters.dateScope === 'all' && ' (all loaded dates)'}
            </p>
            <p className="text-indigo-300 text-xs mt-0.5">Generated: {new Date().toLocaleString('en-IN')}</p>
          </div>

          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-gray-200 border-b border-gray-200">
            <SumTile label="Total Revenue" value={totals.total} highlight />
            <SumTile label="UPI"      value={totals.upi} />
            <SumTile label="Cash"     value={totals.cash} />
            <SumTile label="Card"     value={totals.card} />
            <SumTile label="Cashfree" value={totals.online} />
          </div>

          {/* Data table */}
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No bookings match the selected filters.</p>
                <button onClick={resetFilters} className="mt-3 text-xs text-blue-600 hover:underline font-semibold">Reset filters</button>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['#', 'Guest', 'Phone', 'Check-in', 'Check-out', 'Type', 'Source', 'Rooms', 'Total', 'Paid', 'Due', 'Payment', 'Status'].map(h => (
                      <th key={h} className="px-4 sm:px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((bkg, idx) => {
                    const total  = bkg.totalAmount || 0;
                    const txSum  = bkg.transactions?.length
                      ? bkg.transactions.reduce((s, t) => s + (t.amount || 0), 0) : null;
                    const paid   = txSum !== null ? txSum : (bkg.advancePaid || 0);
                    const due    = Math.max(0, total - paid);
                    const rcount = bkg.assignedRooms?.length || (bkg.room ? 1 : 0);
                    return (
                      <tr key={bkg._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                        <td className="px-4 sm:px-5 py-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 sm:px-5 py-3 font-semibold text-gray-900 whitespace-nowrap">{bkg.guestName}</td>
                        <td className="px-4 sm:px-5 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">{bkg.guestPhone}</td>
                        <td className="px-4 sm:px-5 py-3 text-gray-700 whitespace-nowrap text-xs">{new Date(bkg.checkIn).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 sm:px-5 py-3 text-gray-700 whitespace-nowrap text-xs">{new Date(bkg.checkOut).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${bkg.bookingType === 'FULL_DAY' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                            {bkg.bookingType?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${bkg.source === 'ONLINE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {bkg.source || 'WALK IN'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 text-center font-semibold text-gray-700 text-xs">{rcount}</td>
                        <td className="px-4 sm:px-5 py-3 text-right font-bold text-gray-900 whitespace-nowrap text-xs">₹{total.toLocaleString('en-IN')}</td>
                        <td className="px-4 sm:px-5 py-3 text-right text-green-700 font-semibold whitespace-nowrap text-xs">₹{paid.toLocaleString('en-IN')}</td>
                        <td className="px-4 sm:px-5 py-3 text-right whitespace-nowrap text-xs">
                          {due > 0
                            ? <span className="text-red-600 font-bold">₹{due.toLocaleString('en-IN')}</span>
                            : <span className="text-gray-300">—</span>
                          }
                        </td>
                        <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                          <span className="text-[10px] font-bold uppercase bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
                            {bkg.paymentMethod || '—'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-5 py-3 whitespace-nowrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${
                            bkg.status === 'CONFIRMED'          ? 'bg-blue-100 text-blue-700'    :
                            bkg.status === 'CHECKED_IN'         ? 'bg-indigo-100 text-indigo-700' :
                            bkg.status === 'CHECKED_OUT'        ? 'bg-gray-100 text-gray-600'    :
                            bkg.status === 'CANCELLED'          ? 'bg-red-100 text-red-700'       :
                                                                   'bg-yellow-100 text-yellow-700'
                          }`}>
                            {bkg.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Totals footer row */}
                <tfoot>
                  <tr className="bg-indigo-50 border-t-2 border-indigo-200">
                    <td colSpan="8" className="px-4 sm:px-5 py-3 text-xs font-bold text-indigo-700 uppercase tracking-wider">
                      Totals ({filtered.length} bookings)
                    </td>
                    <td className="px-4 sm:px-5 py-3 text-right font-black text-indigo-700 whitespace-nowrap text-sm">₹{totals.total.toLocaleString('en-IN')}</td>
                    <td colSpan="4" className="px-4 sm:px-5 py-3 text-xs text-indigo-500 whitespace-nowrap">
                      UPI: ₹{totals.upi.toLocaleString('en-IN')} &nbsp;·&nbsp;
                      Cash: ₹{totals.cash.toLocaleString('en-IN')} &nbsp;·&nbsp;
                      Card: ₹{totals.card.toLocaleString('en-IN')} &nbsp;·&nbsp;
                      Cashfree: ₹{totals.online.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
            <p className="text-xs text-gray-400">StayLite · {new Date().toLocaleString('en-IN')}</p>
            <p className="text-xs text-gray-400">{filtered.length} records</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function FSelect({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-gray-500 font-semibold whitespace-nowrap">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SumTile({ label, value, highlight }) {
  return (
    <div className={`px-5 sm:px-6 py-4 ${highlight ? 'bg-indigo-50' : 'bg-white'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${highlight ? 'text-indigo-400' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-lg sm:text-xl font-black mt-0.5 ${highlight ? 'text-indigo-700' : 'text-gray-900'}`}>
        ₹{value.toLocaleString('en-IN')}
      </p>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div>
        <h3 className="text-gray-500 text-xs font-bold mb-1">{label}</h3>
        <p className="text-2xl font-black text-gray-900">{value}</p>
      </div>
      <div className={`p-3 rounded-full ${color}`}>{icon}</div>
    </div>
  );
}

function RevenueCard({ label, amount, icon, color }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div>
        <h3 className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">{label}</h3>
        <p className="text-xl sm:text-2xl font-black text-gray-900 flex items-center">
          <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 mr-1" /> {amount.toLocaleString('en-IN')}
        </p>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>{icon}</div>
    </div>
  );
}
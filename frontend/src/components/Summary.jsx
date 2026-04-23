import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, LogOut, LogIn, IndianRupee, Sun, Moon,
  DoorOpen, Calendar, Building2, Banknote, CreditCard,
  Smartphone, Loader2, List, CheckCircle, FileSpreadsheet,
  FileText, Globe, Wifi, BarChart2, AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { API, getToken } from '../utils/api.js';

export default function Summary({ user }) {
  const [isLoading, setIsLoading]         = useState(true);
  const [selectedDate, setSelectedDate]   = useState(new Date().toISOString().split('T')[0]);
  const [selectedProperty, setSelectedProperty] = useState('ALL');
  const [properties, setProperties]       = useState([]);
  const [rooms, setRooms]                 = useState([]);
  const [bookings, setBookings]           = useState([]);

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

  // Stable string key so the data-fetch effect only retriggers when IDs actually change (F2 fix)
  const propIds = properties.map(p => String(p._id)).sort().join(',');

  // ── Fetch rooms + bookings ────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.role) return;

    // Wait for properties list before fetching "all" for OWNER/ADMIN (F1 fix)
    const needsProps = (user.role === 'PROPERTY_OWNER' || user.role === 'SUPER_ADMIN')
      && selectedProperty === 'ALL';
    if (needsProps && propIds === '') return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = getToken();

        // Determine which property IDs to scope rooms to
        let targetProps = [];
        if (user.role === 'HOTEL_MANAGER') {
          const id = typeof user.assignedProperty === 'object'
            ? user.assignedProperty?._id
            : user.assignedProperty;
          if (id) targetProps = [String(id)];
        } else {
          targetProps = selectedProperty === 'ALL'
            ? properties.map(p => String(p._id))
            : [selectedProperty];
        }

        // Fetch rooms in parallel (C4 fix: need currentStatus field)
        const roomArrays = await Promise.all(
          targetProps.map(pid =>
            fetch(`${API}/properties/${pid}/rooms`, { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : [])
          )
        );
        setRooms(roomArrays.flat());

        // Fetch bookings with proper property scoping (F3 fix)
        let bkgUrl = `${API}/bookings/all`;
        if (user.role === 'HOTEL_MANAGER') {
          const id = typeof user.assignedProperty === 'object'
            ? user.assignedProperty?._id
            : user.assignedProperty;
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

  // ── Parse date without timezone shift (C8 fix) ───────────────────────────
  const { targetDate, nextDate } = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return {
      targetDate: new Date(y, m - 1, d, 0, 0, 0, 0),
      nextDate:   new Date(y, m - 1, d + 1, 0, 0, 0, 0),
    };
  }, [selectedDate]);

  // Format for display headings (C8 fix)
  const displayDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }, [selectedDate]);

  // ── Calculate all metrics (C1–C4, M1–M5 fixes) ──────────────────────────
  const metrics = useMemo(() => {
    const m = {
      fullDay: 0, halfDay: 0,
      checkIns: 0, checkOuts: 0,
      occupiedRoomIds: new Set(),
      revenueTotal: 0, revenueUPI: 0, revenueCash: 0, revenueCard: 0, revenueOnline: 0,
      onlineBookings: 0,
      totalBookings: bookings.length,
    };

    bookings.forEach(bkg => {
      const ci = new Date(bkg.checkIn);
      const co = new Date(bkg.checkOut);

      const isActiveOnDate = ci < nextDate && co > targetDate
        && (bkg.status === 'CONFIRMED' || bkg.status === 'CHECKED_IN');
      const isCheckInToday  = ci >= targetDate && ci < nextDate;
      const isCheckOutToday = co >= targetDate && co < nextDate;

      // Occupancy for selected date
      if (isActiveOnDate) {
        if (bkg.bookingType === 'FULL_DAY') m.fullDay++;
        if (bkg.bookingType === 'HALF_DAY') m.halfDay++;
        if (bkg.assignedRooms?.length) {
          bkg.assignedRooms.forEach(ar => m.occupiedRoomIds.add(String(ar.room?._id || ar.room)));
        } else if (bkg.room) {
          m.occupiedRoomIds.add(String(bkg.room._id || bkg.room));
        }
      }

      // Check-ins today — exclude cancelled (M1 fix)
      if (isCheckInToday && bkg.status !== 'CANCELLED') m.checkIns++;

      // Check-outs today — exclude cancelled + pending (C3 fix)
      if (isCheckOutToday
        && bkg.status !== 'CANCELLED'
        && bkg.status !== 'PENDING_ASSIGNMENT') {
        m.checkOuts++;
      }

      // Online bookings scoped to selected date (C2 fix)
      if (bkg.source === 'ONLINE' && isCheckInToday) m.onlineBookings++;

      // FTD Revenue: bookings that checked in today, not cancelled (C1 clarified)
      if (isCheckInToday && bkg.status !== 'CANCELLED') {
        const amount = bkg.totalAmount || 0;
        m.revenueTotal  += amount;
        if (bkg.paymentMethod === 'UPI')      m.revenueUPI    += amount;
        if (bkg.paymentMethod === 'CASH')     m.revenueCash   += amount;
        if (bkg.paymentMethod === 'CARD')     m.revenueCard   += amount;
        if (bkg.paymentMethod === 'CASHFREE') m.revenueOnline += amount; // C6 fix
      }
    });

    // Room counts — account for cleaning/maintenance (C4 fix)
    const unavailableFromStatus = rooms.filter(r =>
      r.currentStatus === 'CLEANING' || r.currentStatus === 'MAINTENANCE'
    ).length;
    m.totalRooms      = rooms.length;
    m.unavailableRooms = unavailableFromStatus;
    m.occupiedRooms   = m.occupiedRoomIds.size;
    m.vacantRooms     = Math.max(0, m.totalRooms - m.occupiedRooms - unavailableFromStatus);
    m.occupancyPct    = m.totalRooms > 0
      ? Math.round((m.occupiedRooms / m.totalRooms) * 100)
      : 0;

    return m;
  }, [bookings, rooms, targetDate, nextDate]);

  // Total outstanding balance across active bookings (M4 fix)
  const totalPendingBalance = useMemo(() => {
    return bookings.reduce((sum, bkg) => {
      if (bkg.status === 'CANCELLED' || bkg.status === 'CHECKED_OUT') return sum;
      const total = bkg.totalAmount || 0;
      // Use transactions ledger when available, else fall back to advancePaid (C5 fix)
      const paid = bkg.transactions?.length
        ? bkg.transactions.reduce((s, t) => s + (t.amount || 0), 0)
        : (bkg.advancePaid || 0);
      return sum + Math.max(0, total - paid);
    }, 0);
  }, [bookings]);

  // ── Export helpers (F4, C6, C7 fixes) ───────────────────────────────────
  const generateReportData = () => {
    let sumTotal = 0, sumUPI = 0, sumCash = 0, sumCard = 0, sumOnline = 0;

    // Filter to selected date only (F4 fix)
    const dateBookings = bookings.filter(bkg => {
      const ci = new Date(bkg.checkIn);
      return ci >= targetDate && ci < nextDate && bkg.status !== 'CANCELLED';
    });

    const reportRows = dateBookings.map(bkg => {
      const ci      = new Date(bkg.checkIn).toLocaleDateString('en-GB');
      const co      = new Date(bkg.checkOut).toLocaleDateString('en-GB');
      const rooms_  = bkg.assignedRooms?.length || (bkg.room ? 1 : 0);
      const type    = bkg.bookingType === 'FULL_DAY' ? 'Full Day' : 'Half Day';
      const total   = bkg.totalAmount || 0;
      // Consistent column mapping for all 4 payment types (C6, C7 fix)
      const upi    = bkg.paymentMethod === 'UPI'      ? total : 0;
      const cash   = bkg.paymentMethod === 'CASH'     ? total : 0;
      const card   = bkg.paymentMethod === 'CARD'     ? total : 0;
      const online = bkg.paymentMethod === 'CASHFREE' ? total : 0;
      sumTotal += total; sumUPI += upi; sumCash += cash; sumCard += card; sumOnline += online;
      return [ci, co, bkg.guestName, bkg.guestPhone, rooms_, type, total, upi, cash, card, online, bkg.status.replace(/_/g, ' ')];
    });

    return { reportRows, sumTotal, sumUPI, sumCash, sumCard, sumOnline };
  };

  const exportToExcel = () => {
    const { reportRows, sumTotal, sumUPI, sumCash, sumCard, sumOnline } = generateReportData();
    const wsData = [
      [`FTD Report — ${displayDate}`],
      [],
      ['CI Date', 'CO Date', 'Guest Name', 'Phone', 'Rooms', 'Type', 'Total (₹)', 'UPI (₹)', 'Cash (₹)', 'Card (₹)', 'Cashfree (₹)', 'Status'],
      ...reportRows,
      [],
      ['Day Close Summary'],
      ['', '', '', '', '', '', sumTotal, sumUPI, sumCash, sumCard, sumOnline, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `Hotel_Report_${selectedDate}.xlsx`);
  };

  const exportToPDF = () => {
    const { reportRows, sumTotal, sumUPI, sumCash, sumCard, sumOnline } = generateReportData();
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text(`Hotel Day Close Report — ${displayDate}`, 14, 20);
    doc.autoTable({
      startY: 28,
      head: [['CI Date', 'CO Date', 'Guest', 'Phone', 'Rooms', 'Type', 'Total', 'UPI', 'Cash', 'Card', 'Cashfree', 'Status']],
      body: reportRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 7.5 },
    });
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Total (₹)', 'UPI (₹)', 'Cash (₹)', 'Card (₹)', 'Cashfree (₹)']],
      body: [[sumTotal, sumUPI, sumCash, sumCard, sumOnline]],
      theme: 'grid',
      headStyles: { fillColor: [55, 65, 81] },
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
                  {properties.map(p => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
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
              onClick={exportToPDF}
              className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-sm transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" /> PDF
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
          {/* ── Section 1: Occupancy ────────────────────────────────────── */}
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            Occupancy — {displayDate}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">

            <StatCard
              label="Full Day Stays"
              value={metrics.fullDay}
              icon={<Sun className="w-5 h-5" />}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Half Day Stays"
              value={metrics.halfDay}
              icon={<Moon className="w-5 h-5" />}
              color="bg-orange-50 text-orange-600"
            />
            <StatCard
              label="Today's Check-ins"
              value={metrics.checkIns}
              icon={<LogIn className="w-5 h-5" />}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Today's Check-outs"
              value={metrics.checkOuts}
              icon={<LogOut className="w-5 h-5" />}
              color="bg-red-50 text-red-600"
            />

            {/* Vacant rooms — shows cleaning/maint caveat (C4 fix) */}
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
              <div className="p-3 rounded-full bg-green-50 text-green-600">
                <DoorOpen className="w-5 h-5" />
              </div>
            </div>

            {/* Occupancy % (M2 fix) */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-xs font-bold mb-1">Occupancy Rate</h3>
                <p className="text-2xl font-black text-gray-900">{metrics.occupancyPct}%</p>
                <p className="text-[10px] text-gray-400 font-medium mt-0.5">{metrics.occupiedRooms} occupied</p>
              </div>
              <div className="p-3 rounded-full bg-indigo-50 text-indigo-600">
                <BarChart2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* ── Section 2: Revenue ──────────────────────────────────────── */}
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
            Revenue — {displayDate}
          </h2>
          <p className="text-[11px] text-gray-400 mb-4">
            FTD: counts bookings that checked in on this date · {metrics.totalBookings} total bookings loaded
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">

            {/* Total Revenue */}
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

          {/* Revenue breakdown verification row (M3 fix) */}
          {(() => {
            const sub  = metrics.revenueUPI + metrics.revenueCash + metrics.revenueCard + metrics.revenueOnline;
            const diff = metrics.revenueTotal - sub;
            if (metrics.revenueTotal === 0) return null;
            return (
              <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold mb-8 ${
                diff === 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
              }`}>
                {diff === 0 ? (
                  <><CheckCircle className="w-4 h-4 shrink-0" /> Revenue breakdown verified — UPI + Cash + Card + Cashfree = ₹{metrics.revenueTotal.toLocaleString('en-IN')}</>
                ) : (
                  <><AlertCircle className="w-4 h-4 shrink-0" /> Breakdown mismatch: ₹{Math.abs(diff).toLocaleString('en-IN')} unaccounted — check for mixed/unlisted payment methods</>
                )}
              </div>
            );
          })()}

          {/* ── Section 3: Financial Ledger ─────────────────────────────── */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center">
              <List className="w-4 h-4 mr-2" /> Financial Ledger & Balances
            </h2>
            {/* Total outstanding aggregate (M4 fix) */}
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
                  <tr>
                    <td colSpan="5" className="px-6 py-10 text-center text-gray-400">
                      No records found for this selection.
                    </td>
                  </tr>
                ) : (
                  [...bookings]
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .map(bkg => {
                      const total = bkg.totalAmount || 0;
                      // C5 fix: use transactions ledger when populated
                      const txSum = bkg.transactions?.length
                        ? bkg.transactions.reduce((s, t) => s + (t.amount || 0), 0)
                        : null;
                      const paid      = txSum !== null ? txSum : (bkg.advancePaid || 0);
                      const balanceDue = Math.max(0, total - paid);

                      return (
                        <tr key={bkg._id} className="hover:bg-gray-50 transition-colors">

                          {/* Guest */}
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              {bkg.guestName}
                              {bkg.source === 'ONLINE' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                                  <Globe className="w-2.5 h-2.5 mr-0.5" /> Online
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                              #{(bkg._id || bkg.id).toString().slice(-6).toUpperCase()}
                            </div>
                            {bkg.guestPhone && (
                              <div className="text-[10px] text-gray-400 mt-0.5">{bkg.guestPhone}</div>
                            )}
                          </td>

                          {/* Dates */}
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-900 font-medium">
                              In: {new Date(bkg.checkIn).toLocaleDateString('en-IN')}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Out: {new Date(bkg.checkOut).toLocaleDateString('en-IN')}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 uppercase">
                              {bkg.bookingType?.replace('_', ' ')}
                            </div>
                          </td>

                          {/* Billing */}
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900 flex items-center">
                              <IndianRupee className="w-3 h-3 mr-0.5" /> {total.toLocaleString('en-IN')} Total
                            </div>
                            <div className="text-xs text-green-600 font-medium mt-0.5 flex items-center gap-1">
                              Paid: ₹{paid.toLocaleString('en-IN')}
                              <span className="text-[10px] tracking-wider border border-green-200 bg-green-50 px-1.5 rounded uppercase">
                                {bkg.paymentMethod || '—'}
                              </span>
                            </div>
                          </td>

                          {/* Balance (C5 fix) */}
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

                          {/* Status */}
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
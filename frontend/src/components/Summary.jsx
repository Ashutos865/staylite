import { useState, useEffect } from 'react';
import {
  TrendingUp, Users, LogOut, IndianRupee, Sun, Moon,
  DoorOpen, DoorClosed, Calendar, Building2, Banknote, CreditCard, Smartphone, Loader2, List, CheckCircle, Download, FileSpreadsheet, FileText, Globe, Wifi
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function Summary({ user }) {
  // --- UI & FILTER STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProperty, setSelectedProperty] = useState('ALL');
  
  // Data State
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);

  // --- 1. FETCH DATA BASED ON ROLE ---
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!user || !user.role) return;

      setIsLoading(true);
      try {
        const token = localStorage.getItem('hotel_auth_token');
        
        // A. Fetch Properties 
        if (user.role === 'PROPERTY_OWNER' || user.role === 'SUPER_ADMIN') {
          const endpoint = user.role === 'SUPER_ADMIN' 
            ? 'http://localhost:5000/api/properties' 
            : 'http://localhost:5000/api/properties/my-hotels';

          const propRes = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (propRes.ok) setProperties(await propRes.json());
        }

        // B. Determine which properties to fetch Rooms for
        let targetProps = [];
        if (user.role === 'HOTEL_MANAGER') {
          const managerPropId = typeof user.assignedProperty === 'object' ? user.assignedProperty._id : user.assignedProperty;
          if (managerPropId) targetProps = [managerPropId];
        } else {
          targetProps = selectedProperty === 'ALL' ? properties.map(p => p._id) : [selectedProperty];
        }

        // C. Fetch All Rooms (To calculate Vacancy)
        let allRooms = [];
        for (const propId of targetProps) {
          if (!propId) continue;
          const roomRes = await fetch(`http://localhost:5000/api/properties/${propId}/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (roomRes.ok) allRooms = [...allRooms, ...(await roomRes.json())];
        }
        setRooms(allRooms);

        // D. Fetch Bookings 
        let bkgUrl = `http://localhost:5000/api/bookings/all`;
        if (user.role !== 'HOTEL_MANAGER' && selectedProperty !== 'ALL') {
          bkgUrl += `?propertyId=${selectedProperty}`;
        }

        const bkgRes = await fetch(bkgUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (bkgRes.ok) setBookings(await bkgRes.json());

      } catch (error) {
        console.error("Failed to fetch analytics data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [user?.role, user?.assignedProperty, selectedProperty, properties.length]); 

  // --- 2. CALCULATE METRICS ---
  const calculateMetrics = () => {
    const targetDate = new Date(selectedDate);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);

    let metrics = {
      fullDay: 0,
      halfDay: 0,
      checkOuts: 0,
      occupiedRoomIds: new Set(),
      revenueTotal: 0,
      revenueUPI: 0,
      revenueCash: 0,
      revenueCard: 0,
      revenueOnline: 0,
      onlineBookings: 0,
    };

    bookings.forEach(bkg => {
      const checkIn = new Date(bkg.checkIn);
      const checkOut = new Date(bkg.checkOut);

      const isActiveOnDate = (checkIn < nextDate && checkOut > targetDate) && 
                             (bkg.status === 'CONFIRMED' || bkg.status === 'CHECKED_IN');

      if (isActiveOnDate) {
        if (bkg.bookingType === 'FULL_DAY') metrics.fullDay++;
        if (bkg.bookingType === 'HALF_DAY') metrics.halfDay++;
        
        // NEW: Handle Multi-Room Assignments
        if (bkg.assignedRooms && bkg.assignedRooms.length > 0) {
          bkg.assignedRooms.forEach(ar => metrics.occupiedRoomIds.add(ar.room?._id || ar.room));
        } else if (bkg.room) {
          metrics.occupiedRoomIds.add(bkg.room._id || bkg.room); // Fallback for old data
        }
      }

      if (checkOut >= targetDate && checkOut < nextDate) {
        metrics.checkOuts++;
      }

      if (bkg.source === 'ONLINE') metrics.onlineBookings++;

      if (checkIn >= targetDate && checkIn < nextDate) {
        const amount = bkg.totalAmount || 0;
        metrics.revenueTotal += amount;
        if (bkg.paymentMethod === 'UPI')      metrics.revenueUPI    += amount;
        if (bkg.paymentMethod === 'CASH')     metrics.revenueCash   += amount;
        if (bkg.paymentMethod === 'CARD')     metrics.revenueCard   += amount;
        if (bkg.paymentMethod === 'CASHFREE') metrics.revenueOnline += amount;
      }
    });

    metrics.totalRooms = rooms.length;
    metrics.vacantRooms = Math.max(0, metrics.totalRooms - metrics.occupiedRoomIds.size);

    return metrics;
  };

  const metrics = calculateMetrics();

  // --- 3. EXPORT LOGIC (EXCEL & PDF) ---
  const generateReportData = () => {
    let sumTotal = 0, sumQR = 0, sumCash = 0, sumOnline = 0;
    
    // Filter bookings logically for the report (e.g., all bookings showing in the ledger)
    const reportRows = bookings.map(bkg => {
      const ci = new Date(bkg.checkIn).toLocaleDateString('en-GB');
      const co = new Date(bkg.checkOut).toLocaleDateString('en-GB');
      const roomCount = bkg.assignedRooms?.length || (bkg.room ? 1 : 0);
      const type = bkg.bookingType === 'FULL_DAY' ? 'Full Day' : 'Half Day';
      const total = bkg.totalAmount || 0;
      
      const qr = bkg.paymentMethod === 'UPI' ? total : 0;
      const cash = bkg.paymentMethod === 'CASH' ? total : 0;
      const online = bkg.paymentMethod === 'CARD' ? total : 0;

      sumTotal += total;
      sumQR += qr;
      sumCash += cash;
      sumOnline += online;

      return [
        ci, co, bkg.guestName, bkg.guestPhone, roomCount, type, 
        total, total, qr, cash, online, bkg.status.replace('_', ' ')
      ];
    });

    return { reportRows, sumTotal, sumQR, sumCash, sumOnline };
  };

  const exportToExcel = () => {
    const { reportRows, sumTotal, sumQR, sumCash, sumOnline } = generateReportData();

    // Replicate the exact structure requested in the image
    const wsData = [
      ['FTD XL / Day Close Report'],
      [],
      ['CI Date', 'CO Date', 'Guest Name', 'Number', 'Number of Room', 'Half Day/ Full Day', 'Price per Day', 'Total Price', 'QR', 'Cash', 'Online', 'Remark'],
      ...reportRows,
      [],
      ['Day Close Summary'],
      ['Price Per day', 'Sum Amount', '', '', '', '', '', sumTotal, sumQR, sumCash, sumOnline, '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `Hotel_Report_${selectedDate}.xlsx`);
  };

  const exportToPDF = () => {
    const { reportRows, sumTotal, sumQR, sumCash, sumOnline } = generateReportData();
    const doc = new jsPDF('landscape'); // Landscape for wide tables

    doc.setFontSize(18);
    doc.text(`Hotel Day Close Report - ${selectedDate}`, 14, 22);

    doc.autoTable({
      startY: 30,
      head: [['CI Date', 'CO Date', 'Guest Name', 'Number', 'Rooms', 'Type', 'Price/Day', 'Total', 'QR', 'Cash', 'Online', 'Remark']],
      body: reportRows,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
      styles: { fontSize: 8 },
    });

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Summary', 'Total Amount', 'QR (UPI)', 'Cash', 'Online (Card)']],
      body: [['Totals', `Rs. ${sumTotal}`, `Rs. ${sumQR}`, `Rs. ${sumCash}`, `Rs. ${sumOnline}`]],
      theme: 'grid',
      headStyles: { fillColor: [55, 65, 81] }, // Gray-700
    });

    doc.save(`Hotel_Report_${selectedDate}.pdf`);
  };

  return (
    <div className="p-4 sm:p-8">
      {/* Page Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Summary</h1>
          <p className="text-sm text-gray-500 mt-1">Real-time breakdown of occupancy and financials.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex-1 sm:flex-none">
            {/* Date Filter */}
            <div className="flex items-center px-3 border-r border-gray-100 flex-1 sm:flex-none">
              <Calendar className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
              />
            </div>

            {/* Property Filter */}
            {(user?.role === 'PROPERTY_OWNER' || user?.role === 'SUPER_ADMIN') && (
              <div className="flex items-center px-3 flex-1 sm:flex-none">
                <Building2 className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <select 
                  value={selectedProperty} 
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="w-full text-sm font-bold text-gray-700 outline-none bg-transparent cursor-pointer"
                >
                  <option value="ALL">{user?.role === 'SUPER_ADMIN' ? '🌍 All Properties (God View)' : '🏢 All My Properties'}</option>
                  {properties.map(prop => (
                    <option key={prop._id} value={prop._id}>{prop.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* EXPORT BUTTONS */}
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
          {/* --- SECTION 1: OCCUPANCY METRICS --- */}
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Occupancy Stats ({new Date(selectedDate).toLocaleDateString()})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
            {/* Full Day */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-bold mb-1">Full Day Stays</h3>
                <p className="text-2xl sm:text-3xl font-black text-gray-900">{metrics.fullDay}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-full bg-blue-50 text-blue-600"><Sun className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            </div>

            {/* Half Day */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-bold mb-1">Half Day Stays</h3>
                <p className="text-2xl sm:text-3xl font-black text-gray-900">{metrics.halfDay}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-full bg-orange-50 text-orange-600"><Moon className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            </div>

            {/* Vacant Rooms */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-bold mb-1">Vacant Rooms</h3>
                <p className="text-2xl sm:text-3xl font-black text-gray-900">
                  {metrics.vacantRooms} <span className="text-xs sm:text-sm text-gray-400 font-medium">/ {metrics.totalRooms}</span>
                </p>
              </div>
              <div className="p-3 sm:p-4 rounded-full bg-green-50 text-green-600"><DoorOpen className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            </div>

            {/* Checkouts */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-bold mb-1">Day Check-outs</h3>
                <p className="text-2xl sm:text-3xl font-black text-gray-900">{metrics.checkOuts}</p>
              </div>
              <div className="p-3 sm:p-4 rounded-full bg-red-50 text-red-600"><LogOut className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            </div>

            {/* Online Bookings */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-xs sm:text-sm font-bold mb-1">Online Bookings</h3>
                <p className="text-2xl sm:text-3xl font-black text-gray-900">{metrics.onlineBookings}</p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-1">via website</p>
              </div>
              <div className="p-3 sm:p-4 rounded-full bg-emerald-50 text-emerald-600"><Globe className="w-5 h-5 sm:w-6 sm:h-6" /></div>
            </div>
          </div>

          {/* --- SECTION 2: FINANCIAL METRICS --- */}
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue Generation ({new Date(selectedDate).toLocaleDateString()})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-10">
            
            {/* Total Revenue */}
            <div className="bg-indigo-600 p-5 sm:p-6 rounded-2xl shadow-md text-white flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-indigo-100 text-xs sm:text-sm font-bold uppercase tracking-wider">Total Revenue</h3>
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-200" />
              </div>
              <p className="text-3xl sm:text-4xl font-black flex items-center"><IndianRupee className="w-6 h-6 sm:w-8 sm:h-8 mr-1"/> {metrics.revenueTotal.toLocaleString()}</p>
            </div>

            {/* UPI */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">UPI Payments</h3>
                <p className="text-xl sm:text-2xl font-black text-gray-900 flex items-center"><IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 mr-1"/> {metrics.revenueUPI.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600"><Smartphone className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            </div>

            {/* Cash */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Cash Collection</h3>
                <p className="text-xl sm:text-2xl font-black text-gray-900 flex items-center"><IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 mr-1"/> {metrics.revenueCash.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Banknote className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            </div>

            {/* Card */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Card Swipes</h3>
                <p className="text-xl sm:text-2xl font-black text-gray-900 flex items-center"><IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 mr-1"/> {metrics.revenueCard.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><CreditCard className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            </div>

            {/* Cashfree / Online */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Online (Cashfree)</h3>
                <p className="text-xl sm:text-2xl font-black text-gray-900 flex items-center"><IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 mr-1"/> {metrics.revenueOnline.toLocaleString()}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><Wifi className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            </div>
          </div>

          {/* --- SECTION 3: FINANCIAL LEDGER & PAYMENT AUDIT --- */}
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
            <List className="w-4 h-4 mr-2" /> Financial Ledger & Balances
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-200">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Guest & ID</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Stay Dates</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Billing Details</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Balance Status</th>
                  <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Booking Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {bookings.length === 0 ? (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400">No records found for this selection.</td></tr>
                ) : (
                  [...bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(bkg => {
                    const total = bkg.totalAmount || 0;
                    const paid = bkg.advancePaid || 0;
                    const balanceDue = Math.max(0, total - paid);

                    return (
                      <tr key={bkg._id} className="hover:bg-gray-50 transition-colors">
                        {/* Guest Info */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-gray-900 flex items-center gap-1.5">
                            {bkg.guestName}
                            {bkg.source === 'ONLINE' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                                <Globe className="w-2.5 h-2.5 mr-0.5" /> Online
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {(bkg._id || bkg.id).toString().slice(-6).toUpperCase()}</div>
                          {bkg.guestEmail && <div className="text-[10px] text-gray-400 mt-0.5">{bkg.guestEmail}</div>}
                        </td>
                        
                        {/* Dates */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-xs text-gray-900 font-medium">In: {new Date(bkg.checkIn).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Out: {new Date(bkg.checkOut).toLocaleDateString()}</div>
                        </td>
                        
                        {/* Billing Breakdown */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900 flex items-center"><IndianRupee className="w-3 h-3 mr-0.5"/> {total} Total</div>
                          <div className="text-xs text-green-600 font-medium mt-0.5 flex items-center">
                            Paid: ₹{paid} <span className="text-gray-400 mx-1">•</span> <span className="uppercase text-[10px] tracking-wider border border-green-200 bg-green-50 px-1.5 rounded">{bkg.paymentMethod || 'UPI'}</span>
                          </div>
                        </td>
                        
                        {/* Balance Badge */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          {balanceDue > 0 ? (
                            <span className="bg-red-50 text-red-700 px-2.5 py-1 rounded-md text-xs font-bold border border-red-100 flex items-center w-max">
                              Due: ₹{balanceDue}
                            </span>
                          ) : (
                            <span className="bg-green-50 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold border border-green-100 flex items-center w-max">
                              <CheckCircle className="w-3 h-3 mr-1" /> Settled
                            </span>
                          )}
                        </td>
                        
                        {/* Booking Status */}
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider
                            ${bkg.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' : 
                              bkg.status === 'CHECKED_IN' ? 'bg-indigo-100 text-indigo-700' : 
                              bkg.status === 'PENDING_ASSIGNMENT' ? 'bg-yellow-100 text-yellow-700' :
                              bkg.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'}`}>
                            {bkg.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    )
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
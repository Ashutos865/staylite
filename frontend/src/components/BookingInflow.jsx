import { useState, useEffect } from 'react';
import { Search, Plus, UploadCloud, X, AlertCircle, Building, Loader2, IndianRupee, AlertTriangle, Users, Sparkles, CheckCircle2 } from 'lucide-react';

export default function BookingInflow({ user }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]); 
  const [activePropertyId, setActivePropertyId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isOverbooked, setIsOverbooked] = useState(false);

  // --- CRM STATE ---
  const [guestHistory, setGuestHistory] = useState(null);
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);

  const [formData, setFormData] = useState({
    guestName: '',
    guestPhone: '',
    guestCount: 1, 
    bookingType: 'FULL_DAY',
    checkIn: '',
    checkOut: '',
    reqType: 'AC', 
    totalAmount: '',   
    advancePaid: '',   
    paymentMethod: 'UPI' 
  });

  // --- FETCH DATA (WITH SUPER ADMIN GOD VIEW) ---
  useEffect(() => {
    const fetchPropertiesAndBookings = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('hotel_auth_token');
        let currentPropId = activePropertyId;

        if (user?.role === 'SUPER_ADMIN' || user?.role === 'PROPERTY_OWNER') {
          if (properties.length === 0) {
            const endpoint = user?.role === 'SUPER_ADMIN' 
              ? 'http://localhost:5000/api/properties' 
              : 'http://localhost:5000/api/properties/my-hotels';

            const propRes = await fetch(endpoint, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
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
          const bkgRes = await fetch(`http://localhost:5000/api/bookings/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (bkgRes.ok) setBookings(await bkgRes.json());
          setRooms([]); 
        } else if (currentPropId) {
          const bkgRes = await fetch(`http://localhost:5000/api/bookings/property/${currentPropId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (bkgRes.ok) setBookings(await bkgRes.json());

          const roomRes = await fetch(`http://localhost:5000/api/properties/${currentPropId}/rooms`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (roomRes.ok) setRooms(await roomRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPropertiesAndBookings();
  }, [user, activePropertyId, properties.length]);

  // --- REAL-TIME OVERLAP PREDICTOR ---
  useEffect(() => {
    if (!formData.checkIn || !formData.checkOut || rooms.length === 0) {
      setIsOverbooked(false);
      return;
    }

    const start = new Date(formData.checkIn);
    const end = new Date(formData.checkOut);

    if (start >= end) {
      setIsOverbooked(false);
      return;
    }

    const matchingRooms = rooms.filter(r => 
      formData.reqType === 'AC' ? !r.category.includes('NON_AC') : r.category.includes('NON_AC')
    );
    const totalCapacity = matchingRooms.length;

    const overlapping = bookings.filter(b => {
      if (b.status !== 'CONFIRMED' && b.status !== 'CHECKED_IN') return false;
      if (b.reqType !== formData.reqType) return false;
      
      const bStart = new Date(b.checkIn);
      const bEnd = new Date(b.checkOut);
      
      return (bStart < end && bEnd > start);
    });

    if (totalCapacity === 0 || overlapping.length >= totalCapacity) {
      setIsOverbooked(true);
    } else {
      setIsOverbooked(false);
    }

  }, [formData.checkIn, formData.checkOut, formData.reqType, rooms, bookings]);

  // --- CRM PHONE DEBOUNCER ---
  useEffect(() => {
    const phone = formData.guestPhone.trim();
    
    // If phone length is roughly valid, search the DB
    if (phone.length >= 10) {
      setIsSearchingGuest(true);
      
      // Debounce: Wait 600ms after user stops typing before hitting API
      const delayDebounceFn = setTimeout(async () => {
        try {
          const token = localStorage.getItem('hotel_auth_token');
          const res = await fetch(`http://localhost:5000/api/bookings/guest/${phone}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setGuestHistory(data);
          } else {
            setGuestHistory(null);
          }
        } catch (e) {
          setGuestHistory(null);
        } finally {
          setIsSearchingGuest(false);
        }
      }, 600); 

      return () => clearTimeout(delayDebounceFn);
    } else {
      setGuestHistory(null);
      setIsSearchingGuest(false);
    }
  }, [formData.guestPhone]);

  // --- HANDLERS ---
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGuestCountChange = (delta) => {
    setFormData(prev => ({
      ...prev,
      guestCount: Math.max(1, prev.guestCount + delta)
    }));
  };

  const handleAutoFill = () => {
    if (guestHistory) {
      setFormData(prev => ({
        ...prev,
        guestName: guestHistory.guestName,
      }));
    }
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('hotel_auth_token');
      const payload = { ...formData, propertyId: activePropertyId };

      const response = await fetch('http://localhost:5000/api/bookings/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();

      if (response.ok) {
        const bkgRes = await fetch(`http://localhost:5000/api/bookings/property/${activePropertyId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (bkgRes.ok) setBookings(await bkgRes.json());
        
        setIsModalOpen(false);
        setGuestHistory(null); // Clear history UI
        setFormData({ 
          guestName: '', guestPhone: '', guestCount: 1, bookingType: 'FULL_DAY', 
          checkIn: '', checkOut: '', reqType: 'AC', 
          totalAmount: '', advancePaid: '', paymentMethod: 'UPI' 
        });
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      alert('Failed to connect to the backend server.');
    }
  };

  return (
    <div className="p-4 sm:p-8 relative max-w-full">
      {/* HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Booking Inflow</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Capture guest details, dates, and payments here.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center w-full sm:w-auto gap-3">
          {(user?.role === 'PROPERTY_OWNER' || user?.role === 'SUPER_ADMIN') && (
            <select 
              value={activePropertyId} 
              onChange={(e) => setActivePropertyId(e.target.value)}
              className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {user?.role === 'SUPER_ADMIN' && <option value="ALL">🌍 All Properties (God View)</option>}
              {properties.map(prop => (
                <option key={prop._id} value={prop._id}>{prop.name}</option>
              ))}
            </select>
          )}

          <button 
            onClick={() => setIsModalOpen(true)} 
            disabled={!activePropertyId || activePropertyId === 'ALL'}
            title={activePropertyId === 'ALL' ? "Select a specific hotel to add a booking" : "New Booking"}
            className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" /> New Booking
          </button>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
              <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Booking Ref</th>
              <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Guest & Property</th>
              <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Dates & Type</th>
              <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Financials</th>
              <th className="px-4 sm:px-6 py-4 whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {isLoading ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/> Loading secure database...</td></tr>
            ) : bookings.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400">No active bookings found.</td></tr>
            ) : (
              bookings.map((bkg) => (
                <tr key={bkg._id || bkg.id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-4 font-mono text-xs font-bold text-blue-600 whitespace-nowrap">
                    {(bkg._id || bkg.id).toString().slice(-6).toUpperCase()}
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-gray-900">{bkg.guestName}</div>
                    <div className="text-[10px] font-bold text-gray-500 flex items-center mt-0.5">
                      <Users className="w-3 h-3 mr-1" /> {bkg.guestCount || 1} Guest{(bkg.guestCount || 1) > 1 ? 's' : ''}
                    </div>
                    {(user?.role === 'SUPER_ADMIN' || activePropertyId === 'ALL') && bkg.property?.name && (
                      <div className="text-[10px] font-bold text-indigo-600 flex items-center mt-0.5">
                        <Building className="w-3 h-3 mr-1" /> {bkg.property.name}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-0.5">Req: {bkg.reqType}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-xs font-semibold text-gray-700">{bkg.bookingType === 'FULL_DAY' ? 'Full Day' : 'Half Day'}</div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900 flex items-center">
                      <IndianRupee className="w-3 h-3 mr-0.5" /> {bkg.totalAmount || 0}
                    </div>
                    <div className="text-xs text-gray-500 font-medium">
                      Adv: ₹{bkg.advancePaid || 0} <span className="text-gray-300 mx-1">|</span> {bkg.paymentMethod || 'UPI'}
                    </div>
                  </td>
                  <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                    {bkg.status === 'PENDING_ASSIGNMENT' ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-yellow-100 text-yellow-700 flex items-center w-max">
                        <AlertCircle className="w-3 h-3 mr-1" /> Pending Assignment
                      </span>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-max
                        ${bkg.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' : 
                          bkg.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' : 
                          'bg-gray-100 text-gray-700'}`}>
                        {bkg.status.replace('_', ' ')}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- STREAMLINED BOOKING MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100 bg-white shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create New Reservation</h2>
              <button onClick={() => { setIsModalOpen(false); setGuestHistory(null); }} className="p-1"><X className="w-6 h-6 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <form onSubmit={handleSubmitBooking} className="p-4 sm:p-6 space-y-6 sm:space-y-8 overflow-y-auto flex-1">
              
              {/* Guest Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">1. Guest Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                  
                  <div className="relative">
                    <input type="tel" name="guestPhone" required value={formData.guestPhone} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Phone Number" />
                    {isSearchingGuest && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-2.5" />}
                  </div>

                  <input type="text" name="guestName" required value={formData.guestName} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Full Name" />

                  {/* CRM CARD - Returns if guest history is found */}
                  {guestHistory && (
                    <div className="sm:col-span-2 bg-indigo-50 border border-indigo-100 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                        <div className="flex items-center">
                          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg mr-3">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-indigo-900 flex items-center">Returning Guest! <CheckCircle2 className="w-3.5 h-3.5 text-green-500 ml-1" /></h4>
                            <p className="text-xs font-medium text-indigo-700">{guestHistory.guestName} • {guestHistory.totalStays} Past Stay{guestHistory.totalStays > 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={handleAutoFill} 
                          className="w-full sm:w-auto bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-sm whitespace-nowrap"
                        >
                          Auto-Fill Details
                        </button>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-indigo-200/50">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Recent Visits</p>
                        <div className="flex flex-wrap gap-2">
                          {guestHistory.history.map((stay, idx) => (
                             <span key={idx} className="bg-white border border-indigo-100 text-indigo-700 text-[10px] px-2 py-1 rounded shadow-sm">
                               {new Date(stay.checkIn).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })} • Room {stay.room ? stay.room.roomNumber : 'Unk'}
                             </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Number of Guests</label>
                    <div className="flex items-center border border-gray-300 rounded-lg h-[38px] overflow-hidden">
                      <button type="button" onClick={() => handleGuestCountChange(-1)} className="px-4 font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 h-full border-r border-gray-300 transition-colors">-</button>
                      <div className="flex-1 text-center text-sm font-bold text-gray-900">{formData.guestCount}</div>
                      <button type="button" onClick={() => handleGuestCountChange(1)} className="px-4 font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 h-full border-l border-gray-300 transition-colors">+</button>
                    </div>
                  </div>

                  <div className="w-full border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 flex items-center justify-center text-sm text-gray-500 cursor-pointer hover:bg-gray-50 transition h-[38px] sm:mt-[18px]">
                    <UploadCloud className="w-4 h-4 mr-2" /> Upload ID (R2)
                  </div>

                  {formData.guestCount > 2 && (
                    <div className="sm:col-span-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-start">
                      <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                      <p>You have selected <strong>{formData.guestCount} guests</strong>. This group may require multiple rooms or extra mattress adjustments during assignment.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Stay Details & Room Preference */}
              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">2. Stay Details</h3>
                  <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                    <button type="button" onClick={() => setFormData({...formData, bookingType: 'FULL_DAY'})} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-md transition-colors ${formData.bookingType === 'FULL_DAY' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Full Day</button>
                    <button type="button" onClick={() => setFormData({...formData, bookingType: 'HALF_DAY'})} className={`flex-1 sm:flex-none px-3 py-1 text-xs font-medium rounded-md transition-colors ${formData.bookingType === 'HALF_DAY' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Half Day</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Check-in</label>
                    <input type={formData.bookingType === 'HALF_DAY' ? "datetime-local" : "date"} required name="checkIn" value={formData.checkIn} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Check-out</label>
                    <input type={formData.bookingType === 'HALF_DAY' ? "datetime-local" : "date"} required name="checkOut" value={formData.checkOut} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="sm:col-span-2 mt-1 sm:mt-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Requested Room Type</label>
                    <select name="reqType" onChange={handleInputChange} value={formData.reqType} className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none text-blue-900 font-medium">
                      <option value="AC">AC Room</option>
                      <option value="NON_AC">Non-AC Room</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Billing & Payment */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">3. Billing & Payment</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Total Amount (₹)</label>
                    <input type="number" min="0" required name="totalAmount" value={formData.totalAmount} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Advance Paid (₹)</label>
                    <input type="number" min="0" required name="advancePaid" value={formData.advancePaid} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Payment Method</label>
                    <select name="paymentMethod" onChange={handleInputChange} value={formData.paymentMethod} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>

                  {isOverbooked && (
                    <div className="sm:col-span-3 bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mt-2 flex items-start">
                      <AlertTriangle className="w-5 h-5 text-red-600 mr-2 sm:mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-red-800">Capacity Warning: No Rooms Available</h4>
                        <p className="text-xs text-red-700 mt-1">
                          Based on existing reservations, all {formData.reqType === 'AC' ? 'AC' : 'Non-AC'} rooms are booked for these dates. You can save to the queue, but a room may not be available.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-0 sm:space-x-3 mt-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setGuestHistory(null); }} className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition">
                  Cancel
                </button>
                <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm">
                  {isOverbooked ? 'Force Book Anyway' : 'Save Secure Booking'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
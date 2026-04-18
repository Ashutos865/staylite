import { useState, useEffect } from 'react';
import { Shield, UserPlus, Building2, Mail, Lock, Users, Activity, Globe, Search, Calendar, Filter, IndianRupee, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState('TENANTS'); // 'TENANTS' or 'BOOKINGS'

  // --- TENANT MANAGEMENT STATE ---
  const [formData, setFormData] = useState({ name: '', email: '', password: '', maxHotelsAllowed: 1 });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [owners, setOwners] = useState([]);
  const [isOwnersLoading, setIsOwnersLoading] = useState(true);

  // --- GLOBAL BOOKINGS STATE (GOD VIEW) ---
  const [bookings, setBookings] = useState([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);
  const [filters, setFilters] = useState({
    search: '',
    status: 'ALL',
    startDate: '',
    endDate: ''
  });

  // ==========================================
  // FETCH LOGIC
  // ==========================================
  const fetchOwners = async () => {
    try {
      const token = localStorage.getItem('hotel_auth_token');
      const response = await fetch('http://localhost:5000/api/admin/owners', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) setOwners(await response.json());
    } catch (error) {
      console.error("Failed to fetch owners");
    } finally {
      setIsOwnersLoading(false);
    }
  };

  const fetchGlobalBookings = async () => {
    setIsBookingsLoading(true);
    try {
      const token = localStorage.getItem('hotel_auth_token');
      
      // Build Query String from Filters
      const queryParams = new URLSearchParams();
      if (filters.search) queryParams.append('search', filters.search);
      if (filters.status !== 'ALL') queryParams.append('status', filters.status);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const response = await fetch(`http://localhost:5000/api/bookings/all?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) setBookings(await response.json());
    } catch (error) {
      console.error("Failed to fetch global bookings");
    } finally {
      setIsBookingsLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    fetchOwners();
  }, []);

  // Fetch bookings when switching to the Bookings tab
  useEffect(() => {
    if (activeTab === 'BOOKINGS') {
      fetchGlobalBookings();
    }
  }, [activeTab]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const applyFilters = (e) => {
    e.preventDefault();
    fetchGlobalBookings();
  };

  const handleCreateOwner = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: 'Creating owner...' });

    try {
      const token = localStorage.getItem('hotel_auth_token');
      const response = await fetch('http://localhost:5000/api/admin/create-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: `Success! ${data.owner.email} provisioned.` });
        setFormData({ name: '', email: '', password: '', maxHotelsAllowed: 1 });
        fetchOwners();
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to connect to the backend server.' });
    }
  };

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Shield className="w-6 h-6 text-indigo-600 mr-2" />
          Super Admin Command Center
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage tenant subscriptions and oversee global SaaS operations.</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-200 mb-8">
        <button 
          onClick={() => setActiveTab('TENANTS')}
          className={`px-6 py-3 text-sm font-bold flex items-center border-b-2 transition-colors ${activeTab === 'TENANTS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Users className="w-4 h-4 mr-2" /> Tenant Management
        </button>
        <button 
          onClick={() => setActiveTab('BOOKINGS')}
          className={`px-6 py-3 text-sm font-bold flex items-center border-b-2 transition-colors ${activeTab === 'BOOKINGS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Globe className="w-4 h-4 mr-2" /> Global Bookings (God View)
        </button>
      </div>

      {/* ========================================== */}
      {/* VIEW 1: TENANT MANAGEMENT                  */}
      {/* ========================================== */}
      {activeTab === 'TENANTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN: Creation Form */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                <h2 className="text-sm font-bold text-gray-900 flex items-center uppercase tracking-wider">
                  <UserPlus className="w-4 h-4 text-gray-500 mr-2" />
                  New Tenant
                </h2>
              </div>

              <form onSubmit={handleCreateOwner} className="p-5 space-y-4">
                {status.message && (
                  <div className={`p-3 rounded-lg text-xs font-bold ${status.type === 'success' ? 'bg-green-50 text-green-700' : status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                    {status.message}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name</label>
                  <input type="text" name="name" required value={formData.name} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
                    <Mail className="w-3 h-3 mr-1 text-gray-400" /> Email Address
                  </label>
                  <input type="email" name="email" required value={formData.email} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
                    <Building2 className="w-3 h-3 mr-1 text-gray-400" /> Max Hotels Allowed
                  </label>
                  <input type="number" name="maxHotelsAllowed" min="1" required value={formData.maxHotelsAllowed} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-indigo-50 text-indigo-900 font-bold" />
                  <p className="text-[10px] text-gray-500 mt-1">This limits how many properties they can build.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center">
                    <Lock className="w-3 h-3 mr-1 text-gray-400" /> Temporary Password
                  </label>
                  <input type="password" name="password" minLength="6" required value={formData.password} onChange={handleInputChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div className="pt-2">
                  <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors">
                    Provision Account
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: Client List */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h2 className="text-sm font-bold text-gray-900 flex items-center uppercase tracking-wider">
                  <Users className="w-4 h-4 text-gray-500 mr-2" /> Active Property Owners
                </h2>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-full">{owners.length} Total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-200">
                      <th className="px-6 py-4 font-semibold">Owner Details</th>
                      <th className="px-6 py-4 font-semibold">Hotel Limit</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {isOwnersLoading ? (
                      <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/> Loading...</td></tr>
                    ) : owners.length === 0 ? (
                      <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-400">No Property Owners provisioned yet.</td></tr>
                    ) : (
                      owners.map((owner) => (
                        <tr key={owner._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{owner.name}</div>
                            <div className="text-xs text-gray-500">{owner.email}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-md text-xs flex items-center w-max">
                              <Building2 className="w-3 h-3 mr-1" /> {owner.maxHotelsAllowed} Hotels
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="flex items-center text-xs font-bold text-green-600"><Activity className="w-3 h-3 mr-1" /> Active</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* VIEW 2: GLOBAL BOOKINGS (GOD VIEW)         */}
      {/* ========================================== */}
      {activeTab === 'BOOKINGS' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <form onSubmit={applyFilters} className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Search Guest</label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input type="text" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Name or Phone..." className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              
              <div className="w-full md:w-48">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                <div className="relative">
                  <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <select name="status" value={filters.status} onChange={handleFilterChange} className="w-full pl-9 pr-3 py-2 border border-gray-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">
                    <option value="ALL">All Statuses</option>
                    <option value="PENDING_ASSIGNMENT">Pending Room</option>
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="CHECKED_IN">Checked In</option>
                    <option value="CHECKED_OUT">Checked Out</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="w-full md:w-40">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
                <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <div className="w-full md:w-40">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
                <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>

              <button type="submit" className="w-full md:w-auto px-6 py-2 bg-gray-900 hover:bg-black text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center">
                Apply Filters
              </button>
            </form>
          </div>

          {/* Master Data Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-4">Booking Ref</th>
                    <th className="px-6 py-4">Property & Room</th>
                    <th className="px-6 py-4">Guest Details</th>
                    <th className="px-6 py-4">Timeline</th>
                    <th className="px-6 py-4">Financials</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {isBookingsLoading ? (
                    <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2"/> Querying Global Database...</td></tr>
                  ) : bookings.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-400">No bookings match your global filters.</td></tr>
                  ) : (
                    bookings.map((bkg) => (
                      <tr key={bkg._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-indigo-600">
                          {bkg._id.toString().slice(-6).toUpperCase()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 flex items-center">
                            <Building2 className="w-3 h-3 mr-1 text-gray-400" />
                            {bkg.property?.name || 'Unknown Property'}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {bkg.room ? `Room ${bkg.room.roomNumber} (${bkg.room.category.replace('_', ' ')})` : 'Room Not Assigned'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900">{bkg.guestName}</div>
                          <div className="text-xs text-gray-500">{bkg.guestPhone}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold text-gray-700 flex items-center mb-1">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(bkg.checkIn).toLocaleDateString()} - {new Date(bkg.checkOut).toLocaleDateString()}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${bkg.bookingType === 'FULL_DAY' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                            {bkg.bookingType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-900 flex items-center">
                            <IndianRupee className="w-3 h-3 mr-0.5" /> {bkg.totalAmount}
                          </div>
                          <div className="text-xs text-gray-500">Adv: ₹{bkg.advancePaid} ({bkg.paymentMethod})</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-max
                            ${bkg.status === 'PENDING_ASSIGNMENT' ? 'bg-yellow-100 text-yellow-700' : 
                              bkg.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' : 
                              bkg.status === 'CHECKED_IN' ? 'bg-green-100 text-green-700' : 
                              bkg.status === 'CHECKED_OUT' ? 'bg-gray-100 text-gray-700' : 
                              'bg-red-100 text-red-700'}`}>
                            {bkg.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
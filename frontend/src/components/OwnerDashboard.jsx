import { useState, useEffect, useRef } from 'react';
import { Building2, MapPin, Phone, Plus, User, Mail, Lock, Edit, X, Save, Loader2, ImagePlus, Trash2, Images } from 'lucide-react';

export default function OwnerDashboard({ user }) {
  const [hotels, setHotels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState({ type: '', message: '' });
  
  // State for CREATING
  const [hotelForm, setHotelForm] = useState({ 
    name: '', address: '', contactNumber: '',
    managerName: '', managerEmail: '', managerPassword: ''
  });

  // State for PHOTO UPLOAD
  const [photoUploading, setPhotoUploading] = useState(''); // hotelId currently uploading
  const photoInputRefs = useRef({});

  const handlePhotoUpload = async (hotelId, files) => {
    if (!files || files.length === 0) return;
    setPhotoUploading(hotelId);
    try {
      const token = localStorage.getItem('hotel_auth_token');
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('photos', f));
      const res = await fetch(`http://localhost:5000/api/properties/${hotelId}/photos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      });
      if (res.ok) fetchHotels();
      else {
        const d = res.headers.get('content-type')?.includes('application/json') ? await res.json() : {};
        alert(d.message || 'Photo upload failed.');
      }
    } catch { alert('Upload failed.'); }
    finally { setPhotoUploading(''); }
  };

  const handlePhotoDelete = async (hotelId, photoUrl) => {
    if (!window.confirm('Remove this photo?')) return;
    try {
      const token = localStorage.getItem('hotel_auth_token');
      const res = await fetch(`http://localhost:5000/api/properties/${hotelId}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ photoUrl })
      });
      if (res.ok) fetchHotels();
    } catch { alert('Delete failed.'); }
  };

  // State for EDITING
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editStatus, setEditStatus] = useState({ type: '', message: '' });
  const [editForm, setEditForm] = useState({
    id: '', name: '', address: '', contactNumber: '',
    managerEmail: '', // Now editable!
    managerPassword: '' // Only allow reset here for security
  });

  // --- FETCH HOTELS (With Manager Details) ---
  const fetchHotels = async () => {
    try {
      const token = localStorage.getItem('hotel_auth_token');
      const response = await fetch('http://localhost:5000/api/properties/my-hotels', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHotels(data);
      }
    } catch (error) {
      console.error("Failed to fetch hotels");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHotels();
  }, []);

  // --- SUBMIT NEW HOTEL ---
  const handleCreateHotel = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', message: 'Provisioning Hotel & Manager...' });

    try {
      const token = localStorage.getItem('hotel_auth_token');
      const response = await fetch('http://localhost:5000/api/properties/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(hotelForm)
      });
      
      const data = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: 'Success! Hotel built and Manager assigned.' });
        setHotelForm({ name: '', address: '', contactNumber: '', managerName: '', managerEmail: '', managerPassword: '' });
        fetchHotels(); 
      } else {
        setStatus({ type: 'error', message: data.message });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to connect to server.' });
    }
  };

  // --- OPEN EDIT MODAL ---
  const openEditModal = (hotel) => {
    setEditStatus({ type: '', message: '' });
    setEditForm({
      id: hotel._id,
      name: hotel.name,
      address: hotel.address,
      contactNumber: hotel.contactNumber,
      managerEmail: hotel.managerDetails?.email || '', // Pre-fill their current Login ID
      managerPassword: '' 
    });
    setIsEditModalOpen(true);
  };

  // --- SUBMIT EDITS ---
  const handleUpdateHotel = async (e) => {
    e.preventDefault();
    setEditStatus({ type: 'loading', message: 'Updating property...' });

    try {
      const token = localStorage.getItem('hotel_auth_token');
      const response = await fetch(`http://localhost:5000/api/properties/${editForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(editForm)
      });
      
      const data = await response.json();

      if (response.ok) {
        setEditStatus({ type: 'success', message: 'Property successfully updated!' });
        setTimeout(() => {
          setIsEditModalOpen(false);
          fetchHotels(); 
        }, 1000);
      } else {
        setEditStatus({ type: 'error', message: data.message });
      }
    } catch (error) {
      setEditStatus({ type: 'error', message: 'Failed to connect to server.' });
    }
  };

  const isLimitReached = hotels.length >= user?.maxHotelsAllowed;

  return (
    <div className="p-8 relative">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <Building2 className="w-6 h-6 text-blue-600 mr-2" />
            My Properties
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your hotel portfolio and staff.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-sm font-bold text-gray-700">
          Subscription Limit: <span className={isLimitReached ? 'text-red-600' : 'text-blue-600'}>{hotels.length} / {user?.maxHotelsAllowed} Hotels</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Hotel & Manager Registration */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden sticky top-8">
            <div className="p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-bold text-gray-900 flex items-center uppercase tracking-wider">
                <Plus className="w-4 h-4 text-gray-500 mr-2" /> Register Property & Staff
              </h2>
            </div>

            {isLimitReached ? (
              <div className="p-6">
                <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm font-medium border border-red-100 text-center">
                  You have reached your maximum limit of {user?.maxHotelsAllowed} hotel(s). Contact the Super Admin to upgrade your SaaS subscription.
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateHotel} className="p-6 space-y-6">
                {status.message && (
                  <div className={`p-3 rounded-lg text-xs font-bold ${status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {status.message}
                  </div>
                )}
                
                {/* Section 1: Property Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b pb-1">1. Property Details</h3>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Hotel Name</label>
                    <input type="text" required value={hotelForm.name} onChange={(e) => setHotelForm({...hotelForm, name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Grand Plaza" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
                    <input type="text" required value={hotelForm.address} onChange={(e) => setHotelForm({...hotelForm, address: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Number</label>
                    <input type="tel" required value={hotelForm.contactNumber} onChange={(e) => setHotelForm({...hotelForm, contactNumber: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>

                {/* Section 2: Manager Details */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b pb-1">2. Manager Account</h3>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center"><User className="w-3 h-3 mr-1"/> Manager Name</label>
                    <input type="text" required value={hotelForm.managerName} onChange={(e) => setHotelForm({...hotelForm, managerName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center"><Mail className="w-3 h-3 mr-1"/> Manager Email</label>
                    <input type="email" required value={hotelForm.managerEmail} onChange={(e) => setHotelForm({...hotelForm, managerEmail: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center"><Lock className="w-3 h-3 mr-1"/> Temporary Password</label>
                    <input type="password" minLength="6" required value={hotelForm.managerPassword} onChange={(e) => setHotelForm({...hotelForm, managerPassword: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Min 6 characters" />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button type="submit" disabled={status.type === 'loading'} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex items-center justify-center">
                    {status.type === 'loading' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Build Hotel & Provision Manager'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Hotel List */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Fetching your properties...</p>
            </div>
          ) : hotels.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-20 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-gray-900 font-bold mb-1">No properties found</h3>
              <p className="text-sm text-gray-500">Use the form on the left to register your first hotel and manager.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {hotels.map(hotel => (
                <div key={hotel._id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all relative group">
                  
                  {/* Edit Button (Visible on Hover) */}
                  <button 
                    onClick={() => openEditModal(hotel)}
                    className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Edit Property"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Building2 className="w-5 h-5" /></div>
                    <h3 className="font-bold text-lg text-gray-900">{hotel.name}</h3>
                  </div>
                  
                  <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase inline-block mb-4">Active</span>
                  
                  <div className="space-y-3">
                    <div className="flex items-start text-xs text-gray-500">
                      <MapPin className="w-3.5 h-3.5 mr-2 text-gray-400 mt-0.5" />
                      <span>{hotel.address}</span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                      <span>{hotel.contactNumber}</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[10px]">
                        ID
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Login ID (Email)</span>
                        <span className="text-xs font-semibold text-gray-700">{hotel.managerDetails?.email || 'Not Linked'}</span>
                      </div>
                    </div>
                  </div>

                  {/* PHOTO GALLERY */}
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center">
                        <Images className="w-3 h-3 mr-1" /> Hotel Photos ({(hotel.photos || []).length}/5)
                      </span>
                      {(hotel.photos || []).length < 5 && (
                        <button
                          type="button"
                          onClick={() => photoInputRefs.current[hotel._id]?.click()}
                          disabled={photoUploading === hotel._id}
                          className="flex items-center text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          {photoUploading === hotel._id
                            ? <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            : <ImagePlus className="w-3 h-3 mr-1" />}
                          Upload
                        </button>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        ref={el => { photoInputRefs.current[hotel._id] = el; }}
                        onChange={e => handlePhotoUpload(hotel._id, e.target.files)}
                      />
                    </div>

                    {(hotel.photos || []).length === 0 ? (
                      <button
                        type="button"
                        onClick={() => photoInputRefs.current[hotel._id]?.click()}
                        className="w-full h-20 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-300 hover:text-blue-400 transition-colors"
                      >
                        <ImagePlus className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-medium">Add photos (up to 5)</span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {hotel.photos.map((url, i) => (
                          <div key={i} className="relative group/photo aspect-square rounded-lg overflow-hidden bg-gray-100">
                            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handlePhotoDelete(hotel._id, url)}
                              className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ========================================== */}
      {/* EDIT MODAL                                 */}
      {/* ========================================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 flex items-center">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Edit className="w-5 h-5 text-blue-600 mr-2" />
                Edit Property Details
              </h2>
              <button onClick={() => setIsEditModalOpen(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>

            <form onSubmit={handleUpdateHotel} className="p-6 space-y-6">
              {editStatus.message && (
                <div className={`p-3 rounded-lg text-xs font-bold ${editStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {editStatus.message}
                </div>
              )}

              {/* Edit Property Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b pb-1">1. Update Hotel</h3>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Hotel Name</label>
                  <input type="text" required value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Address</label>
                  <input type="text" required value={editForm.address} onChange={(e) => setEditForm({...editForm, address: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Number</label>
                  <input type="tel" required value={editForm.contactNumber} onChange={(e) => setEditForm({...editForm, contactNumber: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              {/* Update Manager Details */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b pb-1">2. Update Manager Access</h3>
                
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center"><Mail className="w-3 h-3 mr-1"/> Login ID (Email)</label>
                  <input 
                    type="email" 
                    required 
                    value={editForm.managerEmail} 
                    onChange={(e) => setEditForm({...editForm, managerEmail: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center"><Lock className="w-3 h-3 mr-1"/> New Password (Optional)</label>
                  <input 
                    type="password" 
                    minLength="6" 
                    value={editForm.managerPassword} 
                    onChange={(e) => setEditForm({...editForm, managerPassword: e.target.value})} 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Leave blank to keep current password" 
                  />
                  <p className="text-[10px] text-gray-500 mt-1">If your manager forgot their password, type a new one here to override it.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition">Cancel</button>
                <button type="submit" disabled={editStatus.type === 'loading'} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm flex items-center">
                  {editStatus.type === 'loading' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
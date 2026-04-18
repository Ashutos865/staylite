import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { CalendarDays, Package, BarChart3, LogOut, Hotel, UserCircle, ShieldCheck, Building, Loader2, Menu, X } from 'lucide-react';

// --- IMPORT ALL REAL COMPONENTS ---
import Login from './components/Login';
import BookingInflow from './components/BookingInflow';
import Inventory from './components/Inventory';
import Summary from './components/Summary'; 
import AdminDashboard from './components/AdminDashboard';
import OwnerDashboard from './components/OwnerDashboard';

// --- SIDEBAR COMPONENT ---
const Sidebar = ({ onLogout, user, isOpen, setIsOpen }) => {
  const location = useLocation();
  
  // Define routes and who is allowed to see them
  const navItems = [
    { name: 'Admin Panel', path: '/admin', icon: ShieldCheck, allowedRoles: ['SUPER_ADMIN'] },
    { name: 'My Properties', path: '/properties', icon: Building, allowedRoles: ['PROPERTY_OWNER'] },
    { name: 'Booking Inflow', path: '/', icon: CalendarDays, allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Inventory', path: '/inventory', icon: Package, allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] },
    { name: 'Summary', path: '/summary', icon: BarChart3, allowedRoles: ['SUPER_ADMIN', 'PROPERTY_OWNER', 'HOTEL_MANAGER'] }, 
  ];

  const visibleNavItems = navItems.filter(item => item.allowedRoles.includes(user?.role));

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center">
            <Hotel className="w-6 h-6 text-blue-600 mr-3" />
            <span className="text-lg font-bold tracking-tight text-gray-900">HotelAdmin</span>
          </div>
          {/* Mobile Close Button */}
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.name} 
                to={item.path} 
                onClick={() => setIsOpen(false)} // Auto-close on mobile after click
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900'}`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-200 shrink-0">
          <button onClick={onLogout} className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
};

// --- TOPBAR COMPONENT ---
const Topbar = ({ user, onMenuClick }) => {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
      <div className="flex items-center">
        {/* Hamburger Menu (Mobile Only) */}
        <button 
          onClick={onMenuClick}
          className="mr-3 p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 lg:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="text-xs sm:text-sm text-gray-500 font-medium flex items-center">
          <span className="hidden sm:inline mr-1">Viewing as:</span>
          <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-bold text-[10px] sm:text-xs uppercase tracking-wider">
            {user.role.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-bold text-gray-900">{user.name}</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
          <UserCircle className="w-5 h-5" />
        </div>
      </div>
    </header>
  );
};

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Controls mobile menu

  useEffect(() => {
    const token = localStorage.getItem('hotel_auth_token');
    const savedUser = localStorage.getItem('hotel_user_data');
    if (token && savedUser) { setUser(JSON.parse(savedUser)); }
    setIsCheckingAuth(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('hotel_auth_token');
    localStorage.removeItem('hotel_user_data');
    setUser(null);
  };

  if (isCheckingAuth) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" /><p className="text-gray-500 font-medium">Loading Platform...</p></div>;
  if (!user) return <Login onLogin={setUser} />;

  return (
    <BrowserRouter>
      <div className="flex bg-gray-50 min-h-screen font-sans text-gray-900 overflow-hidden">
        
        <Sidebar 
          onLogout={handleLogout} 
          user={user} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
        />
        
        {/* Main Content Wrapper - Adds left margin ONLY on desktop */}
        <div className="flex-1 lg:ml-64 flex flex-col min-w-0 h-screen">
          <Topbar 
            user={user} 
            onMenuClick={() => setIsSidebarOpen(true)} 
          />
          
          {/* Scrollable Main Area */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50">
            <Routes>
              {/* Role-Protected Routes */}
              {user.role === 'SUPER_ADMIN' && <Route path="/admin" element={<AdminDashboard />} />}
              {user.role === 'PROPERTY_OWNER' && <Route path="/properties" element={<OwnerDashboard user={user} />} />}
              
              {/* Shared Routes */}
              <Route path="/" element={<BookingInflow user={user} />} />
              <Route path="/inventory" element={<Inventory user={user} />} />
              <Route path="/summary" element={<Summary user={user} />} />
              
              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to={user.role === 'SUPER_ADMIN' ? '/admin' : user.role === 'PROPERTY_OWNER' ? '/properties' : '/'} replace />} />
            </Routes>
          </main>
        </div>
        
      </div>
    </BrowserRouter>
  );
}
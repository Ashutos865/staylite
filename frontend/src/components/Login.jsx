import { useState } from 'react';
import { Hotel, Lock, Mail, Loader2 } from 'lucide-react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // 1. Send credentials to the Node.js Backend
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        // 2. SUCCESS! Save the JWT Token to the browser
        localStorage.setItem('hotel_auth_token', data.token);
        localStorage.setItem('hotel_user_data', JSON.stringify(data.user));
        
        // 3. Tell App.jsx that we are logged in
        onLogin(data.user);
      } else {
        // Handle incorrect passwords
        setError(data.message);
      }
    } catch (err) {
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600"><Hotel className="w-12 h-12" /></div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Platform Access</h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-center">{error}</div>}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                <input type="email" required className="block w-full pl-10 border border-gray-300 rounded-md py-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                <input type="password" required className="block w-full pl-10 border border-gray-300 rounded-md py-2 text-sm focus:ring-blue-500 focus:border-blue-500" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-70 transition-colors">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Secure Sign In'}
            </button>
          </form>

          {/* Test Credentials Guide */}
          <div className="mt-6 border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500 font-semibold mb-2">Test Accounts (Password: password)</p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>Admin: <span className="font-mono bg-gray-100 px-1">admin@ties.com</span></li>
              <li>Owner: <span className="font-mono bg-gray-100 px-1">owner@hotel.com</span></li>
              <li>Manager: <span className="font-mono bg-gray-100 px-1">manager@hotel.com</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
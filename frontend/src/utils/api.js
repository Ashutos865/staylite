export const API = 'http://localhost:5000/api';
export const getToken = () => localStorage.getItem('hotel_auth_token');
export const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  'Content-Type': 'application/json',
});
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

export const STATUS_BADGE = {
  PENDING_ASSIGNMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED:          'bg-blue-50 text-blue-700 border-blue-200',
  CHECKED_IN:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  CHECKED_OUT:        'bg-gray-100 text-gray-600 border-gray-200',
  CANCELLED:          'bg-red-50 text-red-600 border-red-200',
};

export const INPUT_CLS = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition';
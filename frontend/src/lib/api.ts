import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1/' });

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('sp_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_user');
    window.location.href = '/login';
  }
  // Standardize error access: use .message from response if available
  if (err.response?.data?.message) {
    err.message = err.response.data.message;
  } else if (err.response?.data?.error) {
    err.message = err.response.data.error;
  } else if (err.message === 'Network Error') {
    if (!navigator.onLine) err.message = 'Offline: Your action will be synced when internet returns.';
    else err.message = 'SafariPay servers are currently unreachable. Retrying...';
  }
  return Promise.reject(err);
});

export default api;

export const fmt = (n: number, currency?: string) => {
  let c = currency;
  if (!c) {
    const u = localStorage.getItem('sp_user');
    if (u) {
      try { const user = JSON.parse(u); c = user.currency; } catch (e) { }
    }
  }
  c = c || 'TZS';
  return `${c} ${Number(n).toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

export const toLocal = (tzsAmount: number, user: any) => {
  const currency = user?.currency || 'TZS';
  if (currency === 'TZS') return tzsAmount; // Absolute 1:1 for TZS base
  const rate = user?.fx_rate || (currency === 'KES' ? 130 : (currency === 'UGX' ? 3720 : 2500));
  // 1. Convert internal TZS back to USDT truth (2500 base)
  const usdt = tzsAmount / 2500;
  // 2. Convert USDT to target currency rate
  return usdt * rate;
};

export const getStarterLimit = (currency: string) => {
  const limits: Record<string, number> = {
    'TZS': 5000,
    'KES': 260,
    'UGX': 7500
  };
  return limits[currency] || 5000;
};

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const scoreGrade = (s: number) =>
  s >= 750 ? 'Excellent' : s >= 700 ? 'Very Good' : s >= 650 ? 'Good' : s >= 600 ? 'Fair' : s >= 500 ? 'Poor' : 'Building';

export const scoreColor = (s: number) =>
  s >= 700 ? '#10b981' : s >= 600 ? '#60a5fa' : s >= 500 ? '#f59e0b' : '#ef4444';

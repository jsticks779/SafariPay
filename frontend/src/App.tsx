import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider } from './hooks/useLanguage';
import { initOfflineSync } from './lib/offlineQueue';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import SendMoney from './pages/SendMoney';
import Transactions from './pages/Transactions';
import Loans from './pages/Loans';
import Profile from './pages/Profile';
import ReceiveMoney from './pages/ReceiveMoney';
import Settings from './pages/Settings';
import UssdSimulator from './pages/UssdSimulator';
import Withdraw from './pages/Withdraw';
import SmsDashboard from './pages/SmsDashboard';
import SendGlobal from './pages/SendGlobal';
import CreditScore from './pages/CreditScore';
import RequestMoney from './pages/RequestMoney';
import PaymentSummary from './pages/PaymentSummary';
import Onboarding from './pages/Onboarding';
import KycBanner from './components/KycBanner';
import { Loader2, WifiOff, Globe } from 'lucide-react';

import MerchantDashboard from './pages/MerchantDashboard';
import AdminDashboard from './pages/AdminDashboard';

function Shell() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={48} color="var(--primary)" style={{ animation: 'spin 2s linear infinite', marginBottom: 16 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 16, fontWeight: 500, letterSpacing: '0.05em' }}>SAFARIPAY</p>
      </div>
    </div>
  );
  const isMerchant = user?.account_type === 'merchant';
  const isOnboarding = location.pathname === '/onboarding';

  const renderContent = () => {
    if (!user) return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/pay" element={<PaymentSummary />} />
        <Route path="/pay/:id" element={<PaymentSummary />} />
        <Route path="/system/sms" element={<SmsDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );

    // Isolated Admin Environment Breakout
    if ((user as any)?.role === 'admin') {
      return (
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      );
    }

    // Redirect to onboarding if not active
    if (!user.is_active && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }

    // Redirect to home if active but on onboarding (unless in verify mode)
    if (user.is_active && location.pathname === '/onboarding' && !location.search.includes('mode=verify')) {
      return <Navigate to="/" replace />;
    }

    return (
      <>
        {!isOnboarding && user.is_active && <KycBanner />}
        <Routes>
          <Route path="/" element={isMerchant ? <Navigate to="/merchant" replace /> : <Dashboard />} />
          <Route path="/merchant" element={isMerchant ? <MerchantDashboard /> : <Navigate to="/" replace />} />
          <Route path="/send" element={<SendMoney />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/credit" element={<CreditScore />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/receive" element={<ReceiveMoney />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ussd" element={<UssdSimulator />} />
          <Route path="/withdraw" element={<Withdraw />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/send/global" element={<SendGlobal />} />
          <Route path="/request-money" element={<RequestMoney />} />
          <Route path="/pay" element={<PaymentSummary />} />
          <Route path="/pay/:id" element={<PaymentSummary />} />
          <Route path="/system/sms" element={<SmsDashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!isOnboarding && <BottomNav />}
      </>
    );
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', position: 'relative', background: 'var(--bg-dark)' }}>
      {/* 📡 Offline Banner */}
      {!isOnline && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 1000, background: '#ef4444',
          color: 'white', padding: '10px 16px', fontSize: 13, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          animation: 'slideDown 0.3s ease-out'
        }}>
          <WifiOff size={16} />
          <span>Offline Mode: Actions will sync later</span>
        </div>
      )}

      {renderContent()}
    </div>
  );
}

export default function App() {
  React.useEffect(() => {
    initOfflineSync();
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <LanguageProvider>
          <Shell />
          <Toaster position="top-center" toastOptions={{
            style: {
              background: 'rgba(15, 23, 42, 0.9)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 20,
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'var(--font)',
              backdropFilter: 'blur(16px)',
              padding: '12px 24px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: 'transparent' } },
            error: { iconTheme: { primary: '#ef4444', secondary: 'transparent' } },
          }} />
        </LanguageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

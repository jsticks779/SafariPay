import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api, { fmt } from '../lib/api';
import toast from 'react-hot-toast';
import {
  ShieldAlert,
  Users,
  Banknote,
  Globe,
  TrendingUp,
  Activity,
  ArrowLeft,
  Settings
} from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom login state
  const [secret, setSecret] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  // Financial control state
  const [exchangeRate, setExchangeRate] = useState('');
  const [exchangeCurrency, setExchangeCurrency] = useState('TZS');

  const isAdmin = (user as any)?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      try {
        const [statsRes, usersRes] = await Promise.all([
          api.get('admin/stats'),
          api.get('admin/users')
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAdmin]);

  const handleAdminLogin = async () => {
    if (!secret) return toast.error('Secret required');
    setLoginBusy(true);
    try {
      const res = await api.post('admin/login', { secret });
      // Force overwrite any existing session
      localStorage.setItem('sp_token', res.data.token);
      localStorage.setItem('sp_user', JSON.stringify(res.data.user));
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Invalid secret credentials');
    } finally {
      setLoginBusy(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 20, paddingBottom: 90, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      <Activity size={40} className="spin" color="var(--primary)" />
    </div>
  );

  // Unauthenticated / Non-Admin Fallback View
  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg-dark)' }}>
        <div className="card-glow animate-up" style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', margin: '0 auto 16px' }}>
            <ShieldAlert size={32} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 8 }}>Admin Portal</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>Internal administrative access only.</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input 
              type="password" 
              className="input" 
              placeholder="Enter Admin Secret..." 
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
            />
            <button className="btn btn-blue" onClick={handleAdminLogin} disabled={loginBusy}>
              {loginBusy ? 'Authenticating...' : 'Gain Access'}
            </button>
            {user && (
              <button onClick={logout} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
                Sign out of current account
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const handleUpdateExchangeRate = async () => {
    if (!exchangeRate || isNaN(Number(exchangeRate))) {
      return toast.error('Enter a valid exchange rate');
    }
    try {
      await api.post('admin/exchange-rate', {
        rate: Number(exchangeRate),
        currency: exchangeCurrency
      });
      toast.success(`Global rate updated: 1 USD = ${exchangeRate} ${exchangeCurrency}`);
      setExchangeRate('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update exchange rate');
    }
  };

  if (loading) return (
    <div style={{ padding: 20, paddingBottom: 90, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Activity size={40} className="spin" color="var(--primary)" />
    </div>
  );

  return (
    <div style={{ padding: '24px 20px', paddingBottom: 120 }} className="animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => nav('/')} style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'var(--glass)', border: '1px solid var(--glass-border-hi)',
          color: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={24} color="var(--danger)" />
            Admin Control
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Operational Transparency Board</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, marginBottom: 32 }}>
        <div className="card-glow" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--success)' }}>
            <Globe size={18} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>USDT Processed</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--white)' }}>${fmt(Number(stats?.totalUsdtProcessed || 0), '')}</h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--danger)' }}>
            <Activity size={18} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>TZS Outflow</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--white)' }}>{fmt(Number(stats?.totalTzsOutflow || 0), 'TZS')}</h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--accent-indigo)' }}>
            <Banknote size={18} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Active Loans</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--white)' }}>{stats?.activeLoans}</h2>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--warning, #f59e0b)' }}>
            <Users size={18} />
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Pending KYC</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--white)' }}>{stats?.pendingKyc}</h2>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings size={18} color="var(--primary)" />
          Global Exchange Rate
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Force override the fiat backing rate across the SafariPay economy.
        </p>
        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="input" style={{ width: 100 }} value={exchangeCurrency} onChange={e => setExchangeCurrency(e.target.value)}>
              <option value="TZS">TZS</option>
              <option value="KES">KES</option>
              <option value="UGX">UGX</option>
            </select>
            <input 
              type="number" 
              className="input" 
              placeholder="e.g. 2850" 
              value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          <button className="btn btn-blue" onClick={handleUpdateExchangeRate}>
            Enforce New Rate
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '24px 0', overflow: 'hidden' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)', marginBottom: 16, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} color="var(--primary)" />
          System Users
        </h3>
        <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
          <table style={{ width: '100%', minWidth: 500, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</th>
                <th style={{ padding: '12px 24px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Wallet</th>
                <th style={{ padding: '12px 24px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>ML Score</th>
                <th style={{ padding: '12px 24px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '16px 24px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--white)' }}>{u.phone}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{u.name}</div>
                  </td>
                  <td style={{ padding: '16px 24px', fontSize: 12, color: 'var(--primary)', fontFamily: 'monospace' }}>
                    {u.wallet_address ? `${u.wallet_address.substring(0, 6)}...${u.wallet_address.substring(38)}` : 'Pending'}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                    <span style={{ 
                      padding: '4px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700, 
                      backgroundColor: u.credit_score >= 650 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)', 
                      color: u.credit_score >= 650 ? 'var(--success)' : 'var(--text-muted)' 
                    }}>
                      {u.credit_score}
                    </span>
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                    <span className={`badge ${u.kyc_status === 'verified' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 10 }}>
                      {u.kyc_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import api, { fmt, fmtDate, scoreColor, toLocal } from '../lib/api';
import { getOfflineTransactions, initOfflineSync } from '../lib/offlineQueue';
import toast from 'react-hot-toast';
import {
  User,
  ArrowUpRight,
  ArrowDownLeft,
  Banknote,
  Globe,
  Eye,
  EyeOff,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Activity,
  Smartphone,
  Languages,
  ArrowDownRight,
  ShieldCheck,
  PlusCircle,
  RefreshCw,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [balVis, setBalVis] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineCount, setOfflineCount] = useState(getOfflineTransactions().length);

  useEffect(() => {
    const handleStatus = () => {
      setIsOnline(navigator.onLine);
      setOfflineCount(getOfflineTransactions().length);
    };
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    const interval = setInterval(handleStatus, 3000); // Poll for sync status changes

    initOfflineSync(); // Ensure sync listener is active

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      clearInterval(interval);
    };
  }, []);

  const loadDash = () => {
    // 🏷️ [Offline-First] Load from cache immediately for instant UX
    const cached = localStorage.getItem('sp_dash_cache');
    if (cached) {
      setData(JSON.parse(cached));
      setLoading(false); // Immediate UX for cached data
    }

    if (!navigator.onLine) {
      if (!cached) setLoading(false);
      return;
    }

    api.get('users/dashboard')
      .then(r => {
        setData(r.data);
        localStorage.setItem('sp_dash_cache', JSON.stringify(r.data));
      })
      .catch((e: any) => {
        if (navigator.onLine && !cached) toast.error(e.message || 'Failed to load dashboard');
        console.warn('Dashboard sync failed, using cache', e.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDash();
  }, []);

  const isIn = (tx: any) => tx.receiver_id === user?.id;

  const txColor = (tx: any) => {
    if (tx.type === 'loan_disbursement') return 'var(--accent-indigo)';
    if (tx.type === 'cross_border') return 'var(--primary)';
    return isIn(tx) ? 'var(--success)' : 'var(--danger)';
  };

  const TxIcon = (tx: any) => {
    if (tx.type === 'loan_disbursement') return <Banknote size={20} />;
    if (tx.type === 'cross_border') return <Globe size={20} />;
    return isIn(tx) ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />;
  };

  const txBg = (tx: any) => {
    if (tx.type === 'loan_disbursement') return 'rgba(99, 102, 241, 0.1)';
    if (tx.type === 'cross_border') return 'rgba(59, 130, 246, 0.1)';
    return isIn(tx) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  };

  useEffect(() => {
    if (data?.recent_transactions) {
      const reward = data.recent_transactions.find((tx: any) =>
        tx.description === 'Received from SafariPay' || tx.description === 'Welcome Reward'
      );
      if (reward && !localStorage.getItem(`reward_seen_${reward.id}`)) {
        toast.success(t('welcome_reward_toast').replace('{amount}', Math.round(reward.amount).toString()), {
          duration: 8000,
        });
        localStorage.setItem(`reward_seen_${reward.id}`, 'true');
      }
    }
  }, [data, t]);

  const txLabel = (item: any) => {
    if (item.type === 'loan_disbursement') return item.description || t('loan_disbursement');

    // System transactions (like Welcome Reward) have null/same sender and receiver
    if (!item.sender_id || (item.sender_id === item.receiver_id && item.type === 'top_up')) {
      return 'SafariPay';
    }

    if (item.description === 'Received from SafariPay' || item.description === 'Welcome Reward') return 'SafariPay';

    const other = isIn(item) ? (item.sender_name || item.sender_phone) : (item.receiver_name || item.receiver_phone);
    if (!other) return 'SafariPay';

    const name = other?.split(' ')[0] || other;
    return isIn(item) ? `${t('received_from')} ${name}` : `${t('sent_to')} ${name}`;
  };

  const sc = user?.credit_score || 0;
  const scColor = scoreColor(sc);

  // 🌍 [Localization] Helper for real-time local currency conversion
  const cur = data?.user?.currency || 'TZS';

  const toLocalIn = (tzsAmount: number) => {
    return toLocal(tzsAmount, data?.user);
  };

  if (loading) return (
    <div style={{ padding: 20, paddingBottom: 90 }}>
      {[200, 100, 80, 80, 80].map((h, i) => (
        <div key={i} className="skeleton" style={{ height: h, marginBottom: 16, borderRadius: 24 }} />
      ))}
    </div>
  );

  const isKycOk = user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved';

  return (
    <div style={{ padding: '24px 20px', paddingBottom: 120 }} className="animate-fade">

      {/* Offline Banner */}
      {!isOnline && (
        <div className="animate-up" style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 16,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 10px var(--danger)' }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#fca5a5' }}>
            {t('offline_mode_active') || 'Offline Mode Active'} · {t('no_internet_msg') || 'Transfers will sync when online'}
          </p>
        </div>
      )}

      {isOnline && offlineCount > 0 && (
        <div className="animate-up" style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: 16,
          padding: '12px 16px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} className="sync-pulse" />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#93c5fd' }}>
            {t('syncing_transactions') || 'Syncing transactions...'} ({offlineCount} {t('remaining') || 'remaining'})
          </p>
        </div>
      )}

      {/* Header */}
      <div className="row-between animate-up" style={{ marginBottom: 32 }}>
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>{t('welcome')},</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--white)' }}>
              {user?.name?.split(' ')[0]}
            </h1>
            {(user?.trust_level === 'Verified' || user?.trust_level === 'HIGH' || (user as any).kyc_status === 'Approved') ? (
                <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '3px 8px', borderRadius: 8, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={10} /> ELITE VERIFIED
                </span>
            ) : (
                <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '3px 8px', borderRadius: 8, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={10} /> KYC REQUIRED
                </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Language Toggle */}
          <button onClick={() => setLanguage(language === 'EN' ? 'SW' : 'EN')}
            style={{
              height: 44, padding: '0 12px', borderRadius: 14,
              background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)',
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: 'all 0.2s'
            }}>
            <Languages size={18} color="var(--primary)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)' }}>{language}</span>
          </button>

          <button onClick={() => nav('/ussd')}
            style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--success)', position: 'relative'
            }}>
            <span style={{ fontSize: 8, fontWeight: 800, position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', background: 'var(--success)', color: 'white', padding: '2px 5px', borderRadius: 6, letterSpacing: '0.5px' }}>OFFLINE</span>
            <Smartphone size={18} />
          </button>

          <button onClick={() => nav('/profile')}
            style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--glass)', border: '1px solid var(--glass-border-hi)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--white)' }}>
            <User size={20} />
          </button>
        </div>
      </div>

      {user?.id === 'pending' && (
        <div className="card-glow animate-up" style={{ padding: 40, textAlign: 'center', borderRadius: 32, marginBottom: 32 }}>
          <div className="animate-pulse" style={{
            width: 80, height: 80, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto 24px',
            boxShadow: '0 0 40px rgba(59, 130, 246, 0.2)'
          }}>
            <ShieldCheck size={40} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 12 }}>{t('provisioning_wallet') || 'Provisioning Your Wallet...'}</h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
            {t('provisioning_msg') || 'SafariPay is securing your identity and creating your digital wallet in the background.'}
          </p>
          <div style={{ marginTop: 32, padding: '12px 20px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 16, border: '1px solid rgba(16, 185, 129, 0.1)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} className="sync-pulse" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>{t('waiting_for_network') || 'Waiting for network signal...'}</span>
          </div>
        </div>
      )}

      {user?.id !== 'pending' && (
        <>
          {/* Balance card */}
          <div className="card-glow animate-up" style={{ marginBottom: 24, padding: 32 }}>
            <div className="row-between" style={{ marginBottom: 16 }}>
              <span className="label" style={{ marginBottom: 0, color: 'rgba(255,255,255,0.6)' }}>{t('portfolio_balance')}</span>
              <button onClick={() => setBalVis(!balVis)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', cursor: 'pointer' }}>
                {balVis ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>
            </div>

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 700, letterSpacing: '-0.04em', marginBottom: 4, color: 'var(--white)' }}>
              {balVis ? (
                <span className="text-gradient">{fmt(toLocalIn(data?.user?.balance || 0), cur)}</span>
              ) : (
                <span>••••••••</span>
              )}
            </h2>

            {balVis && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, fontWeight: 600 }}>
                ≈ {(Number(data?.user?.balance || 0) / (data?.user?.fx_rate || 2500)).toFixed(2)} USDT
              </p>
            )}

            {user?.wallet_address && (
              <>
                <div className="row-between" style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#26a17b', boxShadow: '0 0 15px #26a17b' }} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', display: 'block' }}>Fee Credit (Makato)</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Bonus used for transaction speed</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#26a17b' }}>{fmt(toLocalIn(Number(data?.user?.reward_balance || 0)), cur)}</span>
                    <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: 0 }}>≈ {(Number(data?.user?.reward_balance || 0) / 2500).toFixed(2)} USDT</p>
                  </div>
                </div>
              </>
            )}

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 32 }}>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <TrendingUp size={14} color="var(--success)" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('income')}</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)' }}>{fmt(toLocalIn(data?.monthly_stats?.received || 0), cur)}</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <TrendingDown size={14} color="var(--danger)" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>{t('expense')}</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--danger)' }}>{fmt(toLocalIn(data?.monthly_stats?.sent || 0), cur)}</p>
              </div>
            </div>
          </div>

          {/* Credit Score Badge */}
          <button onClick={() => nav('/credit')} className="animate-up" style={{
            width: '100%', marginBottom: 32, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
            background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 24,
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: scColor }}>
              <ShieldCheck size={24} />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>ML Trust Score</p>
                <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--white)' }}>{sc} <span style={{ color: 'var(--text-dim)', fontWeight: 400, margin: '0 4px' }}>•</span> <span style={{ color: scColor }}>{sc >= 750 ? 'Excellent' : sc >= 700 ? 'Very Good' : sc >= 650 ? 'Good' : sc >= 600 ? 'Fair' : sc >= 500 ? 'Poor' : 'Building'}</span></p>
              </div>
              {sc >= 650 && (
                <div style={{ padding: '4px 8px', background: 'var(--primary)', borderRadius: 8, fontSize: 10, fontWeight: 800, color: 'white', marginRight: 12, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)' }}>
                  LOAN ELIGIBLE
                </div>
              )}
            </div>
            <ChevronRight size={18} color="var(--text-dim)" />
          </button>


          {/* Quick Actions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 32 }} className="animate-up">
            {[
              { icon: ArrowUpRight, label: t('send'), path: '/send', color: '#3b82f6', kyc: true },
              { icon: ArrowDownLeft, label: t('deposit') || 'Deposit', path: '/receive', color: '#10b981', kyc: false },
              { icon: RefreshCw, label: t('request') || 'Request', path: '/request-money', color: '#8b5cf6', kyc: true },
              { icon: ArrowDownRight, label: t('withdraw'), path: '/withdraw', color: '#f59e0b', kyc: true },
              { icon: Banknote, label: t('loans'), path: '/loans', color: '#6366f1', kyc: true },
            ].map((a, i) => {
              const isKycOk = user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved';
              const isLocked = a.kyc && !isKycOk;

              return (
                <button key={i} 
                  onClick={() => {
                    if (isLocked) {
                      toast.error('Identity Verification Required');
                      nav('/onboarding?mode=verify');
                    } else {
                      nav(a.path);
                    }
                  }}
                  className="btn-hover-card"
                  style={{ 
                    background: 'var(--glass)', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: 16, 
                    padding: '16px 4px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: 8, 
                    cursor: 'pointer', 
                    transition: 'all 0.2s',
                    opacity: isLocked ? 0.4 : 1,
                    filter: isLocked ? 'grayscale(0.8)' : 'none',
                  }}>
                  <div style={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 12, 
                    background: 'rgba(255,255,255,0.04)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: a.color,
                    position: 'relative'
                  }}>
                    <a.icon size={20} />
                    {isLocked && <ShieldCheck size={10} style={{ position: 'absolute', top: -2, right: -2, color: '#f59e0b' }} />}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center' }}>{a.label}</span>
                </button>
              );
            })}
          </div>

          {/* Active Loan Widget */}
          {data?.active_loan && (
            <div className="card-glow animate-up" onClick={() => nav('/loans')}
              style={{ marginBottom: 32, padding: 24, borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.02)', cursor: 'pointer' }}>
              <div className="row-between" style={{ marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{t('active_loan')}</p>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{fmt(data.active_loan.amount)}</h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{t('due_date')}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)' }}>{new Date(data.active_loan.due_date).toLocaleDateString()}</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{fmt(data.active_loan.paid_amount)} {t('paid_badge') || 'Paid'}</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fmt(Math.max(0, (Number(data.active_loan.amount) * (1 + Number(data.active_loan.interest_rate) / 100))) - Number(data.active_loan.paid_amount))} {t('remaining_badge') || 'Left'}</span>
              </div>

              <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: '#f59e0b',
                  borderRadius: 10,
                  width: `${Math.min((Number(data.active_loan.paid_amount) / (Number(data.active_loan.amount) * (1 + Number(data.active_loan.interest_rate) / 100))) * 100, 100)}%`
                }} />
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          <div className="animate-up">
            <div className="row-between" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>{t('transactions')}</h3>
              <button onClick={() => nav('/transactions')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {t('view_all')}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data?.recent_transactions?.map((t_row: any, i: number) => (
                <div key={t_row.id} className="txn-row">
                  <div className="txn-icon" style={{ background: txBg(t_row), color: txColor(t_row) }}>
                    {TxIcon(t_row)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)', marginBottom: 2 }}>{txLabel(t_row)}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtDate(t_row.created_at)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 16, fontWeight: 700, color: txColor(t_row), marginBottom: 4 }}>
                      {isIn(t_row) || t_row.type === 'loan_disbursement' ? '+' : '-'}{fmt(toLocalIn(t_row.amount), cur)}
                    </p>
                    <span className={t_row.status === 'completed' ? 'badge badge-green' : 'badge badge-blue'} style={{ fontSize: 10, padding: '2px 8px' }}>
                      {t_row.status === 'completed' ? t('success_badge') : t('pending_badge')}
                    </span>
                  </div>
                </div>
              ))}
              {!data?.recent_transactions?.length && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-dim)', background: 'var(--glass)', borderRadius: 24 }}>
                  <Activity size={40} style={{ marginBottom: 12, opacity: 0.2 }} />
                  <p>{t('no_activity')}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

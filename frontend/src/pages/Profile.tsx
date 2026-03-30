import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { fmt } from '../lib/api';
import toast from 'react-hot-toast';
import {
  ClipboardList,
  TrendingUp,
  Wallet,
  Globe,
  LogOut,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Settings,
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleLogout = () => { logout(); toast.success(t('sign_out')); nav('/login'); };

  const menu = [
    { icon: ClipboardList, label: t('transaction_history'), sub: t('all_payments'), action: () => nav('/transactions'), color: 'var(--primary)' },
    { icon: ArrowDownRight, label: t('withdraw'), sub: t('withdraw_funds'), action: () => nav('/withdraw'), color: 'var(--warning)' },
    { icon: TrendingUp, label: t('credit_analysis'), sub: `${t('score')}: ${user?.credit_score}`, action: () => nav('/credit'), color: 'var(--success)' },
    { icon: Wallet, label: t('loans'), sub: t('apply_manage_loans'), action: () => nav('/loans'), color: '#f59e0b' },
    { icon: Globe, label: t('live_rates'), sub: t('live_rates'), action: () => nav('/send'), color: 'var(--accent-cyan)' },
    { icon: Settings, label: t('settings'), sub: t('security_preferences'), action: () => nav('/settings'), color: 'var(--text-muted)' },
  ];

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div style={{ padding: '24px 20px', paddingBottom: 120 }} className="animate-fade">
      <div className="row-between" style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>{t('profile')}</h1>
      </div>

      {/* User card */}
      <div className="card-glow animate-up" style={{ marginBottom: 24, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 24,
            background: 'linear-gradient(135deg, var(--primary), var(--accent-indigo))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'white',
            boxShadow: '0 10px 20px rgba(59, 130, 246, 0.2)'
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--white)', marginBottom: 4 }}>{user?.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {user?.trust_level === 'HIGH' ? (
                <span className="badge badge-green" style={{ fontSize: 10 }}>
                  <ShieldCheck size={12} /> {t('kyc_verified')}
                </span>
              ) : (
                <button 
                  onClick={() => nav('/onboarding?mode=verify')}
                  className="badge" 
                  style={{ fontSize: 10, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <AlertCircle size={10} /> {t('verify_now')}
                </button>
              )}
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.phone}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[
            [t('balance'), fmt(user?.balance || 0, user?.currency)],
            [t('country'), user?.country || 'TZ'],
            [t('account_type'), user?.account_type || 'Personal']
          ].map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: '14px 10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase' }}>{k}</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</p>
            </div>
          ))}
        </div>

        {/* DID Wallet */}
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 20 }}>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('did_label')}</p>
            <ExternalLink size={12} color="var(--primary)" />
          </div>
          <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--primary)', wordBreak: 'break-all', lineHeight: 1.4, opacity: 0.9 }}>{user?.did}</p>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--success)' }} />
            <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t('ipfs_stored')}</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="card animate-up" style={{ padding: '8px', marginBottom: 24 }}>
        {menu.map((item, i) => {
          const Icon = item.icon;
          return (
            <button key={i} onClick={item.action}
              style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: '16px', background: 'none', border: 'none', borderRadius: 16, color: 'var(--white)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--glass)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color }}>
                <Icon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 600 }}>{item.label}</p>
                <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{item.sub}</p>
              </div>
              <ChevronRight size={18} color="var(--text-dim)" />
            </button>
          );
        })}
      </div>

      <button className="btn btn-secondary animate-up" onClick={handleLogout}
        style={{ color: '#fca5a5', borderColor: 'rgba(239,68,68,0.2)' }}>
        <LogOut size={18} /> {t('sign_out')}
      </button>

      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', marginTop: 40, fontWeight: 500 }}>
        SafariPay v1.1.0 · Africa Alpha Phase 1
      </p>
    </div>
  );
}

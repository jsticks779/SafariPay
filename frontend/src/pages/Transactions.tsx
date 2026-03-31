import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { fmt, fmtDate, toLocal } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { getOfflineTransactions, OfflineJob } from '../lib/offlineQueue';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Globe,
  Banknote,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Inbox
} from 'lucide-react';

export default function Transactions() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const FILTERS = [
    { id: 'All', label: t('all_filter') },
    { id: 'Sent', label: t('sent_filter') },
    { id: 'Received', label: t('received_filter') },
    { id: 'Cross-border', label: t('cross_border_filter') },
    { id: 'Loans', label: t('loans_filter') }
  ] as const;
  type Filter = typeof FILTERS[number]['id'];
  const [filter, setFilter] = useState<Filter>('All');

  useEffect(() => {
    const fetchData = async () => {
      // 🏷️ [Offline-First] Load from cache immediately
      const cached = localStorage.getItem('sp_tx_cache');
      if (cached) setTxns(JSON.parse(cached));

      if (!navigator.onLine) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('transactions');
        setTxns(data);
        localStorage.setItem('sp_tx_cache', JSON.stringify(data));
      } catch (e: any) {
        if (!cached) toast.error('Failed to load transaction history');
        console.warn('Tx history sync failed, using cache', e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const offlineJobs = getOfflineTransactions();

  // Transform offline jobs into the same format as backend transactions
  const offlineTxns = offlineJobs.map(job => ({
    id: job.id,
    amount: job.payload.amount,
    receiver_phone: job.payload.recipient_wallet ? 'SafariPay Wallet' : job.payload.receiver_id,
    receiver_name: job.payload.recipient_wallet ? 'Recipient' : job.payload.receiver_id,
    sender_id: user?.id,
    created_at: new Date(job.timestamp).toISOString(),
    status: job.status,
    type: 'offline_pending',
    description: job.payload.description || 'Offline Transfer',
    error: job.error
  }));

  const allTxns = [...offlineTxns, ...txns];

  const isIn = (tx: any) => tx.receiver_id === user?.id;

  const filtered = allTxns.filter(tx => {
    if (filter === 'Sent') return tx.sender_id === user?.id && tx.type !== 'loan_disbursement';
    if (filter === 'Received') return tx.receiver_id === user?.id && tx.type !== 'loan_disbursement';
    if (filter === 'Cross-border') return tx.type === 'cross_border';
    if (filter === 'Loans') return tx.type === 'loan_disbursement';
    return true;
  });

  const txColor = (tx: any) => {
    if (tx.type === 'offline_pending') return 'var(--primary)';
    if (tx.type === 'loan_disbursement') return 'var(--accent-indigo)';
    if (tx.type === 'cross_border') return 'var(--primary)';
    return isIn(tx) ? 'var(--success)' : 'var(--danger)';
  };

  const txBg = (tx: any) => {
    if (tx.type === 'offline_pending') return 'rgba(59, 130, 246, 0.1)';
    if (tx.type === 'loan_disbursement') return 'rgba(99, 102, 241, 0.1)';
    if (tx.type === 'cross_border') return 'rgba(59, 130, 246, 0.1)';
    return isIn(tx) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
  };

  const TxIcon = ({ tx }: { tx: any }) => {
    if (tx.type === 'cross_border') return <Globe size={20} />;
    if (tx.type === 'loan_disbursement') return <Banknote size={20} />;
    return isIn(tx) ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />;
  };

  const txLabel = (tx: any) => {
    if (tx.type === 'offline_pending') return tx.description || 'Offline Transfer';
    if (tx.type === 'loan_disbursement') return tx.description || t('loan_disbursed');

    if (tx.type === 'deposit' || tx.type === 'top_up') {
      const match = tx.description?.match(/via\s+([a-zA-Z0-9\s-]+)|([a-zA-Z0-9\s-]+)\s+Deposit/i);
      const network = match ? (match[1] || match[2]) : 'Mobile Money';
      const isMobile = tx.sender_phone && tx.sender_phone !== 'SAFARIPAY' && tx.sender_phone !== network;
      return isMobile ? `Deposited from ${network} (${tx.sender_phone})` : `Deposited from ${network}`;
    }

    if (tx.type === 'withdrawal') {
      const match = tx.description?.match(/via\s+([a-zA-Z0-9\s-]+)/i);
      const network = match ? match[1] : 'External';
      const isMobile = tx.receiver_phone && tx.receiver_phone !== 'SAFARIPAY';
      return isMobile ? `Withdrawn to ${network} (${tx.receiver_phone})` : `Withdrawn to ${network}`;
    }

    // System transactions (like Welcome Reward) have null/same sender and receiver
    if (!tx.sender_id || (tx.sender_id === tx.receiver_id && tx.type === 'top_up')) {
      return isIn(tx) ? `${t('from')} SafariPay` : `${t('to')} SafariPay`;
    }

    const otherName = isIn(tx) ? tx.sender_name : tx.receiver_name;
    const otherPhone = isIn(tx) ? tx.sender_phone : tx.receiver_phone;

    if (!otherName && !otherPhone) return isIn(tx) ? `${t('from')} SafariPay` : `${t('to')} SafariPay`;

    const nameStr = otherName ? otherName.split(' ')[0] : 'User';
    const detail = otherPhone && otherPhone !== 'SAFARIPAY' ? `${nameStr} (${otherPhone})` : nameStr;

    return isIn(tx) ? `${t('from')} ${detail}` : `${t('to')} ${detail}`;
  };

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
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>{t('transactions')}</h1>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, marginBottom: 24, scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            style={{
              padding: '10px 20px', borderRadius: 14,
              border: `1px solid ${filter === f.id ? 'var(--primary)' : 'var(--glass-border-hi)'}`,
              background: filter === f.id ? 'var(--primary)' : 'var(--glass)',
              color: filter === f.id ? 'white' : 'var(--text-muted)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s'
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && [1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="skeleton" style={{ height: 80, marginBottom: 12, borderRadius: 24 }} />
      ))}

      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-dim)', background: 'var(--glass)', borderRadius: 24 }}>
          <Inbox size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
          <p>{t('no_activity')}</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map((tx, i) => (
          <div key={tx.id} className="txn-row animate-up" style={{ animationDelay: `${i * 0.05}s` }}>
            <div className="txn-icon" style={{ background: txBg(tx), color: txColor(tx) }}>
              <TxIcon tx={tx} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)', marginBottom: 2 }}>{txLabel(tx)}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{fmtDate(tx.created_at)}</p>
                {tx.type === 'cross_border' && <span className="badge badge-blue" style={{ fontSize: 9 }}>{t('global')}</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: txColor(tx), marginBottom: 4 }}>
                {isIn(tx) || tx.type === 'loan_disbursement' ? '+' : '-'}{fmt(toLocal(tx.amount, user))}
              </p>
              {tx.status === 'completed' && (
                <span className="badge badge-green" style={{ fontSize: 10, padding: '2px 8px' }}>{t('success_badge')}</span>
              )}
              {tx.status === 'pending' && (
                <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 8px' }}>📡 {t('pending_badge')}</span>
              )}
              {tx.status === 'syncing' && (
                <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 8px' }}>🔃 Syncing...</span>
              )}
              {tx.status === 'failed' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span className="badge badge-danger" style={{ fontSize: 10, padding: '2px 8px' }}>⚠️ Sync Failed</span>
                  <p style={{ fontSize: 9, color: 'var(--danger)', marginTop: 4, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.error}</p>
                </div>
              )}
              {!['completed', 'pending', 'syncing', 'failed'].includes(tx.status) && (
                <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 8px' }}>{tx.status}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

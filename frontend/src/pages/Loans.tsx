import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { fmt, toLocal, getStarterLimit } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Banknote,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  X,
  CreditCard,
  Languages,
  WifiOff
} from 'lucide-react';
import Select from '../components/Select';
import { queueOfflineTransaction } from '../lib/offlineQueue';

export default function Loans() {
  const { user, refresh } = useAuth();
  const { t, language } = useLanguage();
  const nav = useNavigate();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [showRepay, setShowRepay] = useState<string | null>(null);
  const [form, setForm] = useState({ amount: '', purpose: '', duration_days: '30' });
  const [repayAmt, setRepayAmt] = useState('');
  const [busy, setBusy] = useState(false);
  const [eligibility, setEligibility] = useState<any>(null);

  const load = async () => {
    try {
      const { data: loansData } = await api.get('loans');
      setLoans(loansData);
      const { data: eligData } = await api.get('loans/eligibility');
      setEligibility(eligData);
    }
    catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const isLevel1 = eligibility?.eligible;
  const sc = user?.credit_score || 0;
  
  // 🌍 [Localization] Global 2.00 USDT Starter Limit logic (Standardized fixed numbers)
  const starterAmount = getStarterLimit(user?.currency || 'TZS');
  const usdtBase = 2.00;
  
  const baseMax = sc >= 700 ? (starterAmount * 100) : sc >= 600 ? (starterAmount * 40) : sc >= 500 ? (starterAmount * 20) : sc >= 400 ? (starterAmount * 10) : sc >= 350 ? (starterAmount * 4) : starterAmount;
  const maxLoan = isLevel1 ? baseMax : starterAmount; 
  const rate = sc >= 700 ? 3.0 : sc >= 500 ? 5.0 : 7.5; // Simplified interest tiers
  const activeLoan = loans.find(l => l.status === 'active');

  const apply = async () => {
    if (!form.amount || !form.purpose) { toast.error('Fill all fields'); return; }
    setBusy(true);
    try {
      const payload = { amount: Number(form.amount), purpose: form.purpose, duration_days: Number(form.duration_days) };
      const url = 'loans/apply';
      if (!navigator.onLine) {
        queueOfflineTransaction(url, payload);
        toast.success('📡 Offline: Loan application queued!');
        setShowApply(false); setForm({ amount: '', purpose: '', duration_days: '30' });
        return;
      }
      const res = await api.post(url, payload);
      toast.success(res.data?.message || 'Application successful');
      setShowApply(false); setForm({ amount: '', purpose: '', duration_days: '30' });
      load(); refresh();
    } catch (e: any) { toast.error(e.message || 'Application failed'); }
    finally { setBusy(false); }
  };

  const repay = async (id: string) => {
    if (!repayAmt) { toast.error('Enter amount'); return; }
    setBusy(true);
    try {
      const payload = { amount: Number(repayAmt) };
      const url = `/loans/${id}/repay`;
      if (!navigator.onLine) {
        queueOfflineTransaction(url, payload);
        toast.success('📡 Offline: Repayment queued!');
        setShowRepay(null); setRepayAmt('');
        return;
      }
      const res = await api.post(url, payload);
      toast.success(res.data?.message || 'Repayment successful');
      setShowRepay(null); setRepayAmt('');
      load(); refresh();
    } catch (e: any) { toast.error(e.message || 'Repayment failed'); }
    finally { setBusy(false); }
  };

  const purposes = [
    { en: 'Women SME Grant', sw: 'Ruzuku ya Wanawake SMEs' },
    { en: 'Student Microloan', sw: 'Mkopo wa Wanafunzi' },
    { en: 'Business expansion', sw: 'Kupanua biashara' },
    { en: 'Emergency funds', sw: 'Fedha za dharura' },
    { en: 'Farming inputs', sw: 'Mahitaji ya shamba' },
    { en: 'Education', sw: 'Elimu' },
    { en: 'Medical expenses', sw: 'Matibabu' },
    { en: 'Home improvement', sw: 'Ukarabati wa nyumba' }
  ];

  const purposeOptions = purposes.map(p => ({
    id: p.en,
    label: language === 'SW' ? p.sw : p.en
  }));

  const durationOptions = [
    { id: '7', label: `7 ${t('days')}` },
    { id: '14', label: `14 ${t('days')}` },
    { id: '30', label: `30 ${t('days')}` },
    { id: '60', label: `60 ${t('days')}` },
  ];

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
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>{t('instant_loans')}</h1>
      </div>

      {/* Eligibility Card */}
      <div className="card-glow animate-up" style={{ marginBottom: 24, padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TrendingUp size={16} color="var(--success)" />
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{t('credit_limit')}</p>
            </div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: 'white', letterSpacing: '-0.02em', marginBottom: 8 }}>{fmt(maxLoan)}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <span className="badge badge-green" style={{ fontSize: 10 }}>{rate}% {t('interest')}</span>
              <span className="badge badge-blue" style={{ fontSize: 10 }}>{t('score')}: {sc}</span>
            </div>
          </div>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
            <Banknote size={32} />
          </div>
        </div>
      </div>

      {/* Level 1 Eligibility Checklist */}
      {eligibility && !eligibility.eligible && (
        <div className="card-glow animate-up" style={{ marginBottom: 24, padding: 24, background: 'rgba(59, 130, 246, 0.03)', border: '1px dashed var(--glass-border-hi)', overflow: 'visible' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 2 }}>Grow Your Credit</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--white)' }}>How to get bigger loans</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {eligibility.requirements.map((req: any) => {
              // 🛡️ [Pro Guard] Override 'elig_identity' status based on real-time user object
              const isKycOk = user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved';
              const isCompleted = req.name === 'elig_identity' ? isKycOk : req.status;

              return (
                <div key={req.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ color: isCompleted ? 'var(--success)' : 'var(--text-dim)' }}>
                      {isCompleted ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                    </div>
                    <span style={{ fontSize: 13, color: isCompleted ? 'var(--white)' : 'var(--text-muted)' }}>{t(req.name)}</span>
                  </div>
                  {!isCompleted && req.target > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>{req.current}/{req.target}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, padding: 16, background: 'rgba(59, 130, 246, 0.08)', borderRadius: 16, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <p style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
              Starting Limit: {fmt(starterAmount)} (≈ {usdtBase.toFixed(2)} USDT)
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
              Keep money in your SafariPay wallet and send to friends to increase your score automatically!
            </p>
          </div>
        </div>
      )}

      {!activeLoan && (
        <button
          className="btn btn-blue animate-up"
          onClick={() => {
            const isKycOk = user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved';
            if (!isKycOk) {
              toast.error('Identity verification required. Please complete KYC.');
              nav('/onboarding?mode=verify');
            } else if (!isLevel1) {
              toast.error(t('level1_required') || 'You must complete Level 1 rules first!');
            } else {
              setShowApply(true);
            }
          }}
          disabled={busy}
          style={{
            marginBottom: 40,
            padding: '22px 32px',
            fontSize: 18,
            borderRadius: 24,
            background: !(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? 'rgba(245, 158, 11, 0.1)' : isLevel1 ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'rgba(255,255,255,0.05)',
            border: !(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? '1px solid rgba(245, 158, 11, 0.3)' : isLevel1 ? 'none' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: !(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? 'none' : isLevel1 ? '0 12px 30px rgba(59, 130, 246, 0.4)' : 'none',
            color: !(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? '#fbbf24' : isLevel1 ? 'white' : 'rgba(255,255,255,0.3)',
            cursor: 'pointer',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
          {!(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? 'Verify KYC to Unlock Loans' : isLevel1 ? t('borrow_funds') : t('locked')} <ChevronRight size={22} style={{ marginLeft: 8 }} />
        </button>
      )}

      {/* Active Loan Widget - Redesigned */}
      {
        activeLoan && (
          <div className="card-glow animate-up" style={{ marginBottom: 32, padding: 28, borderLeft: '4px solid #f59e0b', background: 'rgba(245, 158, 11, 0.02)' }}>
            <div className="row-between" style={{ marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{t('active_repayment')}</p>
                <h3 style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.02em' }}>{fmt(activeLoan.amount)}</h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{t('due_date')}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--white)' }}>
                  <Clock size={14} color="#f59e0b" />
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{new Date(activeLoan.due_date).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 20, padding: 20, marginBottom: 24 }}>
              <div className="row-between" style={{ marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{t('amount_paid')}</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{fmt(activeLoan.paid_amount)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{t('amount_remaining')}</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>{fmt(Math.max(0, (Number(activeLoan.amount) * (1 + Number(activeLoan.interest_rate) / 100))) - Number(activeLoan.paid_amount))}</p>
                </div>
              </div>

              <div style={{ height: 10, background: 'rgba(255,255,255,0.05)', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                  borderRadius: 10,
                  width: `${Math.min((Number(activeLoan.paid_amount) / (Number(activeLoan.amount) * (1 + Number(activeLoan.interest_rate) / 100))) * 100, 100)}%`,
                  transition: 'width 1s ease-out'
                }} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10, textAlign: 'center' }}>
                {Math.round((Number(activeLoan.paid_amount) / (Number(activeLoan.amount) * (1 + Number(activeLoan.interest_rate) / 100))) * 100)}% {t('repaid')}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-blue" onClick={() => setShowRepay(activeLoan.id)} style={{ flex: 1, background: '#f59e0b', border: 'none', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)' }}>
                {t('repay_now')}
              </button>
              <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--white)' }}>
                <Languages size={18} />
              </button>
            </div>
          </div>
        )
      }

      {/* Removed AI Predicts as requested */}

      <div className="animate-up" style={{ marginTop: 20, padding: 20, background: 'rgba(59, 130, 246, 0.05)', borderRadius: 24, border: '1px solid rgba(59, 130, 246, 0.1)' }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <TrendingUp size={14} /> How we calculate your score?
        </h4>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          Your score grows as you <b>deposit money</b>, <b>pay bills</b>, and <b>send money</b> to friends. Higher scores mean lower interest rates and higher limits!
        </p>
      </div>

      {/* History */}
      <div className="animate-up" style={{ marginTop: 40 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)', marginBottom: 20 }}>Past Loans</h3>
        {loans.filter(l => l.status !== 'active').map((loan, i) => (
          <div key={loan.id} className="txn-row" style={{ marginBottom: 12 }}>
            <div className="txn-icon" style={{ background: loan.status === 'repaid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: loan.status === 'repaid' ? 'var(--success)' : 'var(--danger)' }}>
              {loan.status === 'repaid' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)', marginBottom: 2 }}>{fmt(loan.amount)}</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                {language === 'SW' ? (purposes.find(p => p.en === loan.purpose)?.sw || loan.purpose) : loan.purpose} · {new Date(loan.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={loan.status === 'repaid' ? 'badge badge-green' : 'badge badge-white'} style={{ fontSize: 10 }}>
              {loan.status === 'repaid' ? t('success_badge') : loan.status}
            </span>
          </div>
        ))}
        {!loading && loans.filter(l => l.status !== 'active').length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', border: '1px dashed var(--glass-border-hi)', borderRadius: 24 }}>
            <Clock size={40} style={{ marginBottom: 12, opacity: 0.1 }} />
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>{t('no_past_loans')}</p>
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>{t('processing')}</div>}

      {/* Apply Modal */}
      {
        showApply && (
          <div className="overlay" onClick={() => setShowApply(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--white)' }}>{t('request_loan')}</h2>
                <button onClick={() => setShowApply(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label className="label">How much do you need?</label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: 'var(--text-dim)' }}>{user?.currency || 'TZS'}</div>
                    <input className="input" style={{ paddingLeft: 54 }} type="number" placeholder={`Limit: ${fmt(maxLoan)}`} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="label">Reason for this loan</label>
                  <Select
                    options={purposeOptions}
                    value={form.purpose}
                    onChange={(v) => setForm({ ...form, purpose: v })}
                    placeholder="Select one..."
                  />
                </div>

                <div>
                  <label className="label">When will you pay back?</label>
                  <Select
                    options={durationOptions}
                    value={form.duration_days}
                    onChange={(v) => setForm({ ...form, duration_days: v })}
                    placeholder="Select days"
                  />
                </div>

                <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 16 }}>
                  <div className="row-between" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Interest Rate</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>{rate}%</span>
                  </div>
                  <div className="row-between">
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Repayment</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                      {form.amount ? fmt(Number(form.amount) * (1 + rate / 100)) : fmt(0)}
                    </span>
                  </div>
                </div>

                <button className="btn btn-blue" onClick={apply} disabled={busy || !form.amount || !form.purpose} style={{ height: 56 }}>
                  {busy ? 'Processing Request...' : 'Apply Now'} <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Repay Modal */}
      {
        showRepay && (
          <div className="overlay" onClick={() => setShowRepay(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--white)' }}>{t('repayment')}</h2>
                <button onClick={() => setShowRepay(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>{t('wallet_balance')}: <span style={{ color: 'var(--white)', fontWeight: 600 }}>{fmt(user?.balance || 0)}</span></p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                  <label className="label">{t('payment_amount')}</label>
                  <input className="input" type="number" placeholder={t('payment_amount')} value={repayAmt} onChange={e => setRepayAmt(e.target.value)} />
                </div>
                <button className="btn btn-blue" onClick={() => repay(showRepay)} disabled={busy || !repayAmt}>
                  {busy ? t('verifying') : t('pay_with_wallet')}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

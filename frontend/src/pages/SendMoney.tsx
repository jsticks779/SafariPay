import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { queueOfflineTransaction } from '../lib/offlineQueue';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  CheckCircle2,
  Search,
  Zap,
  Globe,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Phone,
  Banknote,
  Send,
  Smartphone,
  Building2,
  Wallet
} from 'lucide-react';
import Select from '../components/Select';
import { ALL_COUNTRIES } from '../lib/countries';
import { validatePhone } from '../lib/validation';

type Method = 'safari' | 'mobile' | 'bank';
type Step = 'method' | 'form' | 'confirm' | 'pin' | 'done';

export default function SendMoney() {
  const { user, refresh } = useAuth();
  const { t, language } = useLanguage();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<Method>('safari');
  const [phone, setPhone] = useState('');
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [provider, setProvider] = useState('');
  const [receiver, setReceiver] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [favs, setFavs] = useState<any[]>([]);
  const [isSavingFav, setIsSavingFav] = useState(false);

  // 🌍 [Localization] Dynamically resolve providers and banks based on user country
  const activeCountry = ALL_COUNTRIES.find(c => c.code === user?.country) || ALL_COUNTRIES.find(c => c.code === 'TZ')!;
  const providers = activeCountry.providers || [
    { id: 'mobile', label: 'Local Money' }
  ];
  const banks = activeCountry.banks || [
    { id: 'bank', label: 'Local Bank' }
  ];

  React.useEffect(() => {
    fetchFavs();
  }, []);

  // Automatic Lookup Effect: Resolves name as you type
  const phoneValidation = React.useMemo(() => validatePhone(phone, activeCountry.code), [phone, activeCountry.code]);

  React.useEffect(() => {
    if (method === 'safari' && phoneValidation.isValid) {
      const timer = setTimeout(() => {
        findUser(true);
      }, 500);
      return () => clearTimeout(timer);
    } else if (!phoneValidation.isValid) {
      setReceiver(null);
    }
  }, [phone, method, phoneValidation.isValid]);

  const fetchFavs = async () => {
    try {
      const { data } = await api.get('users/favorites');
      setFavs(data);
    } catch (e) { console.error('Failed to fetch favorites', e); }
  };

  const methods = [
    { id: 'safari', label: t('safari_transfer'), icon: Wallet, color: 'var(--primary)' },
    { id: 'mobile', label: t('mobile_money'), icon: Smartphone, color: 'var(--success)' },
    { id: 'bank', label: t('bank_transfer'), icon: Building2, color: 'var(--accent-indigo)' },
    { id: 'global', label: 'Send Global', icon: Globe, color: 'var(--primary)' }
  ];

  const findUser = async (silent = false) => {
    if (!phone.trim()) return;
    if (receiver && receiver.phone === phone) return; // Already found this one

    setSearching(true);
    try {
      // 🔗 [Blockchain SNS] First try to resolve the phone number via the On-Chain Registry
      const { data } = await api.get(`users/sns/resolve?phone=${encodeURIComponent(phone)}`);

      // If found on-chain, we enrich the receiver object
      setReceiver({
        ...data,
        phone, // Ensure phone is kept for UI
        isSNS: true // Flag for "Blockchain Verified" badge
      });

    } catch {
      // Fallback to legacy database lookup for speed/indexing if SNS not linked yet
      try {
        const { data } = await api.get(`users/lookup?phone=${encodeURIComponent(phone)}`);
        setReceiver(data);
      } catch (e: any) {
        setReceiver(null);
        if (!silent) toast.error(e.response?.data?.error || 'User not found on SafariPay Registry');
      }
    }
    finally { setSearching(false); }
  };

  const isCross = method === 'safari' && receiver && user && receiver.country !== user.country;
  const feeRate = method === 'safari' ? (isCross ? 0.008 : 0.005) : 0.012; // 1.2% for external
  const fee = amount ? Math.round(Number(amount) * feeRate) : 0;
  const total = Number(amount) + fee;

  const handleTransfer = async () => {
    setBusy(true);
    try {
      const url = method === 'safari' ? '/transactions/transfer' : '/transactions/external';

      // Safety check: ensure recipient is found via lookup/SNS before sending
      if (method === 'safari' && !receiver?.wallet_address) {
        toast.error('Recipient not fully resolved. Please check phone number.');
        setBusy(false);
        return;
      }

      const payload = method === 'safari'
        ? { recipient_wallet: receiver.wallet_address, amount: Number(amount), user_pin: pin, description: desc }
        : {
          external_type: method,
          user_pin: pin,
          provider: provider || phoneValidation.provider || 'mobile',
          receiver_id: method === 'mobile' ? (phoneValidation.formatted || phone) : account,
          amount: Number(amount),
          description: desc
        };

      if (!navigator.onLine) {
        queueOfflineTransaction(url, payload);
        toast.success(t('offline_queued') || '📡 Offline: Transfer queued!');
        setResult({ tx_hash: 'PENDING (OFFLINE)' });
        setStep('done');
        return;
      }

      const { data } = await api.post(url, payload);
      setResult(data);
      setStep('done');
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.message || 'Transfer failed');
      if (e.response?.status === 403) setPin(''); // Reset PIN if invalid
    }
    finally { setBusy(false); }
  };

  const saveToFavorites = async () => {
    if (!receiver) return;
    setIsSavingFav(true);
    try {
      await api.post('users/favorites', { favorite_id: receiver.id, nickname: receiver.name });
      toast.success(t('save_favorite_success') || 'Contact saved!');
      fetchFavs();
    } catch (e: any) { toast.error('Failed to save favorite'); }
    finally { setIsSavingFav(false); }
  };

  const quick = [5000, 10000, 20000, 50000, 100000];

  if (step === 'done') return (
    <div style={{ padding: '80px 24px', paddingBottom: 120, textAlign: 'center' }} className="animate-fade">
      <div style={{
        width: 100, height: 100, borderRadius: 50, background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', margin: '0 auto 32px', color: 'var(--success)'
      }}>
        <CheckCircle2 size={56} strokeWidth={1.5} />
      </div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--white)', marginBottom: 16 }}>{t('transfer_success')}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 40 }}>
        {t('deducted_from_wallet')} <span style={{ color: 'var(--white)', fontWeight: 600 }}>{fmt(total)}</span>
      </p>

      <div className="card" style={{ maxWidth: 380, margin: '0 auto 40px', textAlign: 'left' }}>
        <div style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>{t('recipient')}</p>
          <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--white)' }}>
            {method === 'safari' ? (receiver?.name || phone) : (method === 'mobile' ? phone : account)}
          </p>
          {method !== 'safari' && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{provider}</p>}
        </div>

        {method === 'safari' && receiver && !favs.find(f => f.phone === receiver.phone) && (
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('save_favorite')}</p>
            <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: 12 }} onClick={saveToFavorites} disabled={isSavingFav}>
              {isSavingFav ? '...' : <Zap size={14} style={{ marginRight: 6 }} />} {t('save_favorite')}
            </button>
          </div>
        )}

        {result?.tx_hash && (
          <div style={{ padding: '16px 0' }}>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>{t('tx_hash')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--primary)', wordBreak: 'break-all' }}>{result.tx_hash}</p>
              <ExternalLink size={14} color="var(--primary)" />
            </div>
          </div>
        )}
      </div>

      <button className="btn btn-blue" onClick={() => nav('/')} style={{ maxWidth: 320, margin: '0 auto' }}>{t('done_btn')}</button>
    </div>
  );

  return (
    <div style={{ padding: '24px 20px', paddingBottom: 120 }} className="animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => {
          if (step === 'method') nav('/');
          else if (step === 'form') setStep('method');
          else if (step === 'confirm') setStep('form');
        }} style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'var(--glass)', border: '1px solid var(--glass-border-hi)',
          color: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>{t('transfer')}</h1>
      </div>

      {step === 'method' && (
        <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8, marginLeft: 4 }}>{t('send_method')}</p>
          {methods.map(m => (
            <button key={m.id} onClick={() => {
              if (m.id === 'global') nav('/send/global');
              else { setMethod(m.id as Method); setStep('form'); }
            }}
              style={{
                background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 24, padding: '24px',
                display: 'flex', alignItems: 'center', gap: 20, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s'
              }} className="list-item">
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.color }}>
                <m.icon size={26} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--white)' }}>{m.label}</p>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>
                  {m.id === 'safari' ? 'Instant & zero-fee internal transfer' : (m.id === 'mobile' ? 'Send to M-Pesa, Airtel, Tigo, etc.' : 'Send to local bank accounts')}
                </p>
              </div>
              <ChevronRight size={18} style={{ marginLeft: 'auto', opacity: 0.3 }} />
            </button>
          ))}
        </div>
      )}

      {step === 'form' && (
        <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Method Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 20, width: 'fit-content', marginLeft: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>{method.toUpperCase()}</span>
          </div>

          {/* Favorites Quick Access */}
          {method === 'safari' && favs.length > 0 && (
            <div className="animate-fade" style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 12, marginLeft: 4 }}>{t('favorites_title')}</p>
              <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }} className="hide-scrollbar">
                {favs.map(f => (
                  <button key={f.id} onClick={() => { setPhone(f.phone); setReceiver(f); }}
                    style={{
                      background: 'var(--glass)', border: f.phone === phone ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                      borderRadius: 16, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, whiteSpace: 'nowrap'
                    }}>
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                      <Zap size={16} />
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{f.nickname || f.name}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.phone}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recipient Details */}
          <div className="card overflow-visible" style={{ padding: 24 }}>
            <label className="label">{t('recipient_details')}</label>

            {method === 'bank' && (
              <div style={{ marginBottom: 16 }}>
                <Select
                  value={provider}
                  options={banks}
                  onChange={setProvider}
                  placeholder={t('select_bank')}
                  style={{ marginBottom: 16 }}
                />
                <div style={{ position: 'relative' }}>
                  <Building2 size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input className="input" style={{ paddingLeft: 42 }} placeholder={t('account_number')} value={account} onChange={e => setAccount(e.target.value)} />
                </div>
              </div>
            )}

            {(method === 'safari' || method === 'mobile') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {method === 'mobile' && (
                  <Select
                    value={provider}
                    options={providers}
                    onChange={setProvider}
                    placeholder={t('select_provider')}
                  />
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Phone size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input className="input" style={{ paddingLeft: 42, border: phone && !phoneValidation.isValid ? '1px solid #ef4444' : '1px solid var(--glass-border)' }} placeholder="+255 712 345 678" value={phone}
                      onChange={e => { setPhone(e.target.value); setReceiver(null); }} />
                    {phone && phoneValidation.isValid && phoneValidation.provider && (
                      <div className="animate-fade" style={{ position: 'absolute', top: -10, right: 12, background: 'var(--primary)', color: 'white', fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 6, boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                        {phoneValidation.provider.toUpperCase()}
                      </div>
                    )}
                  </div>
                  {method === 'safari' && (
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '0 20px' }} onClick={() => findUser(false)} disabled={searching}>
                      {searching ? '...' : <Search size={20} />}
                    </button>
                  )}
                </div>
              </div>
            )}

            {method === 'safari' && receiver && (
              <div className="animate-fade" style={{ marginTop: 20, padding: '16px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: 16 }}>
                <div className="row-between">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>{receiver.name}</p>
                      {receiver.isSNS ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: 6, border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.5px' }}>SNS VERIFIED</span>
                          <ShieldCheck size={10} color="var(--primary)" />
                        </div>
                      ) : (
                        <ShieldCheck size={14} color="var(--success)" />
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{receiver.phone} · {receiver.country}</p>
                  </div>
                  {isCross && <span className="badge badge-blue">🌍 {t('global')}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Amount */}
          <div className="card" style={{ padding: 24 }}>
            <label className="label">{t('transfer_amount')}</label>
            <div style={{ position: 'relative' }}>
              <Banknote size={24} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input className="input" placeholder="0.00" value={amount} type="number"
                onChange={e => setAmount(e.target.value)}
                style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)', padding: '24px 16px 24px 52px' }} />
            </div>
          </div>

          {/* Fee preview */}
          {amount && Number(amount) > 0 && (
            <div className="animate-up" style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.03)', border: '1px solid var(--glass-border-hi)', borderRadius: 24 }}>
              <div className="row-between" style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('initial_amount')}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{fmt(Number(amount), user?.currency)}</span>
              </div>
              <div className="row-between" style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('network_fee')} ({method === 'safari' ? (isCross ? '0.8%' : '0.5%') : '1.2%'})</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{fmt(fee, user?.currency)}</span>
              </div>
              <div style={{ height: 1, background: 'var(--glass-border-hi)', marginBottom: 16 }} />
              <div className="row-between">
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)' }}>{t('total_cost')}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)' }}>{fmt(total, user?.currency)}</span>
              </div>
            </div>
          )}

          <button
            className="btn btn-blue"
            disabled={(!phone && !account) || !amount || Number(amount) <= 0}
            onClick={() => {
              if (user?.trust_level !== 'HIGH') {
                toast.error('Identity verification required. Please complete KYC.');
                nav('/onboarding?mode=verify');
                return;
              }
              setStep('confirm');
            }}
            style={{
              marginTop: 8,
              background: user?.trust_level !== 'HIGH' ? 'rgba(245, 158, 11, 0.1)' : 'var(--primary)',
              border: user?.trust_level !== 'HIGH' ? '1px solid rgba(245, 158, 11, 0.3)' : 'none',
              color: user?.trust_level !== 'HIGH' ? '#fbbf24' : 'white',
              boxShadow: user?.trust_level !== 'HIGH' ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.3)'
            }}>
            {user?.trust_level !== 'HIGH' ? 'Verify KYC to Send Money' : t('review_transaction')} <ChevronRight size={18} style={{ marginLeft: 6 }} />
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card-glow" style={{ textAlign: 'center', padding: 40 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>{t('review_order')}</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--white)' }}>
              {fmt(Number(amount), user?.currency)}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 8 }}>
              {t('transferring_to')} <span style={{ color: 'var(--white)', fontWeight: 600 }}>{method === 'safari' ? (receiver?.name || phone) : (method === 'mobile' ? phone : account)}</span>
            </p>
          </div>

          <div className="card" style={{ padding: 24 }}>
            {[
              { l: t('phone_number'), v: method === 'safari' || method === 'mobile' ? phone : account, show: true },
              { l: t('net_amount'), v: fmt(Number(amount), user?.currency), show: true },
              { l: t('service_fee'), v: fmt(fee, user?.currency), show: true },
              { l: t('settlement'), v: method === 'safari' ? 'Instant' : '2-5 Minutes', show: true },
              { l: t('network'), v: method === 'safari' ? 'Polygon POS' : provider, show: !!provider || method === 'safari' },
            ].filter(i => i.show).map(item => (
              <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500 }}>{item.l}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--white)' }}>{item.v}</span>
              </div>
            ))}
            <div className="row-between" style={{ paddingTop: 20 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--white)' }}>{t('final_total')}</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{fmt(total, user?.currency)}</span>
            </div>
          </div>

          <button className="btn btn-blue" onClick={() => setStep('pin')} disabled={busy}>
            {t('confirm_transfer')} <ChevronRight size={18} />
          </button>
          <button className="btn btn-secondary" onClick={() => setStep('form')}>{t('cancel_edit')}</button>
        </div>
      )}

      {step === 'pin' && (
        <div className="animate-up" style={{ maxWidth: 400, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto 16px' }}>
              <ShieldCheck size={32} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--white)', marginBottom: 8 }}>{t('enter_transfer_pin')}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('enter_pin_msg')}</p>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 48, height: 56, borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--glass-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'var(--white)'
              }}>
                {pin[i] ? '•' : ''}
              </div>
            ))}
          </div>

          {/* Numeric Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map(k => (
              <button key={k} onClick={() => {
                if (k === 'C') setPin('');
                else if (k === '⌫') setPin(pin.slice(0, -1));
                else if (pin.length < 4) setPin(pin + k);
              }} className="btn-secondary" style={{ height: 60, padding: 0, fontSize: 20, borderRadius: 16, border: 'none', background: 'rgba(255,255,255,0.03)' }}>
                {k}
              </button>
            ))}
          </div>

          <button className="btn btn-blue" disabled={pin.length < 4 || busy} onClick={handleTransfer}>
            {busy ? t('processing') : t('confirm_authorize')}
          </button>
          <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setStep('confirm')}>{t('back')}</button>
        </div>
      )}
    </div>
  );
}

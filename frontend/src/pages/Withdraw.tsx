import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    CheckCircle2,
    Smartphone,
    Building2,
    ChevronRight,
    Banknote,
    History,
    Info,
    Globe,
    WifiOff
} from 'lucide-react';
import Select from '../components/Select';
import { ALL_COUNTRIES } from '../lib/countries';
import { queueOfflineTransaction } from '../lib/offlineQueue';
import { validatePhone, validateAccount } from '../lib/validation';

type Method = 'mobile' | 'bank' | 'crypto';
type Step = 'method' | 'form' | 'confirm' | 'done';

export default function Withdraw() {
    const { user, refresh } = useAuth();
    const { t } = useLanguage();
    const nav = useNavigate();
    const [step, setStep] = useState<Step>('method');
    const [method, setMethod] = useState<Method>('mobile');
    const [phone, setPhone] = useState(user?.phone || '');
    const [account, setAccount] = useState('');
    const [wallet, setWallet] = useState('');
    const [network, setNetwork] = useState('Polygon Amoy');
    const [amount, setAmount] = useState('');
    const [provider, setProvider] = useState('');
    const [busy, setBusy] = useState(false);

    const [pin, setPin] = useState('');

    const methods = [
        { id: 'mobile', label: t('mobile_money') || 'Mobile Money', icon: Smartphone, color: 'var(--success)' },
        { id: 'bank', label: t('bank_transfer') || 'Bank Transfer', icon: Building2, color: 'var(--accent-indigo)' },
        { id: 'crypto', label: 'Crypto Wallet', icon: Globe, color: 'var(--warning)' }
    ];

    // 🌍 [Localization] Dynamically resolve providers and banks based on user country
    const activeCountry = ALL_COUNTRIES.find(c => c.code === user?.country) || ALL_COUNTRIES.find(c => c.code === 'TZ')!;
    const providers = activeCountry.providers || [];
    const banks = activeCountry.banks || [];

    const handleWithdraw = async () => {
        if (!pin || pin.length !== 4) return toast.error('Please enter your 4-digit PIN to authorize the withdrawal on-chain.');
        
        if (method === 'crypto') {
            if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
                return toast.error('Invalid Ethereum/Polygon wallet address format.');
            }
        } else if (method === 'mobile') {
          const v = validatePhone(phone, user?.country || 'TZ');
          if (!v.isValid) return toast.error(v.message || 'Invalid phone number');
        } else {
          const v = validateAccount(account, provider);
          if (!v.isValid) return toast.error(v.message || 'Invalid account number');
        }

        setBusy(true);
        try {
            const v = method === 'mobile' ? validatePhone(phone, user?.country || 'TZ') : null;
            
            const payload = method === 'crypto' ? {
                wallet_address: wallet,
                network,
                amount_usdt: Number(amount) / 2850, // Approximation to pass validation. True conversion happens on-chain/backend
                user_pin: pin,
                amount_tzs: Number(amount)
            } : {
                provider,
                phone: method === 'mobile' ? (v?.formatted || phone) : account,
                amount: Number(amount),
                user_pin: pin
            };
            
            const url = method === 'crypto' ? 'transactions/withdraw/crypto' : 'transactions/withdraw';
            if (!navigator.onLine) {
                toast.error('Off-ramping requires a live connection to authorize Smart Contracts.');
                setBusy(false);
                return;
            }
            await api.post(url, payload);
            setStep('done');
            refresh();
        } catch (e: any) {
            toast.error(e.response?.data?.error || e.message || 'Withdrawal failed');
        } finally {
            setBusy(false);
        }
    };

    if (step === 'done') return (
        <div style={{ padding: '80px 24px', textAlign: 'center' }} className="animate-fade">
            <div style={{
                width: 100, height: 100, borderRadius: 50, background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 32px', color: 'var(--success)'
            }}>
                <CheckCircle2 size={56} strokeWidth={1.5} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--white)', marginBottom: 16 }}>{t('withdraw_success')}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 40 }}>
                Funds will arrive in your <span style={{ color: 'var(--white)', fontWeight: 600 }}>{provider}</span> account shortly.
            </p>
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
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>{t('withdraw')}</h1>
            </div>

            {step === 'method' && (
                <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8, marginLeft: 4 }}>{t('withdraw_to')}</p>
                    {methods.map(m => (
                        <button key={m.id} onClick={() => { setMethod(m.id as Method); setStep('form'); }}
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
                                    {m.id === 'mobile' ? 'Move funds to your mobile wallet' : (m.id === 'bank' ? 'Transfer to your local bank account' : 'Withdraw directly to Web3 Decentralized Wallet')}
                                </p>
                            </div>
                            <ChevronRight size={18} style={{ marginLeft: 'auto', opacity: 0.3 }} />
                        </button>
                    ))}
                </div>
            )}

            {step === 'form' && (
                <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card overflow-visible" style={{ padding: 24 }}>
                        <label className="label">{t('recipient_details')}</label>
                        {method === 'crypto' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ position: 'relative' }}>
                                    <Globe size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                    <input className="input" style={{ paddingLeft: 42 }} placeholder="0x..." value={wallet} onChange={e => setWallet(e.target.value)} />
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    {['Polygon Amoy', 'Ethereum'].map(n => (
                                        <button key={n} onClick={() => setNetwork(n)} style={{
                                            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                            background: network === n ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.05)',
                                            border: network === n ? '1px solid var(--primary)' : '1px solid transparent',
                                            color: network === n ? 'white' : 'var(--text-muted)'
                                        }}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--warning)', marginTop: 4 }}>⚠️ Crypto transfers are irreversible. Ensure the address supports USDT on {network}.</p>
                            </div>
                        ) : method === 'mobile' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
                                    {providers.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => setProvider(p.id)}
                                            style={{
                                                flex: '0 0 auto',
                                                padding: '12px 16px',
                                                borderRadius: 16,
                                                background: provider === p.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${provider === p.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}`,
                                                color: provider === p.id ? 'white' : 'var(--text-muted)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 8 }}>{p.label[0]}</div>
                                            <span style={{ fontSize: 12, fontWeight: 700 }}>{p.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <Smartphone size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                    <input className="input" style={{ paddingLeft: 42 }} placeholder={t('phone_number') || 'Recipient Phone'} value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
                                    {banks.map(b => (
                                        <button
                                            key={b.id}
                                            onClick={() => setProvider(b.id)}
                                            style={{
                                                flex: '0 0 auto',
                                                padding: '12px 16px',
                                                borderRadius: 16,
                                                background: provider === b.id ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${provider === b.id ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.05)'}`,
                                                color: provider === b.id ? 'white' : 'var(--text-muted)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Building2 size={16} />
                                            <span style={{ fontSize: 12, fontWeight: 700 }}>{b.label}</span>
                                        </button>
                                    ))}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <Building2 size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                    <input className="input" style={{ paddingLeft: 42 }} placeholder={t('account_number') || 'Account Number'} value={account} onChange={e => setAccount(e.target.value)} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ padding: 24 }}>
                        <label className="label">{t('withdraw_amount')}</label>
                        <div style={{ position: 'relative' }}>
                            <Banknote size={24} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input className="input" placeholder="0.00" value={amount} type="number"
                                onChange={e => setAmount(e.target.value)}
                                style={{ fontSize: 32, fontWeight: 700, fontFamily: 'var(--font-display)', padding: '24px 16px 24px 52px' }} />
                        </div>
                        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-dim)' }}>{t('wallet_balance')}: {fmt(user?.balance || 0)}</p>
                    </div>

                    <button
                        className="btn btn-blue"
                        disabled={!amount || Number(amount) <= 0 || busy}
                        onClick={() => {
                            const isKycOk = user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved';
                            if (!isKycOk) {
                                toast.error('Identity verification required. Please complete KYC.');
                                nav('/onboarding?mode=verify');
                                return;
                            }
                            setStep('confirm');
                        }}
                        style={{
                            marginTop: 8,
                            background: !(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? 'rgba(245, 158, 11, 0.1)' : 'var(--primary)',
                            border: !(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? '1px solid rgba(245, 158, 11, 0.3)' : 'none',
                            color: !(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? '#fbbf24' : 'white',
                            boxShadow: !(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.3)'
                        }}
                    >
                        {!(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? 'Verify KYC to Withdraw' : t('next')} <ChevronRight size={18} style={{ marginLeft: 6 }} />
                    </button>
                </div>
            )}

            {step === 'confirm' && (
                <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card-glow" style={{ textAlign: 'center', padding: 40, position: 'relative', overflow: 'hidden' }}>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8, fontWeight: 600 }}>CASHING OUT</p>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 700, color: 'var(--white)' }}>{fmt(Number(amount))}</h2>
                        <div style={{ marginTop: 16, padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, display: 'inline-block' }}>
                            <p style={{ fontSize: 13, color: 'var(--success)' }}>≈ {(Number(amount) / 2850).toFixed(2)} USDT <span style={{ color: 'var(--text-muted)' }}>@ 2,850 TZS</span></p>
                        </div>
                        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginTop: 16 }}>{t('withdraw_to')} <span style={{ color: 'var(--white)', fontWeight: 600 }}>{provider}</span></p>
                    </div>

                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{method === 'crypto' ? 'Wallet Address' : (method === 'mobile' ? t('phone_number') : t('account_number'))}</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--white)', wordBreak: 'break-all', textAlign: 'right', maxWidth: '60%' }}>{method === 'crypto' ? wallet : (method === 'mobile' ? phone : account)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 16, paddingTop: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Off-Ramping Fee (1.0%)</span>
                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--danger)' }}>- {fmt(Number(amount) * 0.01)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 16 }}>
                            <span style={{ fontSize: 14, color: 'var(--white)' }}>You will receive</span>
                            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)' }}>{fmt(Number(amount) - (Number(amount) * 0.01))}</span>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 24 }}>
                        <label className="label">Authorize with Application PIN</label>
                        <input 
                            type="password" 
                            className="input" 
                            maxLength={4}
                            placeholder="Enter 4-digit PIN" 
                            value={pin}
                            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                            style={{ textAlign: 'center', fontSize: 24, letterSpacing: '0.5em', fontWeight: 800 }} 
                        />
                    </div>

                    <button className="btn btn-blue" onClick={handleWithdraw} disabled={busy || pin.length !== 4}>
                        {busy ? t('withdraw_processing') : `Authorize Withdrawal`}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setStep('form')}>{t('back')}</button>
                </div>
            )}
        </div>
    );
}

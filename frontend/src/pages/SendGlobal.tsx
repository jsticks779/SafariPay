import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import toast from 'react-hot-toast';
import {
    ArrowLeft,
    Globe,
    ChevronRight,
    ShieldCheck,
    Banknote,
    Send,
    Smartphone,
    Info,
    RefreshCw,
    Wallet,
    AlertCircle,
    Search,
    WifiOff
} from 'lucide-react';
import { queueOfflineTransaction } from '../lib/offlineQueue';
import Select from '../components/Select';

type Step = 'form' | 'confirm' | 'pin' | 'done';

const COUNTRIES = [
    // Africa (All major)
    { id: 'Kenya', label: 'Kenya', currency: 'KES', flag: '🇰🇪', icon: Smartphone, code: '+254', placeholder: '712 345 678' },
    { id: 'Uganda', label: 'Uganda', currency: 'UGX', flag: '🇺🇬', icon: Smartphone, code: '+256', placeholder: '700 000 000' },
    { id: 'Rwanda', label: 'Rwanda', currency: 'RWF', flag: '🇷🇼', icon: Smartphone, code: '+250', placeholder: '788 000 000' },
    { id: 'Nigeria', label: 'Nigeria', currency: 'NGN', flag: '🇳🇬', icon: Smartphone, code: '+234', placeholder: '803 000 0000' },
    { id: 'Ghana', label: 'Ghana', currency: 'GHS', flag: '🇬🇭', icon: Smartphone, code: '+233', placeholder: '24 000 0000' },
    { id: 'South Africa', label: 'South Africa', currency: 'ZAR', flag: '🇿🇦', icon: Smartphone, code: '+27', placeholder: '12 345 6789' },
    { id: 'Ethiopia', label: 'Ethiopia', currency: 'ETB', flag: '🇪🇹', icon: Smartphone, code: '+251', placeholder: '911 000 000' },
    { id: 'Egypt', label: 'Egypt', currency: 'EGP', flag: '🇪🇬', icon: Smartphone, code: '+20', placeholder: '10 0000 0000' },
    { id: 'Tanzania', label: 'Tanzania', currency: 'TZS', flag: '🇹🇿', icon: Wallet, code: '+255', placeholder: '712 345 678' },
    { id: 'DRC', label: 'DR Congo', currency: 'CDF', flag: '🇨🇩', icon: Smartphone, code: '+243', placeholder: '810 000 000' },
    { id: 'Burundi', label: 'Burundi', currency: 'BIF', flag: '🇧🇮', icon: Smartphone, code: '+257', placeholder: '79 000 000' },
    { id: 'Zambia', label: 'Zambia', currency: 'ZMW', flag: '🇿🇲', icon: Smartphone, code: '+260', placeholder: '97 000 0000' },
    // Global
    { id: 'United Kingdom', label: 'UK', currency: 'GBP', flag: '🇬🇧', icon: Send, code: '+44', placeholder: '7700 900000' },
    { id: 'United States', label: 'USA', currency: 'USD', flag: '🇺🇸', icon: Send, code: '+1', placeholder: '202 555 0123' },
    { id: 'European Union', label: 'EU', currency: 'EUR', flag: '🇪🇺', icon: Send, code: '+49', placeholder: '151 00000000' },
    { id: 'UAE', label: 'UAE', currency: 'AED', flag: '🇦🇪', icon: Send, code: '+971', placeholder: '50 000 0000' },
    { id: 'China', label: 'China', currency: 'CNY', flag: '🇨🇳', icon: Send, code: '+86', placeholder: '130 0000 0000' },
    { id: 'India', label: 'India', currency: 'INR', flag: '🇮🇳', icon: Send, code: '+91', placeholder: '98765 43210' },
    { id: 'Canada', label: 'Canada', currency: 'CAD', flag: '🇨🇦', icon: Send, code: '+1', placeholder: '416 555 0123' },
    { id: 'Australia', label: 'Australia', currency: 'AUD', flag: '🇦🇺', icon: Send, code: '+61', placeholder: '400 000 000' },
    { id: 'Japan', label: 'Japan', currency: 'JPY', flag: '🇯🇵', icon: Send, code: '+81', placeholder: '90 0000 0000' },
    { id: 'France', label: 'France', currency: 'EUR', flag: '🇫🇷', icon: Send, code: '+33', placeholder: '6 00 00 00 00' },
    { id: 'Germany', label: 'Germany', currency: 'EUR', flag: '🇩🇪', icon: Send, code: '+49', placeholder: '151 00000000' },
    { id: 'Brazil', label: 'Brazil', currency: 'BRL', flag: '🇧🇷', icon: Send, code: '+55', placeholder: '11 90000-0000' },
    { id: 'Turkey', label: 'Turkey', currency: 'TRY', flag: '🇹🇷', icon: Send, code: '+90', placeholder: '500 000 00 00' },
];

export default function SendGlobal() {
    const { user, refresh } = useAuth();
    const { t } = useLanguage();
    const nav = useNavigate();

    const [step, setStep] = useState<Step>('form');
    const [country, setCountry] = useState(COUNTRIES.find(c => c.currency !== (user?.currency || 'TZS')) || COUNTRIES[0]);
    const [phone, setPhone] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [pin, setPin] = useState('');
    const [search, setSearch] = useState('');

    const filteredCountries = COUNTRIES.filter(c =>
        (c.label.toLowerCase().includes(search.toLowerCase()) ||
        c.currency.toLowerCase().includes(search.toLowerCase())) &&
        c.currency !== (user?.currency || 'TZS')
    );

    useEffect(() => {
        if (user && country.currency === user.currency) {
            const newTarget = COUNTRIES.find(c => c.currency !== user.currency);
            if (newTarget) setCountry(newTarget);
        }
    }, [user, country.currency]);

    const [fxRate, setFxRate] = useState<number | null>(null);
    const [loadingRate, setLoadingRate] = useState(false);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<any>(null);

    // Fetch FX Rate when country or amount changes
    useEffect(() => {
        const fetchRate = async () => {
            setLoadingRate(true);
            try {
                const { data } = await api.get(`transfer/fx-rates?from=${user?.currency || 'TZS'}&to=${country.currency}`);
                setFxRate(data.rate);
            } catch (e) {
                toast.error('Failed to fetch real-time exchange rate');
            } finally {
                setLoadingRate(false);
            }
        };
        if (user) fetchRate();
    }, [country, user]);

    const feeRate = 0.005; // 0.5%
    const fee = amount ? Number((Number(amount) * feeRate).toFixed(2)) : 0;
    const total = amount ? Number(amount) + fee : 0;
    const targetAmount = (amount && fxRate) ? Number((Number(amount) * fxRate).toFixed(2)) : 0;

    const handleTransfer = async () => {
        setBusy(true);
        try {
            const payload = {
                recipient_phone: phone,
                recipient_country: country.id,
                amount_source: Number(amount),
                description,
                pin
            };
            const url = 'transfer/international';

            if (!navigator.onLine) {
                queueOfflineTransaction(url, payload);
                setResult({
                    target_amount: targetAmount,
                    destination_currency: country.currency,
                    exchange_rate: fxRate,
                    transaction: { tx_hash: 'PENDING (OFFLINE)' }
                });
                setStep('done');
                toast.success('📡 Offline: Global transfer queued!');
                return;
            }

            const { data } = await api.post(url, payload);
            setResult(data.data);
            setStep('done');
            refresh();
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'International transfer failed');
            if (e.response?.status === 403) setPin('');
        } finally {
            setBusy(false);
        }
    };

    if (step === 'done') return (
        <div style={{ padding: '80px 24px', textAlign: 'center' }} className="animate-fade">
            <div style={{
                width: 100, height: 100, borderRadius: 50, background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 32px', color: 'var(--primary)'
            }}>
                <Globe size={56} className="animate-float" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'var(--white)', marginBottom: 16 }}>Success!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 16, marginBottom: 40 }}>
                Deducted <span style={{ color: 'var(--white)', fontWeight: 600 }}>{fmt(total)}</span>
            </p>

            <div className="card" style={{ maxWidth: 400, margin: '0 auto 40px', textAlign: 'left' }}>
                <div style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 600 }}>Global Recipient</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? (
                <>
                  <ShieldCheck size={16} color="var(--success)" />
                  <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 700 }}>Verified</span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 700 }}>Pending KYC</span>
              )}
            </div>
                </div>

                <div style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)' }}>
                    <div className="row-between">
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Amount Received</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)' }}>{result.target_amount} {result.destination_currency}</span>
                    </div>
                    <div className="row-between" style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>FX Rate ({user?.currency}/{result.destination_currency})</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--white)' }}>{result.exchange_rate}</span>
                    </div>
                </div>

                {result.ipfs_receipt && (
                    <div style={{ padding: '16px 0', marginTop: 12, borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
                        <a 
                            href={`https://w3s.link/ipfs/${result.ipfs_receipt}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                gap: 8, 
                                color: 'var(--success)', 
                                fontSize: 13, 
                                fontWeight: 600,
                                textDecoration: 'none',
                                padding: '12px',
                                borderRadius: 12,
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}
                        >
                            <ShieldCheck size={16} />
                            Verifiable Filecoin Receipt
                        </a>
                    </div>
                )}
            </div>

            <button className="btn btn-blue" onClick={() => nav('/')} style={{ maxWidth: 320, margin: '0 auto' }}>Back Home</button>
        </div>
    );

    return (
        <div style={{ padding: '24px 20px', paddingBottom: 120 }} className="animate-fade">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                <button onClick={() => {
                    if (step === 'form') nav('/send');
                    else setStep('form');
                }} style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'var(--glass)', border: '1px solid var(--glass-border-hi)',
                    color: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--white)' }}>Send Global</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>Cross-border settlements via USDC</p>
                </div>
            </div>

            {step === 'form' && (
                <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>


                    {/* Destination */}
                    <div className="card" style={{ padding: 24 }}>
                        <div className="row-between" style={{ marginBottom: 16 }}>
                            <label className="label" style={{ margin: 0 }}>Destination Country</label>
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{filteredCountries.length} Available</span>
                        </div>

                        {/* Search Bar */}
                        <div style={{ position: 'relative', marginBottom: 16 }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input
                                className="input"
                                style={{ paddingLeft: 36, height: 44, fontSize: 14, background: 'rgba(255,255,255,0.02)' }}
                                placeholder="Search country or currency..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 10,
                            maxHeight: 240,
                            overflowY: 'auto',
                            paddingRight: 4,
                            marginBottom: 20
                        }} className="hide-scrollbar">
                            {filteredCountries.map(c => (
                                <button key={c.id} onClick={() => setCountry(c)} style={{
                                    padding: '12px 8px', borderRadius: 16, border: country.id === c.id ? '2px solid var(--primary)' : '1px solid var(--glass-border)',
                                    background: country.id === c.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s'
                                }}>
                                    <div style={{ fontSize: 24, marginBottom: 4 }}>{c.flag}</div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{c.label}</div>
                                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{c.currency}</div>
                                </button>
                            ))}
                            {filteredCountries.length === 0 && (
                                <div style={{ gridColumn: 'span 3', padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                                    No countries found matching "{search}"
                                </div>
                            )}
                        </div>

                        <label className="label">Recipient Phone</label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Smartphone size={18} style={{ color: 'var(--text-dim)' }} />
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)', borderRight: '1px solid var(--glass-border)', paddingRight: 8 }}>{country.code}</span>
                            </div>
                            <input
                                className="input"
                                style={{ paddingLeft: country.code.length * 10 + 40 }}
                                placeholder={country.placeholder}
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Amount Box */}
                    <div className="card" style={{ padding: 24 }}>
                        <div className="row-between" style={{ marginBottom: 12 }}>
                            <label className="label" style={{ margin: 0 }}>Amount ({user?.currency || 'TZS'})</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)', fontSize: 13, fontWeight: 600 }}>
                                {loadingRate ? <RefreshCw size={14} className="animate-spin" /> : (
                                    <span>
                                        {fxRate ? (fxRate < 1 ? `1 ${country.currency} ≈ ${(1 / fxRate).toFixed(2)} ${user?.currency}` : `1 ${user?.currency} ≈ ${fxRate.toFixed(2)} ${country.currency}`) : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Banknote size={24} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input className="input" placeholder="0.00" value={amount} type="number"
                                onChange={e => setAmount(e.target.value)}
                                style={{ fontSize: 28, fontWeight: 700, padding: '20px 16px 20px 52px' }} />
                        </div>

                        {targetAmount > 0 && (
                            <div style={{ marginTop: 20, padding: 16, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: 16 }}>
                                <div className="row-between">
                                    <div>
                                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Recipient receives</p>
                                        <p style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{targetAmount.toLocaleString()} {country.currency}</p>
                                    </div>
                                    <Globe size={24} color="var(--success)" strokeWidth={1.5} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Fee Breakdown */}
                    {amount && Number(amount) > 0 && (
                        <div style={{ padding: '0 8px' }}>
                            <div className="row-between" style={{ marginBottom: 8 }}>
                                <span style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    Global Fee (0.5%) <Info size={14} />
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{fmt(fee)}</span>
                            </div>
                            <div className="row-between">
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--white)' }}>Total Cost</span>
                                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)' }}>{fmt(total)}</span>
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-blue"
                        disabled={!phone || !amount || Number(amount) <= 0}
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
                        {!(user?.trust_level === 'HIGH' || user?.trust_level === 'Verified' || (user as any).kyc_status === 'Approved') ? 'Verify KYC to Continue' : 'Continue'} <ChevronRight size={18} style={{ marginLeft: 6 }} />
                    </button>
                </div>
            )}

            {step === 'confirm' && (
                <div className="animate-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="card-glow" style={{ textAlign: 'center', padding: '32px 20px' }}>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Review International Order</p>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 700, color: 'white' }}>{fmt(Number(amount))}</h2>
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)' }}>
                            <span>{user?.currency}</span>
                            <ChevronRight size={14} />
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{targetAmount} {country.currency}</span>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '8px 4px' }}>
                        {[
                            { l: 'Destination', v: `${country.flag} ${country.label}`, c: 'var(--white)' },
                            { l: 'Recipient', v: phone, c: 'var(--white)' },
                            { l: 'FX Rate', v: fxRate && fxRate < 1 ? `1 ${country.currency} = ${(1 / fxRate).toFixed(2)} ${user?.currency}` : `1 ${user?.currency} = ${fxRate?.toFixed(2)} ${country.currency}`, c: 'var(--primary)' },
                            { l: 'Service Fee', v: fmt(fee), c: 'var(--white)' },
                            { l: 'Settlement', v: 'via USDC Liquidity Vault', c: 'var(--text-dim)' },
                        ].map(item => (
                            <div key={item.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500 }}>{item.l}</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: item.c }}>{item.v}</span>
                            </div>
                        ))}
                        <div className="row-between" style={{ padding: '20px' }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>Total Payout</span>
                            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{fmt(total)}</span>
                        </div>
                    </div>

                    <button className="btn btn-blue" onClick={() => setStep('pin')}>Verify & Authorize</button>
                    <button className="btn btn-secondary" onClick={() => setStep('form')}>Cancel</button>
                </div>
            )}

            {step === 'pin' && (
                <div className="animate-up" style={{ maxWidth: 400, margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto 16px' }}>
                            <ShieldCheck size={32} />
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--white)', marginBottom: 8 }}>Final Security Check</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Enter your 4-digit PIN to release funds to the liquidity vault</p>
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40 }}>
                        {[0, 1, 2, 3].map(i => (
                            <div key={i} style={{
                                width: 48, height: 56, borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--glass-border)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white'
                            }}>
                                {pin[i] ? '•' : ''}
                            </div>
                        ))}
                    </div>

                    {/* Keypad */}
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
                        {busy ? 'Processing Settlement...' : 'Authorize Global Transfer'}
                    </button>
                    <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setStep('confirm')}>Back</button>
                </div>
            )}
        </div>
    );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import api from '../lib/api';
import {
    ArrowLeft,
    Copy,
    Check,
    QrCode,
    Smartphone,
    Hash,
    Share2,
    PlusCircle,
    Loader2,
    Bitcoin,
    History,
    Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ALL_COUNTRIES } from '../lib/countries';

export default function ReceiveMoney() {
    const { user, refresh } = useAuth();
    const { t } = useLanguage();
    const nav = useNavigate();
    const [mode, setMode] = useState<'mobile' | 'crypto'>('mobile');
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // 🌍 [Localization] Dynamically resolve providers based on user country
    const activeCountry = ALL_COUNTRIES.find(c => c.code === user?.country) || ALL_COUNTRIES.find(c => c.code === 'TZ')!;
    const providers = activeCountry.providers || [];

    const [provider, setProvider] = useState(providers[0]?.id || 'MPESA');

    const [amount, setAmount] = useState('');
    const [depositPhone, setDepositPhone] = useState(user?.phone || '');
    const [depositing, setDepositing] = useState(false);

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success(t('copied'));
        setTimeout(() => setCopiedField(null), 2000);
    };


    const handleDeposit = async () => {
        if (!amount || Number(amount) <= 0) {
            return toast.error('Enter a valid amount');
        }
        setDepositing(true);
        try {
            const res = await api.post('bridge/stkpush/onramp', {
                amount: Number(amount),
                currency: user?.currency || 'TZS',
                phone: depositPhone,
                provider: provider
            });
            toast.success(res.data.message || `Successfully started deposit via ${provider}!`);
            await refresh();
            setAmount('');
        } catch (e: any) {
            toast.error(e.response?.data?.error || 'Deposit failed');
        } finally {
            setDepositing(false);
        }
    };

    return (
        <div style={{ padding: '24px 20px', paddingBottom: 120 }} className="animate-fade">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
                <button onClick={() => nav(-1)} style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: 'var(--glass)', border: '1px solid var(--glass-border-hi)',
                    color: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>{t('deposit_funds') || 'Deposit Funds'}</h1>
            </div>

            {/* Mode Switcher */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 18,
                padding: 6,
                display: 'flex',
                gap: 6,
                marginBottom: 32,
                border: '1px solid var(--glass-border)'
            }}>
                <button
                    onClick={() => setMode('mobile')}
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        borderRadius: 14,
                        background: mode === 'mobile' ? 'var(--primary)' : 'transparent',
                        color: mode === 'mobile' ? 'white' : 'var(--text-muted)',
                        border: 'none',
                        fontSize: 14,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                >
                    <Smartphone size={18} />
                    Mobile
                </button>
                <button
                    onClick={() => setMode('crypto')}
                    style={{
                        flex: 1,
                        padding: '12px 16px',
                        borderRadius: 14,
                        background: mode === 'crypto' ? '#26a17b' : 'transparent',
                        color: mode === 'crypto' ? 'white' : 'var(--text-muted)',
                        border: 'none',
                        fontSize: 14,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        transition: 'all 0.3s'
                    }}
                >
                    <Bitcoin size={18} />
                    Crypto
                </button>
            </div>

            {mode === 'mobile' ? (
                <>
                    {/* Mobile Money Implementation */}
                    <div className="animate-up" style={{ marginBottom: 24, display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
                        {providers.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setProvider(p.id)}
                                style={{
                                    flex: '0 0 auto',
                                    padding: '12px 20px',
                                    borderRadius: 16,
                                    background: provider === p.id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${provider === p.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)'}`,
                                    color: provider === p.id ? 'white' : 'var(--text-muted)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 8,
                                    minWidth: 100,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 10 }}>
                                    {p.label[0]}
                                </div>
                                <span style={{ fontSize: 11, fontWeight: 700 }}>{p.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="card-glow animate-up" style={{ marginBottom: 24, padding: '28px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                            <div style={{
                                width: 40, height: 40, borderRadius: 12,
                                background: 'rgba(59, 130, 246, 0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--primary)'
                            }}>
                                <PlusCircle size={22} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Deposit via {providers.find(p => p.id === provider)?.label}</h3>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Top up your wallet instantly</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Amount ({user?.currency || 'TZS'})</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="e.g. 50,000"
                                style={{
                                    width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                                    borderRadius: 16, padding: '16px 20px', fontSize: 18, fontWeight: 700, color: 'white', outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 24 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>Target Mobile Number (STK Push)</label>
                            <div style={{ position: 'relative' }}>
                                <Smartphone size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                <input
                                    type="tel"
                                    value={depositPhone}
                                    onChange={(e) => setDepositPhone(e.target.value)}
                                    placeholder="+255 712 345 678"
                                    style={{
                                        width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                                        borderRadius: 16, padding: '16px 20px 16px 52px', fontSize: 16, fontWeight: 600, color: 'white', outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleDeposit}
                            disabled={depositing || !amount}
                            className="btn btn-blue"
                            style={{ width: '100%', height: 56, borderRadius: 16, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                        >
                            {depositing ? <Loader2 size={20} className="animate-spin" /> : 'Confirm Deposit'}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    {/* Crypto Deposit Implementation */}
                    <div className="card-glow animate-up" style={{ marginBottom: 24, padding: '32px 24px', textAlign: 'center' }}>
                        <div style={{
                            width: 60, height: 60, borderRadius: 18, background: 'rgba(38, 161, 123, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#26a17b', margin: '0 auto 20px'
                        }}>
                            <Bitcoin size={32} />
                        </div>
                        <h3 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8 }}>USDT Deposit</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>Scan or copy your wallet address below</p>

                        <div style={{
                            width: 200, height: 200, background: 'white', margin: '0 auto 32px',
                            borderRadius: 24, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                        }}>
                            <QrCode size={160} color="#1e293b" />
                        </div>

                        <div style={{
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                            borderRadius: 20, padding: '16px 20px', textAlign: 'left'
                        }}>
                            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Your USDT Wallet Address</p>
                            <div className="row-between" style={{ gap: 12 }}>
                                <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#26a17b', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {user?.wallet_address}
                                </span>
                                <button onClick={() => copyToClipboard(user?.wallet_address || '', 'wallet')}
                                    style={{ background: 'none', border: 'none', color: '#26a17b', cursor: 'pointer' }}>
                                    {copiedField === 'wallet' ? <Check size={20} /> : <Copy size={20} />}
                                </button>
                            </div>
                        </div>

                        <div style={{
                            marginTop: 20, padding: '12px 16px', background: 'rgba(59, 130, 246, 0.05)',
                            borderRadius: 14, border: '1px solid rgba(59, 130, 246, 0.1)',
                            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
                        }}>
                            <Shield size={18} color="var(--primary)" />
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                                This is a <b>Self-Custodial</b> deposit. Send USDT from your external wallet (Trust, Binance) to this address.
                                Supported network: <b>Polygon {process.env.NODE_ENV === 'production' ? 'Mainnet' : '(Amoy Testnet)'}</b>.
                            </p>
                        </div>
                    </div>
                </>
            )}

            {/* Bottom Card (Shared) */}
            <div className="card animate-up" style={{ padding: '24px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                    <Hash size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{mode === 'mobile' ? 'Offline Top-up' : 'L2 Gas Optimization'}</h3>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                    {mode === 'mobile'
                        ? 'You can top up your SafariPay wallet even without an active internet connection using our USSD backup system.'
                        : 'SafariPay uses Layer 2 scaling (Polygon) to ensure your crypto deposits and transfers have nearly zero gas fees.'}
                </p>
            </div>

            <button className="btn btn-blue" style={{ marginTop: 24, width: '100%' }}>
                <History size={18} /> View Deposit History
            </button>
        </div>
    );
}

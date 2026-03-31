import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import api, { fmt } from '../lib/api';
import toast from 'react-hot-toast';
import {
    LayoutDashboard,
    ArrowUpRight,
    QrCode,
    Users,
    Key,
    Wallet,
    TrendingUp,
    Settings,
    MoreVertical,
    CheckCircle2,
    Share2,
    FileText,
    MessageCircle,
    Percent,
    Copy,
    Check,
    RefreshCw,
    Eye,
    EyeOff,
    WifiOff,
    Globe2,
    Smartphone,
    ArrowDownLeft,
    Loader2,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';

type Tab = 'overview' | 'transactions' | 'qr' | 'staff' | 'keys' | 'settlement';

export default function MerchantDashboard() {
    const { user, refresh } = useAuth();
    const { t, language, setLanguage } = useLanguage();
    const nav = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [dynamicAmount, setDynamicAmount] = useState('');
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [copied, setCopied] = useState('');
    const [settling, setSettling] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [staffPhone, setStaffPhone] = useState('');
    const [showStaffForm, setShowStaffForm] = useState(false);

    useEffect(() => {
        const on = () => setIsOnline(true);
        const off = () => setIsOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    const mockApiKey = `spk_live_${user?.id?.substring(0, 8) || 'demo'}...${user?.wallet_address?.slice(-6) || 'abc123'}`;

    const mockSales = [
        { id: 1, customer: '+255 712 000 111', amount: 45000, time: '14:32', status: 'completed' },
        { id: 2, customer: '+255 754 222 333', amount: 12000, time: '13:15', status: 'completed' },
        { id: 3, customer: '+255 678 444 555', amount: 8500, time: '11:40', status: 'pending' },
        { id: 4, customer: '+255 786 666 777', amount: 150000, time: '09:20', status: 'completed' },
        { id: 5, customer: '+255 713 888 999', amount: 3200, time: '08:05', status: 'completed' },
    ];
    const totalSales = mockSales.reduce((s, t) => s + t.amount, 0);

    const stats = [
        { label: t('sales') || 'Sales', value: fmt(totalSales), icon: <TrendingUp size={18} />, color: '#3b82f6' },
        { label: language === 'SW' ? 'Wateja' : 'Customers', value: `${mockSales.length}`, icon: <Users size={18} />, color: '#10b981' },
        { label: language === 'SW' ? 'Mafanikio' : 'Success', value: '99.2%', icon: <CheckCircle2 size={18} />, color: '#8b5cf6' }
    ];

    const isStaff = user?.account_type === 'merchant_staff';
    const isKycOk = user?.trust_level === 'Verified' || user?.trust_level === 'HIGH' || (user as any).kyc_status === 'Approved' || (user as any).kyc_status === 'verified';

    const copyText = (text: string, label: string) => {
        if (!isKycOk) {
            toast.error(language === 'SW' ? 'Thibitisha utambulisho kutumia API' : 'Verification required to enable API access');
            nav('/onboarding?mode=verify');
            return;
        }
        navigator.clipboard.writeText(text);
        setCopied(label);
        toast.success(t('copied'));
        setTimeout(() => setCopied(''), 2000);
    };

    const handleSettle = async () => {
        if (!isKycOk) {
            toast.error(language === 'SW' ? 'Thibitisha utambulisho kutoa fedha' : 'Identity verification required for settlements');
            nav('/onboarding?mode=verify');
            return;
        }
        setSettling(true);
        try {
            await new Promise(r => setTimeout(r, 1500)); // Simulate L2 bridge delay
            toast.success(language === 'SW' ? 'Fedha zimetumwa kwenye wallet yako!' : 'Funds settled to your blockchain wallet!');
            await refresh();
        } catch {
            toast.error(language === 'SW' ? 'Imeshindikana' : 'Settlement failed');
        } finally {
            setSettling(false);
        }
    };

    const handlePrintQR = () => {
        if (!isKycOk) {
            toast.error(language === 'SW' ? 'Thibitisha utambulisho kuchapa QR' : 'Complete KYC to print store materials');
            nav('/onboarding?mode=verify');
            return;
        }
        toast.success(language === 'SW' ? 'QR imetumwa kwa printer...' : 'QR sent to printer...');
    };

    const handleSmsLink = () => {
        if (!isKycOk) {
            toast.error(language === 'SW' ? 'Thibitisha utambulisho kutuma link' : 'Complete KYC to generate payment links');
            nav('/onboarding?mode=verify');
            return;
        }
        if (!dynamicAmount || Number(dynamicAmount) <= 0) {
            return toast.error(language === 'SW' ? 'Ingiza kiasi kwanza' : 'Enter amount first');
        }
        const link = `https://pay.safaripay.tz/m/${user?.id?.substring(0, 8)}?amount=${dynamicAmount}`;
        navigator.clipboard.writeText(link);
        toast.success(language === 'SW' ? 'Link imenakiliwa! Tuma kwa SMS/WhatsApp' : 'Payment link copied! Send via SMS/WhatsApp');
    };

    const handleInvoice = () => {
        if (!isKycOk) {
            toast.error(language === 'SW' ? 'Thibitisha utambulisho kutoa ankara' : 'Complete KYC to generate invoices');
            nav('/onboarding?mode=verify');
            return;
        }
        if (!dynamicAmount || Number(dynamicAmount) <= 0) {
            return toast.error(language === 'SW' ? 'Ingiza kiasi kwanza' : 'Enter amount first');
        }
        toast.success(language === 'SW' ? `Ankara ya ${user?.currency || 'TZS'} ${fmt(Number(dynamicAmount))} imeundwa` : `Invoice for ${user?.currency || 'TZS'} ${fmt(Number(dynamicAmount))} generated`);
    };

    const handleAddStaff = () => {
        if (!isKycOk) {
            toast.error(language === 'SW' ? 'Thibitisha utambulisho kuongeza wafanyakazi' : 'Verified merchants only can add staff');
            nav('/onboarding?mode=verify');
            return;
        }
        if (!staffPhone || staffPhone.length < 10) {
            return toast.error(language === 'SW' ? 'Namba si sahihi' : 'Enter a valid phone number');
        }
        toast.success(language === 'SW' ? `Mfanyakazi ${staffPhone} ameongezwa` : `Staff ${staffPhone} added successfully`);
        setStaffPhone('');
        setShowStaffForm(false);
    };

    const SidebarItem = ({ id, label, icon }: { id: Tab, label: string, icon: any }) => {
        if (isStaff && (id === 'staff' || id === 'keys' || id === 'settlement')) return null;
        return (
            <button
                onClick={() => setActiveTab(id)}
                style={{
                    flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 14,
                    background: activeTab === id ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.03)',
                    color: activeTab === id ? 'var(--primary)' : 'var(--text-muted)',
                    border: `1px solid ${activeTab === id ? 'rgba(59, 130, 246, 0.2)' : 'transparent'}`,
                    cursor: 'pointer', transition: '0.2s', fontWeight: 700, fontSize: 13,
                    boxShadow: activeTab === id ? '0 10px 20px rgba(0,0,0,0.2)' : 'none',
                    opacity: (!isKycOk && (id === 'settlement' || id === 'keys' || id === 'staff')) ? 0.4 : 1
                }}
            >
                {icon} {label}
            </button>
        );
    };

    return (
        <div style={{ background: '#020617', minHeight: '100vh', paddingBottom: 100 }}>
            {/* Offline Banner */}
            {!isOnline && (
                <div style={{ background: '#dc2626', color: 'white', padding: '6px 20px', fontSize: 11, fontWeight: 900, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <WifiOff size={14} /> {language === 'SW' ? 'HUNA MTANDAO — HALI YA OFFLINE' : 'NO CONNECTION — OFFLINE MODE'}
                </div>
            )}

            {/* Staff Mode Banner */}
            {isStaff && (
                <div style={{ background: 'var(--primary)', color: 'white', padding: '6px 20px', fontSize: 10, fontWeight: 900, textAlign: 'center', letterSpacing: '0.1em' }}>
                    {language === 'SW' ? 'HALI YA MFANYAKAZI (KUSOMA TU)' : 'STAFF OPERATOR MODE (READ-ONLY SETTLEMENT)'}
                </div>
            )}

            {/* Top Header */}
            <div style={{ padding: '24px 20px', background: 'rgba(15, 23, 42, 0.5)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
                <div className="row-between" style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 16, background: isStaff ? '#475569' : 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                            {isStaff ? <Users size={22} /> : <LayoutDashboard size={22} />}
                        </div>
                        <div>
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {isStaff ? t('store_operator') : t('merchant_node')}
                            </p>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {user?.name}
                                {isKycOk ? (
                                    <ShieldCheck size={16} color="#10b981" />
                                ) : (
                                    <AlertCircle size={16} color="#f59e0b" />
                                )}
                            </h2>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {/* Language Toggle */}
                        <button onClick={() => setLanguage(language === 'EN' ? 'SW' : 'EN')} style={{
                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
                            padding: '6px 12px', color: 'var(--primary)', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            <Globe2 size={14} /> {language}
                        </button>
                        {!isStaff && (
                            <button onClick={() => nav('/settings')} style={{
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: 12, padding: 8, color: 'white', cursor: 'pointer'
                            }}>
                                <Settings size={20} />
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isStaff ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div className="card-glass" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                        <p style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{user?.currency || 'TZS'} {language === 'SW' ? 'Zinaloweza Kutolewa' : 'Available'}</p>
                        <p style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>{fmt(user?.balance || 0)}</p>
                    </div>
                    {!isStaff && (
                        <div className="card-glass" style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                            <p style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{user?.currency || 'TZS'} {language === 'SW' ? 'Zilizozuiliwa' : 'Pending'}</p>
                            <p style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b' }}>{fmt(0)}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ padding: '16px 20px', overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: 10, scrollbarWidth: 'none' }}>
                    <SidebarItem id="overview" label={t('overview')} icon={<LayoutDashboard size={18} />} />
                    <SidebarItem id="transactions" label={t('sales')} icon={<ArrowUpRight size={18} />} />
                    <SidebarItem id="qr" label={t('qr_pay')} icon={<QrCode size={18} />} />
                    <SidebarItem id="settlement" label={t('settle')} icon={<Wallet size={18} />} />
                    <SidebarItem id="staff" label={t('staff')} icon={<Users size={18} />} />
                    <SidebarItem id="keys" label={t('api')} icon={<Key size={18} />} />
                </div>
            </div>

            {/* Tab Content */}
            <div style={{ padding: '0 20px' }}>

                {/* ─── OVERVIEW ─── */}
                {activeTab === 'overview' && (
                    <div className="animate-up">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
                            {stats.map(s => (
                                <div key={s.label} className="card-glass" style={{ padding: '14px', textAlign: 'center' }}>
                                    <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{s.icon}</div>
                                    <p style={{ fontSize: 14, fontWeight: 800, color: 'white', marginBottom: 2 }}>{s.value}</p>
                                    <p style={{ fontSize: 9, color: 'var(--text-dim)' }}>{s.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="card-glass" style={{ padding: '24px', marginBottom: 24, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
                            <div className="row-between" style={{ marginBottom: 20 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{t('daily_sales')}</h3>
                                <TrendBadge value="+12%" />
                            </div>
                            <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                                {[40, 70, 45, 90, 65, 80, 100].map((h, i) => (
                                    <div key={i} style={{ flex: 1, background: 'linear-gradient(180deg, var(--primary), transparent)', height: `${h}%`, borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <span key={d} style={{ fontSize: 8, color: 'var(--text-dim)', flex: 1, textAlign: 'center' }}>{d}</span>
                                ))}
                            </div>
                        </div>

                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <div className="row-between">
                                <span style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Percent size={14} /> E-Fiscal (VAT) {language === 'SW' ? 'Inakadiriwa' : 'Estimated'}:
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--white)', fontWeight: 700 }}>{fmt(Math.round(totalSales * 0.18))}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TRANSACTIONS / SALES ─── */}
                {activeTab === 'transactions' && (
                    <div className="animate-up">
                        <div className="row-between" style={{ marginBottom: 20 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{language === 'SW' ? 'Mauzo ya Leo' : "Today's Sales"}</h3>
                            <TrendBadge value={`${mockSales.length} ${language === 'SW' ? 'miamala' : 'txns'}`} />
                        </div>
                        {mockSales.map(sale => (
                            <div key={sale.id} className="card-glass" style={{ padding: '16px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 12, background: sale.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <ArrowDownLeft size={16} color={sale.status === 'completed' ? '#10b981' : '#f59e0b'} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{sale.customer}</p>
                                        <p style={{ fontSize: 10, color: 'var(--text-dim)' }}>{sale.time} · {sale.status === 'completed' ? (language === 'SW' ? 'Imekamilika' : 'Completed') : (language === 'SW' ? 'Inasubiri' : 'Pending')}</p>
                                    </div>
                                </div>
                                <p style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>+{fmt(sale.amount)}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ─── QR PAYMENTS ─── */}
                {activeTab === 'qr' && (
                    <div className="animate-up">
                        <div className="card-glass" style={{ padding: 24, textAlign: 'center', marginBottom: 20 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 8 }}>
                                {language === 'SW' ? 'QR ya Kudumu ya Duka' : 'Merchant Static QR'}
                            </h3>
                            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
                                {language === 'SW' ? 'Wateja waskan kulipa kiasi chochote' : 'Customers scan to pay any amount'}
                            </p>
                            <div style={{ width: 180, height: 180, background: 'white', margin: '0 auto', borderRadius: 16, padding: 12 }}>
                                <QrCode size={156} color="#020617" />
                            </div>
                            <button onClick={handlePrintQR} className="btn btn-blue" style={{ marginTop: 20, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <Share2 size={16} /> {t('print_qr')}
                            </button>
                        </div>

                        <div className="card-glass" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', marginBottom: 16 }}>{t('dynamic_qr')}</h3>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase' }}>
                                    {language === 'SW' ? 'INGIZA KIASI CHA MAUZO' : 'ENTER SALE AMOUNT'}
                                </label>
                                <input
                                    type="number"
                                    value={dynamicAmount}
                                    onChange={(e) => setDynamicAmount(e.target.value)}
                                    placeholder="e.g. 5,000"
                                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontWeight: 700, outline: 'none' }}
                                />
                            </div>
                            {dynamicAmount && Number(dynamicAmount) > 0 && (
                                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                    <div style={{ width: 140, height: 140, background: 'white', margin: '0 auto', borderRadius: 12, padding: 8 }}>
                                        <QrCode size={124} color="#020617" />
                                    </div>
                                    <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>{fmt(Number(dynamicAmount))}</p>
                                </div>
                            )}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <button onClick={handleSmsLink} className="btn" style={{ padding: '12px 10px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <MessageCircle size={14} /> {t('sms_link')}
                                </button>
                                <button onClick={handleInvoice} className="btn" style={{ padding: '12px 10px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    <FileText size={14} /> {t('create_invoice')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── SETTLEMENT ─── */}
                {activeTab === 'settlement' && (
                    <div className="animate-up">
                        <div className="card-glass" style={{ padding: 24, textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 28, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <Wallet size={28} />
                            </div>
                            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>
                                {language === 'SW' ? 'Malipo ya On-Chain' : 'On-Chain Settlement'}
                            </h3>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32 }}>
                                {language === 'SW' ? `Hamisha ${user?.currency || 'TZS'} moja kwa moja kwenda wallet yako ya Blockchain.` : `Move your SafariPay ${user?.currency || 'TZS'} directly to your registered Blockchain Wallet or Bank Bridge.`}
                            </p>

                            <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, textAlign: 'left', marginBottom: 32 }}>
                                <div className="row-between" style={{ marginBottom: 12 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{language === 'SW' ? 'Wallet ya Mpokeaji' : 'Recipient Wallet'}:</span>
                                    <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>0x...{user?.wallet_address?.slice(-8) || 'N/A'}</span>
                                </div>
                                <div className="row-between" style={{ marginBottom: 12 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{language === 'SW' ? 'Kiasi' : 'Amount'}:</span>
                                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>{fmt(user?.balance || 0)}</span>
                                </div>
                                <div className="row-between">
                                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{language === 'SW' ? 'Tozo' : 'Settlement Fee'}:</span>
                                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>0.00% ({language === 'SW' ? 'Bure' : 'Subsidized'})</span>
                                </div>
                            </div>

                            <button onClick={handleSettle} disabled={settling} className="btn btn-blue" style={{ width: '100%', height: 56, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                {settling ? <><Loader2 size={18} className="animate-spin" /> {language === 'SW' ? 'Inatuma...' : 'Settling...'}</> : t('settle_now')}
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── STAFF MANAGEMENT ─── */}
                {activeTab === 'staff' && (
                    <div className="animate-up">
                        <div className="card-glass" style={{ padding: 24, marginBottom: 20 }}>
                            <div className="row-between" style={{ marginBottom: 20 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{language === 'SW' ? 'Wafanyakazi (Kusoma Tu)' : 'Staff Read-Only Access'}</h3>
                                <button onClick={() => setShowStaffForm(!showStaffForm)} style={{ background: 'var(--primary)', color: 'white', padding: '6px 14px', borderRadius: 10, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                    {t('add_staff')}
                                </button>
                            </div>

                            {showStaffForm && (
                                <div style={{ marginBottom: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
                                        {language === 'SW' ? 'Namba ya Mfanyakazi' : 'Staff Phone Number'}
                                    </label>
                                    <input
                                        value={staffPhone}
                                        onChange={(e) => setStaffPhone(e.target.value)}
                                        placeholder="+255 7XX XXX XXX"
                                        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', marginBottom: 10, outline: 'none' }}
                                    />
                                    <button onClick={handleAddStaff} className="btn btn-blue" style={{ width: '100%', padding: 10, borderRadius: 10, fontSize: 13 }}>
                                        {language === 'SW' ? 'Thibitisha' : 'Confirm'}
                                    </button>
                                </div>
                            )}

                            {[
                                { name: 'Kassanda', role: language === 'SW' ? 'Kusoma Risiti Tu' : 'View Receipts Only', initial: 'K' },
                                { name: 'Amina', role: language === 'SW' ? 'Kupokea Malipo' : 'Accept Payments', initial: 'A' }
                            ].map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 18, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: 14, fontWeight: 700 }}>
                                            {s.initial}
                                        </div>
                                        <div>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{s.name} ({language === 'SW' ? 'Cashier' : 'Cashier'})</p>
                                            <p style={{ fontSize: 10, color: '#10b981' }}>{s.role}</p>
                                        </div>
                                    </div>
                                    <MoreVertical size={16} color="var(--text-dim)" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── API KEYS ─── */}
                {activeTab === 'keys' && (
                    <div className="animate-up">
                        <div className="card-glass" style={{ padding: 24 }}>
                            <div className="row-between" style={{ marginBottom: 20 }}>
                                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>{language === 'SW' ? 'Funguo za API' : 'API Keys'}</h3>
                                <button onClick={() => { toast.success(language === 'SW' ? 'Funguo mpya imeundwa' : 'New key generated'); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '6px 12px', color: 'var(--primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <RefreshCw size={12} /> {language === 'SW' ? 'Tengeneza Upya' : 'Regenerate'}
                                </button>
                            </div>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase' }}>
                                    {language === 'SW' ? 'Funguo ya Moja kwa Moja' : 'Live Secret Key'}
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 16px' }}>
                                    <span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {showKey ? mockApiKey : '••••••••••••••••••••••••'}
                                    </span>
                                    <button onClick={() => setShowKey(!showKey)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                        {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                    <button onClick={() => copyText(mockApiKey, 'key')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
                                        {copied === 'key' ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: 14, padding: '14px 16px' }}>
                                <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                                    {language === 'SW'
                                        ? 'Tumia funguo hii kuunganisha mfumo wako na SafariPay API. Usisambaze funguo hii hadharani.'
                                        : 'Use this key to integrate your system with the SafariPay API. Keep this key private and never expose it publicly.'}
                                </p>
                            </div>

                            <div style={{ marginTop: 20, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 16, fontSize: 11, color: '#64748b', lineHeight: 1.8 }}>
                                <span style={{ color: '#10b981' }}>POST</span> <span style={{ color: '#93c5fd' }}>https://api.safaripay.tz/v1/charge</span>{'\n'}
                                <span style={{ color: '#f59e0b' }}>Authorization:</span> Bearer {showKey ? mockApiKey.substring(0, 20) + '...' : '••••••'}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function TrendBadge({ value }: { value: string }) {
    return (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 700 }}>
            {value}
        </div>
    );
}

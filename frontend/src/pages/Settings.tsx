import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import {
    ArrowLeft,
    Shield,
    Bell,
    Smartphone,
    Info,
    ChevronRight,
    Eye,
    EyeOff,
    Lock,
    LogOut,
    Languages,
    Wallet,
    Copy,
    Check,
    Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
    const { user, logout, registerBiometric } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const nav = useNavigate();
    const [privacy, setPrivacy] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [busy, setBusy] = useState(false);

    const toggleBiometric = async () => {
        if (!biometricEnabled) {
            setBusy(true);
            try {
                await registerBiometric();
                setBiometricEnabled(true);
                toast.success('FaceID / Fingerprint enabled!');
            } catch (e: any) {
                toast.error(e.message || 'Biometric registration failed. Ensure your device supports it.');
            } finally {
                setBusy(false);
            }
        } else {
            setBiometricEnabled(false);
            toast('Biometric login disabled locally.');
        }
    };

    const handleLogout = () => {
        logout();
        toast.success(t('sign_out'));
        nav('/login');
    };

    const copyText = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        toast.success('Copied!');
        setTimeout(() => setCopied(null), 2000);
    };

    const sections = [
        {
            title: t('security'),
            items: [
                { icon: Lock, label: t('change_pin'), sub: 'Update your security PIN', action: () => toast('Coming soon in v2.0') },
                {
                    icon: privacy ? EyeOff : Eye,
                    label: t('privacy_mode'),
                    sub: 'Hide sensitive data',
                    type: 'toggle',
                    val: privacy,
                    action: () => setPrivacy(!privacy)
                },
                {
                    icon: Smartphone,
                    label: 'Biometric Login',
                    sub: 'Fingerprint / FaceID',
                    type: 'toggle',
                    val: biometricEnabled,
                    action: toggleBiometric,
                    loading: busy
                }
            ]
        },
        {
            title: t('notifications'),
            items: [
                { icon: Bell, label: t('push_notifications'), sub: 'Alerts for payments', type: 'toggle', val: true, action: () => { } },
                { icon: Smartphone, label: t('email_alerts'), sub: 'Weekly summaries', type: 'toggle', val: false, action: () => { } }
            ]
        },
        {
            title: t('app_info'),
            items: [
                { icon: Info, label: t('version'), sub: '1.2.0 (Biometric Build)', action: () => { } },
                { icon: Languages, label: 'Language / Lugha', sub: language === 'EN' ? 'English' : 'Kiswahili', action: () => setLanguage(language === 'EN' ? 'SW' : 'EN') }
            ]
        }
    ];

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
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>{t('settings')}</h1>
            </div>

            {/* Profile Card */}
            <div className="card-glow animate-up" style={{ marginBottom: 32, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: 18,
                        background: 'linear-gradient(135deg, var(--primary), var(--success))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 700, color: 'white'
                    }}>
                        {user?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>{user?.name}</p>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.phone}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {user?.email && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>EMAIL</span>
                            <span style={{ fontSize: 13, color: 'var(--white)', fontWeight: 500 }}>{user.email}</span>
                        </div>
                    )}
                    {user?.nida_number && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>NIDA</span>
                            <span style={{ fontSize: 13, color: 'var(--white)', fontWeight: 500 }}>{user.nida_number}</span>
                        </div>
                    )}
                    {user?.wallet_address && (
                        <div style={{ padding: '12px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>POLYGON WALLET</span>
                                <button onClick={() => copyText(user.wallet_address || '', 'wallet')}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 4 }}>
                                    {copied === 'wallet' ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                            <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--primary)', marginTop: 6, wordBreak: 'break-all' }}>
                                {user.wallet_address}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {sections.map((sec, idx) => (
                    <div key={idx} className="animate-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: 8 }}>
                            {sec.title}
                        </p>
                        <div className="card" style={{ padding: 8 }}>
                            {sec.items.map((item, i) => (
                                <div key={i} onClick={(item as any).loading ? undefined : item.action}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 16, width: '100%', padding: '16px',
                                        background: 'none', border: 'none', borderRadius: 16, color: 'var(--white)',
                                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                                        borderBottom: i < sec.items.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                        opacity: (item as any).loading ? 0.6 : 1
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>

                                    <div style={{
                                        width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.04)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)'
                                    }}>
                                        <item.icon size={20} />
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontSize: 15, fontWeight: 600 }}>{item.label}</p>
                                        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{item.sub}</p>
                                    </div>

                                    {(item as any).loading ? (
                                        <Loader2 size={20} className="animate-spin" color="var(--primary)" />
                                    ) : item.type === 'toggle' ? (
                                        <div style={{
                                            width: 44, height: 24, borderRadius: 12, background: item.val ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                            position: 'relative', transition: 'all 0.3s'
                                        }}>
                                            <div style={{
                                                width: 18, height: 18, borderRadius: 9, background: 'white', position: 'absolute',
                                                top: 3, left: item.val ? 23 : 3, transition: 'all 0.3s'
                                            }} />
                                        </div>
                                    ) : (
                                        <ChevronRight size={18} color="var(--text-dim)" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <button className="btn btn-secondary animate-up" onClick={handleLogout}
                    style={{
                        color: '#fca5a5', borderColor: 'rgba(239,68,68,0.2)', padding: '20px',
                        marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12
                    }}>
                    <LogOut size={20} /> {t('sign_out')}
                </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-dim)', marginTop: 40 }}>
                SafariPay Alpha Release · Tanzania 2026
            </p>
        </div>
    );
}

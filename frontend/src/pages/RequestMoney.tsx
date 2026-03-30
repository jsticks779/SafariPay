import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import {
    ArrowLeft,
    Copy,
    Share2,
    CheckCircle2,
    Clock,
    Wallet,
    Smartphone,
    Globe,
    Zap,
    Link2,
    QrCode,
    ChevronDown,
    Hexagon,
    ExternalLink,
    Banknote,
    Download,
} from 'lucide-react';
import { queueOfflineTransaction } from '../lib/offlineQueue';

type Tab = 'usdt' | 'local';
type ViewMode = 'link' | 'qr';

export default function RequestMoney() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const nav = useNavigate();

    const [tab, setTab] = useState<Tab>('usdt');
    const [amount, setAmount] = useState('');
    const [localAmount, setLocalAmount] = useState('');
    const [desc, setDesc] = useState('');
    const [expiry, setExpiry] = useState('');
    const [loading, setLoading] = useState(false);
    const [generatedLink, setGeneratedLink] = useState('');
    const [polygonLink, setPolygonLink] = useState('');
    const [copied, setCopied] = useState(false);
    const [fxRate, setFxRate] = useState(2500.00);
    const [viewMode, setViewMode] = useState<ViewMode>('qr');
    const [requestId, setRequestId] = useState('');

    // Fetch FX rate when switching to local tab
    useEffect(() => {
        if (tab === 'local') {
            const fetchRate = async () => {
                try {
                    const toCurrency = user?.currency || 'TZS';
                    const { data } = await api.get(`/transfer/fx-rates?from=USDT&to=${toCurrency}`);
                    if (data.rate) setFxRate(data.rate);
                } catch (e) { console.error('FX fetch failed', e); }
            };
            fetchRate();
        }
    }, [tab]);

    // USDT <-> Local sync
    useEffect(() => {
        if (tab === 'local' && localAmount) {
            setAmount((Number(localAmount) / fxRate).toFixed(2));
        }
    }, [localAmount, fxRate]);

    useEffect(() => {
        if (tab === 'usdt' && amount) {
            setLocalAmount((Number(amount) * fxRate).toFixed(0));
        }
    }, [amount, fxRate]);


    const generateRequest = async () => {
        const usdtVal = parseFloat(amount);
        if (!usdtVal || usdtVal <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                amount_usdt: usdtVal,
                amount_local: tab === 'local' ? parseFloat(localAmount) : Math.round(usdtVal * fxRate),
                local_currency: tab === 'local' ? (user?.currency || 'TZS') : 'USDT',
                description: desc || null,
                expires_at: expiry ? new Date(expiry).toISOString() : null
            };

            const url = '/transfer/request';
            if (!navigator.onLine) {
                queueOfflineTransaction(url, payload);
                const offlineId = `OFFLINE_${Math.random().toString(36).substring(7)}`;
                const link = `${window.location.origin}/pay/${offlineId}`;
                setGeneratedLink(link);
                toast.success('📡 Offline: Payment request queued!');
                return;
            }

            const { data } = await api.post(url, payload);
            const rId = data?.data?.id || data?.id;
            if (!rId) throw new Error('Invalid response from server');

            setRequestId(rId);

            // Generate the payment link with Polygon Amoy metadata
            const payLink = `${window.location.origin}/pay/${rId}`;
            setGeneratedLink(payLink);

            // Build Polygon-specific deep link for wallets
            const walletAddr = user?.wallet_address || '0x0000000000000000000000000000000000000000';
            const polygonPayLink = `safaripay.app/pay?to=${walletAddr}&amount=${usdtVal}&token=USDT&network=amoy`;
            setPolygonLink(polygonPayLink);

            toast.success('Payment request created on Polygon Amoy!');
        } catch (e: any) {
            toast.error(e.response?.data?.error || e.message || 'Failed to generate link');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text?: string) => {
        navigator.clipboard.writeText(text || generatedLink);
        setCopied(true);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
    };

    const shareLink = () => {
        if (navigator.share) {
            navigator.share({
                title: 'SafariPay Payment Request',
                text: `Pay me ${amount} USDT on Polygon Amoy via SafariPay${desc ? `: ${desc}` : ''}`,
                url: generatedLink
            }).catch(() => copyToClipboard());
        } else {
            copyToClipboard();
        }
    };

    const downloadQR = () => {
        const svg = document.getElementById('payment-qr-code');
        if (!svg) return;
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            canvas.width = 512;
            canvas.height = 512;
            if (ctx) {
                ctx.fillStyle = '#0c1222';
                ctx.fillRect(0, 0, 512, 512);
                ctx.drawImage(img, 0, 0, 512, 512);
            }
            const a = document.createElement('a');
            a.download = `safaripay-request-${requestId.slice(0, 8)}.png`;
            a.href = canvas.toDataURL('image/png');
            a.click();
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    };

    // Shared input style
    const inputStyle: React.CSSProperties = {
        width: '100%',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        padding: '16px 18px',
        color: '#ffffff',
        fontSize: 15,
        fontFamily: 'var(--font)',
        outline: 'none',
        transition: 'all 0.2s',
    };

    const localEquivalent = amount ? (Number(amount) * fxRate).toLocaleString() : '0';

    return (
        <div style={{ padding: '24px 20px', paddingBottom: 120 }} className="animate-fade">
            {/* Header */}
            <div className="row-between" style={{ marginBottom: 32 }}>
                <button onClick={() => nav(-1)} style={{ background: 'var(--glass)', border: '1px solid var(--glass-border-hi)', borderRadius: 14, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', cursor: 'pointer' }}>
                    <ArrowLeft size={20} />
                </button>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: 0 }}>
                    {t('request_payment') || 'Request Payment'}
                </h1>
                <div style={{ width: 44 }} />
            </div>

            {/* ━━━ SUCCESS: Show Generated QR + Link ━━━ */}
            {generatedLink ? (
                <div className="animate-up" style={{ textAlign: 'center' }}>
                    {/* Network Badge */}
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '8px 18px', borderRadius: 40,
                        background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(59, 130, 246, 0.08))',
                        border: '1px solid rgba(124, 58, 237, 0.2)',
                        marginBottom: 24,
                    }}>
                        <Hexagon size={14} color="#7c3aed" />
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#a78bfa', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Polygon Amoy Testnet
                        </span>
                        <span style={{
                            fontSize: 9, fontWeight: 700, color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: 6,
                        }}>LIVE</span>
                    </div>

                    {/* Amount Display */}
                    <div className="card-glow" style={{ padding: '28px 24px', marginBottom: 20, borderRadius: 28 }}>
                        <p style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Requesting</p>
                        <h2 style={{ fontSize: 42, fontWeight: 800, color: 'white', fontFamily: 'var(--font-display)', lineHeight: 1, marginBottom: 6 }}>
                            {amount} <span style={{ fontSize: 16, color: '#3b82f6' }}>USDT</span>
                        </h2>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 0 }}>
                            ≈ {localEquivalent} {user?.currency || 'TZS'}
                        </p>
                    </div>

                    {/* View Mode Toggle */}
                    <div style={{
                        display: 'flex', gap: 4, padding: 4, borderRadius: 16,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                        marginBottom: 20,
                    }}>
                        <button
                            onClick={() => setViewMode('qr')}
                            style={{
                                flex: 1, height: 40, borderRadius: 12, border: 'none',
                                background: viewMode === 'qr' ? 'rgba(59,130,246,0.15)' : 'transparent',
                                color: viewMode === 'qr' ? '#60a5fa' : 'var(--text-dim)',
                                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                transition: 'all 0.2s',
                            }}
                        >
                            <QrCode size={15} /> QR Code
                        </button>
                        <button
                            onClick={() => setViewMode('link')}
                            style={{
                                flex: 1, height: 40, borderRadius: 12, border: 'none',
                                background: viewMode === 'link' ? 'rgba(59,130,246,0.15)' : 'transparent',
                                color: viewMode === 'link' ? '#60a5fa' : 'var(--text-dim)',
                                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                transition: 'all 0.2s',
                            }}
                        >
                            <Link2 size={15} /> Payment Link
                        </button>
                    </div>

                    {/* QR Code View */}
                    {viewMode === 'qr' && (
                        <div className="animate-fade" style={{ marginBottom: 24 }}>
                            <div style={{
                                background: 'white',
                                borderRadius: 28,
                                padding: 28,
                                display: 'inline-block',
                                boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(59,130,246,0.08)',
                                position: 'relative',
                            }}>
                                <QRCodeSVG
                                    id="payment-qr-code"
                                    value={generatedLink}
                                    size={220}
                                    level="H"
                                    bgColor="#ffffff"
                                    fgColor="#0c1222"
                                    imageSettings={{
                                        src: '',
                                        height: 0,
                                        width: 0,
                                        excavate: false,
                                    }}
                                />
                                {/* Polygon Logo Overlay */}
                                <div style={{
                                    position: 'absolute', top: '50%', left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 40, height: 40, borderRadius: 10,
                                    background: '#7c3aed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                }}>
                                    <Hexagon size={22} color="white" fill="white" />
                                </div>
                            </div>

                            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 16, marginBottom: 8 }}>
                                Scan with any phone to pay
                            </p>

                            <button
                                onClick={downloadQR}
                                style={{
                                    background: 'none', border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 12, padding: '8px 16px', color: 'var(--text-muted)',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                }}
                            >
                                <Download size={13} /> Save QR Image
                            </button>
                        </div>
                    )}

                    {/* Link View */}
                    {viewMode === 'link' && (
                        <div className="animate-fade" style={{ marginBottom: 24 }}>
                            {/* SafariPay Payment Link */}
                            <div style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 20, padding: '14px 16px',
                                marginBottom: 12,
                            }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'left' }}>
                                    Payment URL
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Link2 size={16} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                                    <p style={{
                                        fontSize: 12, color: 'var(--text-muted)', textAlign: 'left',
                                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
                                        fontFamily: 'monospace',
                                    }}>{generatedLink}</p>
                                    <button onClick={() => copyToClipboard()} style={{
                                        background: copied ? '#10b981' : '#3b82f6',
                                        border: 'none', borderRadius: 10, padding: '6px 12px',
                                        color: 'white', cursor: 'pointer', display: 'flex',
                                        alignItems: 'center', gap: 4, transition: 'all 0.2s', flexShrink: 0,
                                    }}>
                                        <Copy size={12} />
                                        <span style={{ fontSize: 11, fontWeight: 700 }}>{copied ? '✓' : 'Copy'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Polygon Deep Link */}
                            <div style={{
                                background: 'rgba(124, 58, 237, 0.04)',
                                border: '1px solid rgba(124, 58, 237, 0.1)',
                                borderRadius: 20, padding: '14px 16px',
                            }}>
                                <p style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'left' }}>
                                    <Hexagon size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                    Polygon Amoy Network
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <p style={{
                                        fontSize: 11, color: '#a78bfa', textAlign: 'left',
                                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
                                        fontFamily: 'monospace',
                                    }}>{polygonLink}</p>
                                    <button onClick={() => copyToClipboard(polygonLink)} style={{
                                        background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)',
                                        borderRadius: 10, padding: '6px 12px', color: '#a78bfa',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                                    }}>
                                        <Copy size={12} />
                                        <span style={{ fontSize: 11, fontWeight: 700 }}>Copy</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <button onClick={shareLink} className="btn btn-blue" style={{ height: 60, borderRadius: 20, fontSize: 16, marginBottom: 12 }}>
                        <Share2 size={20} />
                        Share Payment Request
                    </button>

                    <button onClick={() => { setGeneratedLink(''); setPolygonLink(''); setAmount(''); setLocalAmount(''); setDesc(''); setExpiry(''); setRequestId(''); }} style={{
                        marginTop: 8, background: 'none', border: 'none', color: 'var(--text-muted)',
                        fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '12px 0',
                    }}>
                        + Create Another Request
                    </button>
                </div>
            ) : (
                <>
                    {/* ━━━ FORM ━━━ */}
                    {/* Currency Mode Toggle */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 4, display: 'flex', marginBottom: 28 }}>
                        <button
                            onClick={() => setTab('usdt')}
                            style={{
                                flex: 1, height: 48, borderRadius: 16,
                                background: tab === 'usdt' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'transparent',
                                border: 'none', color: 'white', fontWeight: 700, fontSize: 14,
                                transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
                                boxShadow: tab === 'usdt' ? '0 4px 15px rgba(59,130,246,0.3)' : 'none'
                            }}
                        >
                            <Wallet size={17} />
                            USDT (Polygon)
                        </button>
                        <button
                            onClick={() => setTab('local')}
                            style={{
                                flex: 1, height: 48, borderRadius: 16,
                                background: tab === 'local' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                                border: 'none', color: 'white', fontWeight: 700, fontSize: 14,
                                transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
                                boxShadow: tab === 'local' ? '0 4px 15px rgba(16,185,129,0.3)' : 'none'
                            }}
                        >
                            <Banknote size={17} />
                            {user?.currency || 'TZS'}
                        </button>
                    </div>

                    {/* Polygon Network Badge */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', borderRadius: 16,
                        background: 'rgba(124, 58, 237, 0.04)',
                        border: '1px solid rgba(124, 58, 237, 0.1)',
                        marginBottom: 20,
                    }}>
                        <Hexagon size={18} color="#7c3aed" />
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa', margin: 0 }}>Polygon Amoy Testnet</p>
                            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>Chain ID: 80002 • Token: USDT (ERC-20)</p>
                        </div>
                        <div style={{
                            marginLeft: 'auto',
                            width: 8, height: 8, borderRadius: '50%',
                            background: '#10b981',
                            boxShadow: '0 0 8px rgba(16,185,129,0.5)',
                        }} />
                    </div>

                    {/* Main Form Card */}
                    <div className="card-glow animate-up" style={{ padding: 28, borderRadius: 28 }}>

                        {/* ── Amount Input ── */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                            Amount to Receive
                        </label>
                        <div style={{ position: 'relative', marginBottom: 20 }}>
                            <input
                                type="number"
                                inputMode="decimal"
                                value={tab === 'usdt' ? amount : localAmount}
                                onChange={(e) => tab === 'usdt' ? setAmount(e.target.value) : setLocalAmount(e.target.value)}
                                placeholder="0.00"
                                style={{
                                    ...inputStyle,
                                    paddingRight: 100,
                                    fontSize: 28,
                                    fontWeight: 800,
                                    fontFamily: 'var(--font-display)',
                                    height: 72,
                                    borderRadius: 20,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                }}
                            />
                            <span style={{
                                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                                color: tab === 'usdt' ? '#3b82f6' : '#10b981', fontWeight: 800, fontSize: 14,
                                background: tab === 'usdt' ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                                padding: '6px 14px', borderRadius: 10
                            }}>
                                {tab === 'usdt' ? 'USDT' : user?.currency || 'TZS'}
                            </span>
                        </div>

                        {/* FX Conversion Banner */}
                        <div style={{
                            marginBottom: 24, padding: '14px 18px',
                            background: tab === 'usdt' ? 'rgba(59, 130, 246, 0.04)' : 'rgba(16, 185, 129, 0.06)',
                            borderRadius: 16,
                            border: tab === 'usdt' ? '1px solid rgba(59, 130, 246, 0.1)' : '1px solid rgba(16, 185, 129, 0.12)',
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <Zap size={16} color={tab === 'usdt' ? '#3b82f6' : '#10b981'} />
                            {tab === 'usdt' ? (
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    Payer sees ≈ <b style={{ color: 'white' }}>{localEquivalent} {user?.currency || 'TZS'}</b>
                                </span>
                            ) : (
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                    On-chain: ≈ <b style={{ color: 'white' }}>{amount || '0.00'} USDT</b>
                                </span>
                            )}
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>
                                1 USDT = {fxRate.toLocaleString()} {user?.currency || 'TZS'}
                            </span>
                        </div>

                        {/* ── Note / Description ── */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                            Note / Reference
                        </label>
                        <input
                            type="text"
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            placeholder="e.g. Freelance payment, invoice #1234"
                            style={{ ...inputStyle, marginBottom: 24 }}
                            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                        />

                        {/* ── Expiration Date ── */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 10 }}>
                            <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            Expires At (Optional)
                        </label>
                        <input
                            type="datetime-local"
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                            style={{
                                ...inputStyle,
                                marginBottom: 32,
                                colorScheme: 'dark',
                            }}
                            onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                            onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
                        />

                        {/* ── Generate Button ── */}
                        <button
                            onClick={generateRequest}
                            disabled={loading || !amount || parseFloat(amount) <= 0}
                            style={{
                                width: '100%', height: 64,
                                background: (loading || !amount || parseFloat(amount) <= 0)
                                    ? 'rgba(255,255,255,0.05)'
                                    : 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                                border: 'none', borderRadius: 20,
                                color: 'white', fontWeight: 700, fontSize: 17, fontFamily: 'var(--font)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                cursor: (loading || !amount) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s',
                                boxShadow: (loading || !amount || parseFloat(amount) <= 0) ? 'none' : '0 8px 30px rgba(124,58,237,0.3)',
                                opacity: (loading || !amount || parseFloat(amount) <= 0) ? 0.5 : 1,
                            }}
                        >
                            {loading ? (
                                <div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            ) : (
                                <>
                                    <QrCode size={20} />
                                    Generate QR & Payment Link
                                </>
                            )}
                        </button>
                    </div>

                    {/* How it works */}
                    <div style={{ marginTop: 28, padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.04)' }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                            How it works
                        </p>
                        {[
                            { icon: QrCode, text: 'A QR code and payment link are generated on Polygon Amoy', color: '#7c3aed' },
                            { icon: Smartphone, text: 'Payer scans the QR or opens the link on their device', color: '#3b82f6' },
                            { icon: Zap, text: 'Gas check + USDT balance verified automatically', color: '#f59e0b' },
                            { icon: CheckCircle2, text: 'One-tap payment broadcasts to Polygon network', color: '#10b981' },
                        ].map((step, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < 3 ? 14 : 0 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 12,
                                    background: `${step.color}10`, border: `1px solid ${step.color}20`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    <step.icon size={16} color={step.color} />
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{step.text}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api, { fmt } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import toast from 'react-hot-toast';
import {
    ShieldCheck,
    ArrowRight,
    Wallet,
    Clock,
    AlertCircle,
    Smartphone,
    CheckCircle2,
    Loader2,
    Hexagon,
    Fuel,
    AlertTriangle,
    ExternalLink,
    Zap,
    Banknote,
    Globe,
} from 'lucide-react';

interface GasInfo {
    checking: boolean;
    hasSufficientGas: boolean;
    maticBalance: string;
    estimatedGasCost: string;
    error?: string;
}

export default function PaymentSummary() {
    const { id } = useParams();
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useLanguage();
    const nav = useNavigate();

    const [request, setRequest] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [paying, setPaying] = useState(false);
    const [paid, setPaid] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [pin, setPin] = useState('');
    const [showPin, setShowPin] = useState(false);
    const [gasInfo, setGasInfo] = useState<GasInfo>({
        checking: true,
        hasSufficientGas: false,
        maticBalance: '0',
        estimatedGasCost: '0.001',
    });

    // Mock exchange rate (USDT → TZS)
    const FX_RATE = 2500;

    useEffect(() => {
        const fetchRequest = async () => {
            if (id) {
                try {
                    const { data } = await api.get(`/transfer/request/${id}`);
                    setRequest(data.data || data);
                } catch (e: any) {
                    setError(e.response?.data?.error || 'Payment request not found');
                } finally {
                    setLoading(false);
                }
            } else {
                // Handle Decentralized parameters directly from URL query
                const params = new URLSearchParams(location.search);
                const to = params.get('to');
                const amt = params.get('amount');
                const token = params.get('token');
                if (to && amt) {
                    setRequest({
                        id: null,
                        requester_wallet: to,
                        requester_name: `${to.slice(0, 6)}...${to.slice(-4)}`,
                        amount_usdt: parseFloat(amt),
                        amount_local: parseFloat(amt) * FX_RATE,
                        local_currency: user?.currency || 'TZS',
                        token: token || 'USDT',
                    });
                } else {
                    setError('Invalid decentralized payment link parameters');
                }
                setLoading(false);
            }
        };
        fetchRequest();
    }, [id, location.search, user?.currency]);

    // Check gas balance when request loads and user is logged in
    useEffect(() => {
        if (!request || !user) {
            setGasInfo(prev => ({ ...prev, checking: false }));
            return;
        }
        checkGasBalance();
    }, [request, user]);

    const checkGasBalance = async () => {
        setGasInfo(prev => ({ ...prev, checking: true }));
        try {
            // Call backend to check MATIC balance for gas
            const { data } = await api.get('/system/blockchain-health');
            if (data.status === 'connected') {
                // Simulate gas check — in production, query the user's wallet MATIC balance
                const mockMaticBalance = (Math.random() * 0.5 + 0.01).toFixed(4);
                const estimatedGas = '0.0015';
                const hasSufficient = parseFloat(mockMaticBalance) >= parseFloat(estimatedGas);

                setGasInfo({
                    checking: false,
                    hasSufficientGas: hasSufficient,
                    maticBalance: mockMaticBalance,
                    estimatedGasCost: estimatedGas,
                });
            } else {
                setGasInfo({
                    checking: false,
                    hasSufficientGas: false,
                    maticBalance: '0',
                    estimatedGasCost: '0.001',
                    error: 'Polygon network unavailable',
                });
            }
        } catch (e: any) {
            setGasInfo({
                checking: false,
                hasSufficientGas: true, // Assume OK if offline
                maticBalance: '—',
                estimatedGasCost: '—',
                error: e.message,
            });
        }
    };

    const handlePay = async () => {
        if (!user) {
            toast.error('Please log in to make a payment');
            nav('/login');
            return;
        }

        if (!pin || pin.length < 4) {
            setShowPin(true);
            return;
        }

        setPaying(true);
        try {
            // Execute the payment via the transfer endpoint
            const { data } = await api.post('/transactions/transfer', {
                recipient_wallet: request.requester_wallet,
                amount: Math.round(request.amount_usdt * FX_RATE), // Convert USDT → TZS for internal ledger
                user_pin: pin,
                description: `Payment for request: ${request.description || `#${id?.slice(0, 8)}`}`,
            });

            setTxHash(data.tx_hash || data.transaction?.tx_hash || '');
            setPaid(true);

            // Mark the request as paid on the backend (only if it's a DB request)
            if (id) {
                try {
                    await api.post(`/transfer/request/${id}/pay`, {
                        payer_id: user.id,
                        tx_hash: data.tx_hash,
                    });
                } catch (e) {
                    // Non-critical — the payment still went through
                    console.warn('Failed to mark request as paid:', e);
                }
            }

            toast.success('Payment confirmed on Polygon Amoy! 🎉');
        } catch (e: any) {
            toast.error(e.response?.data?.error || e.message || 'Payment failed');
            if (e.response?.status === 403) setPin('');
        } finally {
            setPaying(false);
        }
    };

    // ─── Loading State ──────────────────────────────────────────────
    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ textAlign: 'center' }}>
                <Loader2 size={40} color="var(--primary)" style={{ animation: 'spin 1.5s linear infinite', marginBottom: 16 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading payment request...</p>
            </div>
        </div>
    );

    // ─── Error State ────────────────────────────────────────────────
    if (error || !request) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }} className="animate-fade">
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', marginBottom: 24 }}>
                <AlertCircle size={40} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 12 }}>Request Not Found</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6, maxWidth: 300 }}>{error || 'This payment link may have expired or been cancelled.'}</p>
            <button onClick={() => nav('/')} className="btn btn-secondary" style={{ width: 'auto', padding: '14px 32px', borderRadius: 16 }}>
                Return Home
            </button>
        </div>
    );

    // ─── Payment Complete ───────────────────────────────────────────
    if (paid) return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center' }} className="animate-fade">
            <div style={{
                width: 100, height: 100, borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#10b981', marginBottom: 32,
                boxShadow: '0 0 60px rgba(16, 185, 129, 0.15)',
            }}>
                <CheckCircle2 size={50} />
            </div>

            <h2 style={{ fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 8 }}>Payment Confirmed!</h2>
            <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.6 }}>
                {request.amount_usdt} USDT sent to <b style={{ color: 'white' }}>{request.requester_name}</b>
            </p>

            {/* Network Badge */}
            <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20,
                background: 'rgba(124, 58, 237, 0.08)',
                border: '1px solid rgba(124, 58, 237, 0.15)',
                marginBottom: 28,
            }}>
                <Hexagon size={12} color="#7c3aed" />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa' }}>Polygon Amoy Testnet</span>
            </div>

            {/* Transaction Hash */}
            {txHash && (
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20, padding: '16px 20px',
                    marginBottom: 28, maxWidth: 380, width: '100%',
                }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Transaction Hash</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <p style={{
                            fontSize: 11, fontFamily: 'monospace', color: '#60a5fa',
                            wordBreak: 'break-all', margin: 0, flex: 1,
                        }}>{txHash}</p>
                        <a
                            href={`https://amoy.polygonscan.com/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                                borderRadius: 10, padding: '6px 10px', color: '#60a5fa',
                                display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
                                fontWeight: 700, textDecoration: 'none', flexShrink: 0,
                            }}
                        >
                            <ExternalLink size={12} /> View
                        </a>
                    </div>
                </div>
            )}

            <button onClick={() => nav('/')} className="btn btn-blue" style={{ maxWidth: 300, height: 56, borderRadius: 20 }}>
                Go to Dashboard
            </button>
        </div>
    );

    // ─── Main Payment View ──────────────────────────────────────────
    const isExpired = request.expires_at && new Date(request.expires_at) < new Date();
    const tzsAmount = Math.round(request.amount_usdt * FX_RATE);
    const fee = Math.round(tzsAmount * 0.005);
    const totalTZS = tzsAmount + fee;

    return (
        <div style={{ padding: '40px 24px', paddingBottom: 120, maxWidth: 480, margin: '0 auto' }} className="animate-fade">
            {/* Header Badge */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{
                    width: 64, height: 64, borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.1), rgba(59,130,246,0.08))',
                    border: '1px solid rgba(124, 58, 237, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#7c3aed', margin: '0 auto 20px'
                }}>
                    <Hexagon size={32} />
                </div>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 20,
                    background: 'rgba(124, 58, 237, 0.06)',
                    border: '1px solid rgba(124, 58, 237, 0.1)',
                    marginBottom: 16,
                }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Polygon Amoy • SafariPay
                    </span>
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', margin: 0 }}>
                    Pay {request.requester_name}
                </h1>
            </div>

            {/* Amount Card */}
            <div className="card-glow animate-up" style={{ padding: 32, textAlign: 'center', marginBottom: 20, borderRadius: 28 }}>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</p>
                <h2 style={{ fontSize: 44, fontWeight: 800, color: 'white', marginBottom: 4, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                    {request.amount_usdt}
                    <span style={{ fontSize: 18, color: '#3b82f6', marginLeft: 10, verticalAlign: 'middle' }}>USDT</span>
                </h2>
                <p style={{ fontSize: 18, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 0 }}>
                    ≈ {tzsAmount.toLocaleString()} {user?.currency || 'TZS'}
                </p>
            </div>

            {/* Gas & Network Status */}
            <div className="animate-up" style={{ marginBottom: 20 }}>
                <div style={{
                    background: gasInfo.checking ? 'rgba(255,255,255,0.03)'
                        : gasInfo.hasSufficientGas ? 'rgba(16, 185, 129, 0.04)'
                            : 'rgba(245, 158, 11, 0.06)',
                    border: gasInfo.checking ? '1px solid rgba(255,255,255,0.06)'
                        : gasInfo.hasSufficientGas ? '1px solid rgba(16, 185, 129, 0.1)'
                            : '1px solid rgba(245, 158, 11, 0.15)',
                    borderRadius: 20, padding: '16px 20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {gasInfo.checking ? (
                            <Loader2 size={18} color="var(--text-dim)" style={{ animation: 'spin 1.5s linear infinite' }} />
                        ) : gasInfo.hasSufficientGas ? (
                            <div style={{
                                width: 32, height: 32, borderRadius: 10,
                                background: 'rgba(16, 185, 129, 0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Fuel size={16} color="#10b981" />
                            </div>
                        ) : (
                            <div style={{
                                width: 32, height: 32, borderRadius: 10,
                                background: 'rgba(245, 158, 11, 0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <AlertTriangle size={16} color="#f59e0b" />
                            </div>
                        )}

                        <div style={{ flex: 1 }}>
                            <p style={{
                                fontSize: 13, fontWeight: 700, margin: 0,
                                color: gasInfo.checking ? 'var(--text-muted)' : gasInfo.hasSufficientGas ? '#10b981' : '#f59e0b',
                            }}>
                                {gasInfo.checking ? 'Checking gas...'
                                    : gasInfo.hasSufficientGas ? 'Gas: Ready ✓'
                                        : 'Low MATIC for gas fees'}
                            </p>
                            {!gasInfo.checking && (
                                <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
                                    Balance: {gasInfo.maticBalance} MATIC • Est. gas: {gasInfo.estimatedGasCost} MATIC
                                </p>
                            )}
                        </div>
                    </div>

                    {!gasInfo.checking && !gasInfo.hasSufficientGas && (
                        <div style={{
                            marginTop: 12, padding: '10px 14px',
                            background: 'rgba(245, 158, 11, 0.06)',
                            borderRadius: 12, fontSize: 12, color: '#fbbf24', lineHeight: 1.5,
                        }}>
                            💡 Get free test MATIC from the <a
                                href="https://faucet.polygon.technology/"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#60a5fa', fontWeight: 700 }}
                            >Polygon Amoy Faucet</a>
                        </div>
                    )}
                </div>
            </div>

            {/* Fee Breakdown */}
            <div className="animate-up" style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 20, padding: '18px 20px',
                marginBottom: 20,
            }}>
                {[
                    { label: 'Amount', value: `${tzsAmount.toLocaleString()} ${user?.currency || 'TZS'}`, bold: false },
                    { label: 'Network Fee (0.5%)', value: `${fee.toLocaleString()} ${user?.currency || 'TZS'}`, bold: false },
                    { label: 'Network', value: 'Polygon Amoy', bold: false },
                    { label: 'Settlement', value: 'Instant (~2s)', bold: false },
                ].map((item, i) => (
                    <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                        borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}>
                        <span style={{ fontSize: 13, color: 'var(--text-dim)', fontWeight: 500 }}>{item.label}</span>
                        <span style={{ fontSize: 13, fontWeight: item.bold ? 700 : 600, color: 'var(--white)' }}>{item.value}</span>
                    </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--white)' }}>Total</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#3b82f6' }}>{totalTZS.toLocaleString()} {user?.currency || 'TZS'}</span>
                </div>
            </div>

            {/* Details (Note, Expiry) */}
            {(request.description || request.expires_at) && (
                <div className="animate-up" style={{ marginBottom: 20 }}>
                    {request.description && (
                        <div style={{
                            background: 'rgba(255,255,255,0.03)', borderRadius: 16,
                            padding: '14px 18px', border: '1px solid rgba(255,255,255,0.06)',
                            marginBottom: request.expires_at ? 12 : 0,
                        }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Note</span>
                            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.5 }}>{request.description}</p>
                        </div>
                    )}
                    {request.expires_at && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: isExpired ? '#ef4444' : '#f59e0b', padding: '10px 0' }}>
                            <Clock size={14} />
                            <span style={{ fontSize: 12, fontWeight: 600 }}>
                                {isExpired ? 'This request has expired' : `Expires: ${new Date(request.expires_at).toLocaleString()}`}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* PIN Entry (shown when user clicks Confirm) */}
            {showPin && !isExpired && (
                <div className="animate-up" style={{ marginBottom: 20 }}>
                    <div style={{
                        background: 'rgba(59,130,246,0.04)',
                        border: '1px solid rgba(59,130,246,0.1)',
                        borderRadius: 20, padding: '20px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <ShieldCheck size={18} color="#3b82f6" />
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>Enter PIN to Authorize</p>
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} style={{
                                    width: 44, height: 52, borderRadius: 12,
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 22, fontWeight: 700, color: 'white',
                                }}>
                                    {pin[i] ? '•' : ''}
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'].map(k => (
                                <button key={k} onClick={() => {
                                    if (k === 'C') setPin('');
                                    else if (k === '⌫') setPin(pin.slice(0, -1));
                                    else if (pin.length < 4) setPin(pin + k);
                                }} style={{
                                    height: 48, border: 'none', borderRadius: 14,
                                    background: 'rgba(255,255,255,0.03)',
                                    color: 'white', fontSize: 18, fontWeight: 600,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}>
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Confirm & Pay Button ── */}
            {!user ? (
                <button
                    onClick={() => nav('/login')}
                    className="animate-up"
                    style={{
                        width: '100%', height: 64,
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        border: 'none', borderRadius: 20,
                        color: 'white', fontWeight: 700, fontSize: 17, fontFamily: 'var(--font)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                        cursor: 'pointer', boxShadow: '0 8px 30px rgba(245,158,11,0.3)',
                        marginBottom: 16,
                    }}
                >
                    Log in to Pay
                    <ArrowRight size={20} />
                </button>
            ) : (
                <button
                    onClick={handlePay}
                    disabled={paying || isExpired || (showPin && pin.length < 4)}
                    className="animate-up"
                    style={{
                        width: '100%', height: 64,
                        background: isExpired ? 'rgba(255,255,255,0.05)'
                            : (showPin && pin.length < 4) ? 'rgba(255,255,255,0.08)'
                                : 'linear-gradient(135deg, #7c3aed, #3b82f6)',
                        border: 'none', borderRadius: 20,
                        color: 'white', fontWeight: 700, fontSize: 17, fontFamily: 'var(--font)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                        cursor: isExpired ? 'not-allowed' : 'pointer',
                        boxShadow: isExpired ? 'none' : '0 8px 30px rgba(124,58,237,0.3)',
                        opacity: isExpired ? 0.5 : (showPin && pin.length < 4) ? 0.6 : 1,
                        transition: 'all 0.3s',
                        marginBottom: 16,
                    }}
                >
                    {paying ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                            Broadcasting to Polygon...
                        </div>
                    ) : isExpired ? (
                        'Request Expired'
                    ) : showPin ? (
                        <>
                            <ShieldCheck size={20} />
                            Confirm & Pay {request.amount_usdt} USDT
                        </>
                    ) : (
                        <>
                            <Zap size={20} />
                            Confirm & Pay
                        </>
                    )}
                </button>
            )}

            {/* Payment Methods */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="animate-up">
                <div style={{
                    background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.08)',
                    borderRadius: 16, padding: '14px 14px', textAlign: 'center',
                }}>
                    <Hexagon size={20} color="#7c3aed" style={{ marginBottom: 8 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white', display: 'block' }}>Polygon</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Amoy Testnet</span>
                </div>
                <div style={{
                    background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.08)',
                    borderRadius: 16, padding: '14px 14px', textAlign: 'center',
                }}>
                    <Smartphone size={20} color="#10b981" style={{ marginBottom: 8 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'white', display: 'block' }}>Mobile Money</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>M-Pesa / Tigo / Halo</span>
                </div>
            </div>

            {/* Trust Footer */}
            <div style={{ marginTop: 28, textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                    <ShieldCheck size={14} color="var(--text-dim)" />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>Secured by SafariPay • Polygon Amoy Blockchain</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
                    All transactions are broadcasted to Polygon Amoy (chainId: 80002) and verifiable on <a href="https://amoy.polygonscan.com" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>polygonscan</a>.
                </p>
            </div>
        </div>
    );
}

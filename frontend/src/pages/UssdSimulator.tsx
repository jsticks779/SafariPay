import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Smartphone,
    Hash,
    ChevronRight,
    Cpu,
    CornerDownRight
} from 'lucide-react';
import api, { fmt } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import toast from 'react-hot-toast';

type MenuState = 'idle' | 'main' | 'send_phone' | 'send_amount' | 'balance' | 'loans' | 'score' | 'confirm_send';

export default function UssdSimulator() {
    const { user, refresh } = useAuth();
    const { t, language } = useLanguage();
    const nav = useNavigate();
    const [state, setState] = useState<MenuState>('idle');
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<string[]>([]);
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');



    const dial = () => {
        if (input === '*150#') {
            setState('main');
            setHistory(['>> Dialing *150#...', `>> Connected to SafariPay Gateway`]);
        } else {
            toast.error('Invalid USSD code. Try *150#');
        }
        setInput('');
    };

    const handleMenu = (choice: string) => {
        if (choice === '0') { setState('main'); setInput(''); return; }

        if (state === 'main') {
            // Consumer menu
            if (choice === '1') setState('send_phone');
            else if (choice === '2') setState('balance');
            else if (choice === '3') nav('/loans');
            else if (choice === '4') setState('score');
            else setHistory([...history, `Invalid: ${choice}`]);
        } else if (state === 'send_phone') {
            setRecipient(choice); setState('send_amount');
        } else if (state === 'send_amount') {
            setAmount(choice); setState('confirm_send');
        } else if (state === 'confirm_send') {
            if (choice === '1') executeSend(); else setState('main');
        }
        setInput('');
    };

    const executeSend = async () => {
        try {
            await api.post('transactions/send', { receiver_phone: recipient, amount: Number(amount), description: 'USSD Transfer' });
            setHistory([...history, `>> SUCCESS: Sent ${fmt(Number(amount))} to ${recipient}`, '>> Session closed.']);
            setState('idle'); refresh();
            toast.success(language === 'SW' ? 'Fedha zimetumwa' : 'Funds sent via USSD');
        } catch (e: any) {
            setHistory([...history, `>> ERROR: ${e.response?.data?.error || 'Failed'}`]); setState('idle');
        }
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
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--white)' }}>{t('offline_mode')}</h1>
            </div>

            <div style={{ position: 'relative', margin: '0 auto', maxWidth: 320 }}>
                {/* Phone Frame */}
                <div style={{
                    background: '#1a1b1e', border: '8px solid #333', borderRadius: 40, padding: 20,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)', minHeight: 580, display: 'flex', flexDirection: 'column'
                }}>

                    {/* Screen */}
                    <div style={{
                        background: '#8fa89b', borderRadius: 10, padding: 12, flex: 1,
                        fontFamily: 'monospace', fontSize: 13, color: '#1a1b1e',
                        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.1)', marginBottom: 10, paddingBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 700 }}>SAFARIPAY v1.0</span>
                            <span style={{ fontSize: 10 }}>4G</span>
                        </div>

                        {state === 'idle' && (
                            <div className="animate-fade">
                                <p style={{ marginTop: 40, textAlign: 'center', fontSize: 10 }}>Dial *150# to start</p>
                                <div style={{ textAlign: 'center', marginTop: 40 }}>
                                    <Smartphone size={40} strokeWidth={1} style={{ opacity: 0.3 }} />
                                </div>
                            </div>
                        )}

                        {state === 'main' && (
                            <div className="animate-fade">
                                <p style={{ fontWeight: 700, marginBottom: 8 }}>{t('ussd_menu')}</p>
                                <p>1. {t('send')}</p>
                                <p>2. {t('balance')}</p>
                                <p>3. {t('loans')}</p>
                                <p>4. {t('credit_analysis')}</p>
                                <p>5. {language === 'SW' ? 'Toka' : 'Exit'}</p>
                                <p style={{ marginTop: 20 }}>{t('enter_choice')}</p>
                            </div>
                        )}

                        {state === 'send_phone' && (
                            <div className="animate-fade">
                                <p>{t('enter_phone')}</p>
                                <p style={{ fontSize: 10, color: 'rgba(0,0,0,0.6)' }}>Ex: +255 787 654 321</p>
                            </div>
                        )}

                        {state === 'send_amount' && (
                            <div className="animate-fade">
                                <p>TO: {recipient}</p>
                                <p>{t('enter_amount')}</p>
                            </div>
                        )}

                        {state === 'confirm_send' && (
                            <div className="animate-fade">
                                <p style={{ fontWeight: 700 }}>{t('confirm_send_ussd').replace('{amount}', amount).replace('{recipient}', recipient)}</p>
                                <p style={{ fontSize: 11, background: 'rgba(0,0,0,0.05)', padding: 6, borderRadius: 6, marginTop: 8 }}>
                                    Fee: {Math.round(Number(amount) * 0.005)} TZS<br />
                                    ({language === 'SW' ? 'Inakatwa kwenye Makato kwanza' : 'Paid from Fee Credit first'})
                                </p>
                                <p style={{ marginTop: 12 }}>{t('yes')}</p>
                                <p>{t('no')}</p>
                            </div>
                        )}



                        {state === 'balance' && (
                            <div className="animate-fade">
                                <p style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: 4, marginBottom: 8, fontWeight: 700 }}>PORTFOLIO BALANCES</p>

                                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)' }}>ESTIMATED TOTAL:</p>
                                <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                                    {fmt(Math.round((Number(user?.balance) || 0) + (Number(user?.reward_balance) || 0) * 2632))}
                                </p>

                                <p style={{ fontSize: 10 }}>Cash (TZS):</p>
                                <p style={{ fontSize: 13, fontWeight: 600, margin: '2px 0 2px' }}>{fmt(user?.balance || 0)}</p>
                                <p style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)', marginBottom: 8 }}>≈ {(Number(user?.balance || 0) / 2632).toFixed(2)} USDT</p>

                                <p style={{ fontSize: 10, color: '#26a17b' }}>Smart Wallet (USDT):</p>
                                <p style={{ fontSize: 13, fontWeight: 700, color: '#26a17b' }}>{Number(user?.reward_balance || 0).toFixed(4)} USDT</p>
                                <p style={{ fontSize: 9, color: '#26a17b' }}>≈ {fmt(Math.round(Number(user?.reward_balance || 0) * 2632))}</p>

                                <p style={{ marginTop: 20 }}>0. {t('dial_0_back')}</p>
                            </div>
                        )}

                        {state === 'score' && (
                            <div className="animate-fade">
                                <p style={{ fontWeight: 700 }}>SAFARIPAY AI ANALYSIS</p>
                                <p>Trust Score: {user?.credit_score}</p>
                                <p>Safety: <span style={{ color: user?.credit_score > 600 ? '#059669' : '#b91c1c' }}>{user?.credit_score > 600 ? 'HIGH TRUST' : 'BUILDING'}</span></p>
                                <p style={{ marginTop: 10, fontSize: 10 }}>Max Loan: {fmt(user?.credit_score >= 700 ? 500000 : 100000)}</p>
                                <p style={{ marginTop: 20 }}>0. {t('dial_0_back')}</p>
                            </div>
                        )}

                        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 10 }}>
                            {history.slice(-3).map((h, i) => (
                                <p key={i} style={{ fontSize: 10, color: 'rgba(0,0,0,0.5)' }}>{h}</p>
                            ))}
                        </div>
                    </div>

                    {/* Numpad Area */}
                    <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map(n => (
                            <button key={n} onClick={() => setInput(input + n)}
                                style={{
                                    height: 44, borderRadius: 12, background: 'linear-gradient(180deg, #444, #222)',
                                    border: '1px solid #555', color: 'white', fontWeight: 700, fontSize: 16, cursor: 'pointer'
                                }}>
                                {n}
                            </button>
                        ))}
                    </div>

                    <div style={{ position: 'relative', marginTop: 16 }}>
                        <input value={input} readOnly
                            style={{
                                width: '100%', padding: '12px 16px', borderRadius: 10,
                                background: 'rgba(255,255,255,0.05)', border: '1px solid #444',
                                color: 'white', fontFamily: 'monospace', fontSize: 18, textAlign: 'center'
                            }} />
                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                            <button
                                onClick={() => setInput('')}
                                style={{ flex: 1, padding: 12, borderRadius: 10, background: '#e11d48', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                                CLR
                            </button>
                            <button
                                onClick={state === 'idle' ? dial : () => handleMenu(input)}
                                style={{ flex: 2, padding: 12, borderRadius: 10, background: '#10b981', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                                {state === 'idle' ? 'DIAL' : 'OK'}
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Info Card */}
            <div className="card-glow animate-up" style={{ marginTop: 40, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Cpu size={20} color="var(--primary)" />
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{t('offline_gateway')}</h3>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
                    {t('offline_desc')}
                </p>
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 12, border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Hash size={16} color="var(--success)" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{t('current_command')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

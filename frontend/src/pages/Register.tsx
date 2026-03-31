import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import toast from 'react-hot-toast';
import {
    Zap,
    ChevronRight,
    Phone,
    User as UserIcon,
    Languages,
    ShieldCheck,
    Lock,
    Loader2,
    Smartphone
} from 'lucide-react';
import { ALL_COUNTRIES } from '../lib/countries';
import { validatePhone } from '../lib/validation';

type Step = 'form' | 'otp' | 'setup_pin' | 'confirm_pin';

export default function Register() {
    const { register, verifyOtp, setupPin } = useAuth();
    const { language, setLanguage, t } = useLanguage();
    const nav = useNavigate();

    const [step, setStep] = useState<Step>('form');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [otp, setOtp] = useState('');
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [busy, setBusy] = useState(false);
    const [showCountries, setShowCountries] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const country = ALL_COUNTRIES.find(c => phone.startsWith(c.prefix)) || ALL_COUNTRIES[ALL_COUNTRIES.length - 1];

    const filteredCountries = ALL_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.prefix.includes(searchTerm)
    );

    const handleStart = async () => {
        if (!phone) return toast.error('Enter phone number');
        if (!name) return toast.error('Enter full name');

        const v = validatePhone(phone, country.code);
        if (!v.isValid) return toast.error(v.message || 'Invalid phone number');

        setBusy(true);
        try {
            const res = await register(v.formatted || phone, name);
            setStep('otp');
            toast.success(res.message || 'Security code sent!');
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Registration failed');
        } finally {
            setBusy(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) return toast.error('Enter 6-digit code');
        setBusy(true);
        try {
            const data = await verifyOtp(phone, otp);
            if (data.needs_pin_setup) {
                setStep('setup_pin');
                setPin('');
                toast.success('Successfully verified! Please create your transaction PIN.');
            } else {
                toast.error('Account already exists. Please login.');
                nav('/login');
            }
        } catch (e: any) {
            toast.error(e.response?.data?.message || 'Code incorrect');
        } finally {
            setBusy(false);
        }
    };

    const handleSetupPinFinal = async (finalPin: string, finalConfirm: string) => {
        if (finalConfirm !== finalPin) {
            toast.error('PINs do not match. Try again.');
            setStep('setup_pin');
            setPin('');
            setConfirmPin('');
            return;
        }
        setBusy(true);
        try {
            await setupPin(phone, finalPin, name, country.code, country.currency);
            toast.success('Account Created! 🎉 Complete your profile.', { duration: 4000 });
            nav('/onboarding');
        } catch (e: any) {
            toast.error('PIN setup failed. Please retry.');
        } finally {
            setBusy(false);
        }
    };

    const onKey = (k: string) => {
        if (k === '⌫') {
            if (step === 'setup_pin') setPin(p => p.slice(0, -1));
            else if (step === 'confirm_pin') setConfirmPin(p => p.slice(0, -1));
            return;
        }
        if (k === '') return;

        if (step === 'setup_pin') {
            if (pin.length < 4) {
                const nc = pin + k;
                setPin(nc);
                if (nc.length === 4) {
                    setTimeout(() => { setStep('confirm_pin'); setConfirmPin(''); }, 200);
                }
            }
        } else if (step === 'confirm_pin') {
            if (confirmPin.length < 4) {
                const nc = confirmPin + k;
                setConfirmPin(nc);
                if (nc.length === 4) setTimeout(() => handleSetupPinFinal(pin, nc), 200);
            }
        }
    };

    const nukeNumpad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', background: 'var(--bg-dark)', position: 'relative' }}>
            {/* 📱 Virtual Phone Link for Unregistered Users */}
            <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 1000 }}>
                <Link to={phone ? `/phone/${encodeURIComponent(phone)}` : '/system/sms'} target="_blank"
                    style={{
                        width: 44, height: 44, borderRadius: 14,
                        background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--success)',
                        textDecoration: 'none'
                    }}>
                    <span style={{ fontSize: 8, fontWeight: 800, position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', background: 'var(--success)', color: 'white', padding: '2px 5px', borderRadius: 6, letterSpacing: '0.5px' }}>PHONE</span>
                    <Smartphone size={18} />
                </Link>
            </div>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 48 }} className="animate-up">
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, var(--primary), var(--success))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 16px', boxShadow: '0 10px 30px rgba(59, 130, 246, 0.3)' }}>
                    <Zap size={32} fill="white" />
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: 'white', letterSpacing: '-0.03em' }}>Join SafariPay</h1>
                <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>The next generation of mobile finance</p>
            </div>

            <div style={{ width: '100%', maxWidth: 400 }} className="animate-fade">
                {step === 'form' && (
                    <div className="card-glow">
                        <div style={{ marginBottom: 32 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 8 }}>Register Account</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Start your journey with us</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ position: 'relative' }}>
                                <UserIcon size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                <input className="input" style={{ paddingLeft: 48 }} placeholder="Your Legal Full Name" value={name} onChange={e => setName(e.target.value)} />
                            </div>

                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => setShowCountries(true)}
                                    style={{ height: 52, padding: '0 16px', background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, color: 'white', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {country.flag}
                                </button>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <Phone size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                                    <input className="input" style={{ paddingLeft: 48 }} placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} type="tel" />
                                </div>
                            </div>

                            {showCountries && (
                                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                                    <div className="card-glow" style={{ width: '100%', maxWidth: 400, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ paddingBottom: 16 }}>
                                            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 16 }}>Select Country</h3>
                                            <input className="input" placeholder="Search country or code..." autoFocus value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                        </div>
                                        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {filteredCountries.map(c => (
                                                <button key={c.code} onClick={() => { setPhone(c.prefix); setShowCountries(false); setSearchTerm(''); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.03)', border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', textAlign: 'left' }}>
                                                    <span style={{ fontSize: 24 }}>{c.flag}</span>
                                                    <span style={{ flex: 1, fontWeight: 600 }}>{c.name}</span>
                                                    <span style={{ color: 'var(--text-dim)' }}>{c.prefix}</span>
                                                </button>
                                            ))}
                                        </div>
                                        <button className="btn" onClick={() => { setShowCountries(false); setSearchTerm(''); }} style={{ marginTop: 16, background: 'rgba(255,255,255,0.05)' }}>Close</button>
                                    </div>
                                </div>
                            )}

                            <button className="btn btn-blue" onClick={handleStart} disabled={busy} style={{ height: 56, fontSize: 16, marginTop: 12 }}>
                                {busy ? <Loader2 className="animate-spin" /> : 'Create Account'} <ChevronRight size={20} />
                            </button>

                            <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-dim)', marginTop: 8 }}>
                                Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>Log In</Link>
                            </p>
                        </div>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="card-glow animate-up" style={{ textAlign: 'center' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', margin: '0 auto 16px' }}>
                            <Lock size={24} />
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 8 }}>Security Check</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>Enter the verification code sent to {phone}</p>
                        <input className="input" style={{ textAlign: 'center', fontSize: 28, letterSpacing: '0.4em', fontWeight: 700, height: 72, marginBottom: 24 }}
                            placeholder="0 0 0 0 0 0" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} type="tel" />
                        <button className="btn btn-blue" onClick={handleVerifyOtp} disabled={busy || otp.length !== 6}>
                            {busy ? <Loader2 className="animate-spin" /> : 'Confirm Code'}
                        </button>
                    </div>
                )}

                {(step === 'setup_pin' || step === 'confirm_pin') && (
                    <div className="card-glow animate-up" style={{ textAlign: 'center' }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', margin: '0 auto 16px' }}>
                            <ShieldCheck size={24} />
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 8 }}>{step === 'setup_pin' ? 'Set Your PIN' : 'Verify PIN'}</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>Build your secure transaction vault</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 40 }}>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} style={{ width: 14, height: 14, borderRadius: 7, border: `2px solid ${(step === 'confirm_pin' ? confirmPin : pin).length > i ? 'var(--primary)' : 'var(--glass-border)'}`, background: (step === 'confirm_pin' ? confirmPin : pin).length > i ? 'var(--primary)' : 'transparent', transition: 'all 0.2s' }} />
                            ))}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, maxWidth: 280, margin: '0 auto 32px' }}>
                            {nukeNumpad.map((k, i) => k === '' ? <div key={i} /> : (
                                <button key={i} className="numpad-btn" onClick={() => onKey(k)} style={{ width: 64, height: 64, fontSize: 22, fontWeight: 600 }}>{k}</button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <button onClick={() => setLanguage(language === 'EN' ? 'SW' : 'EN')}
                style={{ position: 'fixed', bottom: 32, right: 32, height: 44, padding: '0 16px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'white', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Languages size={18} /> {language}
            </button>
        </div>
    );
}

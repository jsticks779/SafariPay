import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import api from '../lib/api';
import toast from 'react-hot-toast';
import {
    User, MapPin, Globe, Phone, ChevronRight, Camera, CreditCard, Upload,
    ShieldCheck, CheckCircle2, Loader2, AlertTriangle, FileText, ArrowLeft, Zap, X
} from 'lucide-react';
import { ALL_COUNTRIES } from '../lib/countries';

type Step = 'personal' | 'document' | 'terms';

export default function Onboarding() {
    const { user, refresh } = useAuth();
    const { t } = useLanguage();
    const nav = useNavigate();

    const location = useLocation();
    const isVerifyMode = location.search.includes('mode=verify');

    const [step, setStep] = useState<Step>(isVerifyMode ? 'document' : 'personal');
    const [busy, setBusy] = useState(false);

    // Personal Info
    const [firstName, setFirstName] = useState(user?.name?.split(' ')[0] || '');
    const [lastName, setLastName] = useState(user?.name?.split(' ').slice(1).join(' ') || '');
    const [email, setEmail] = useState('');
    const [dob, setDob] = useState('');
    const [country, setCountry] = useState(user?.country || 'TZ');
    const [address, setAddress] = useState('');
    const [showCountryPicker, setShowCountryPicker] = useState(false);

    // Document Upload
    const [idFile, setIdFile] = useState<File | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);
    const [idPreview, setIdPreview] = useState('');
    const [selfiePreview, setSelfiePreview] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [verified, setVerified] = useState(false);
    const [idType, setIdType] = useState('National ID');
    const [documentCountry, setDocumentCountry] = useState(user?.country || 'TZ');
    const [shuftiResponseData, setShuftiResponseData] = useState<any>(null);

    // Terms
    const [termsAccepted, setTermsAccepted] = useState(false);

    const selectedCountry = ALL_COUNTRIES.find(c => c.code === country) || ALL_COUNTRIES[0];
    const selectedDocumentCountry = ALL_COUNTRIES.find(c => c.code === documentCountry) || ALL_COUNTRIES[0];

    const inputStyle: React.CSSProperties = {
        width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '16px 18px', color: '#fff', fontSize: 15, fontFamily: 'var(--font)',
        outline: 'none', transition: 'all 0.2s',
    };

    // ── Step 1: Save Personal Info ──
    const handleSavePersonal = async () => {
        if (!firstName.trim()) return toast.error('First name is required');
        if (!lastName.trim()) return toast.error('Last name is required');

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim() || !emailRegex.test(email)) return toast.error('Valid Email is required');
        if (!dob) return toast.error('Date of Birth is required');
        if (!address.trim()) return toast.error('Address is required');

        setBusy(true);
        try {
            await api.post('/auth/kyc-profile', {
                first_name: firstName, last_name: lastName,
                email, dob,
                country, address, phone: user?.phone
            });
            toast.success('Personal info saved!');
            setStep('document');
        } catch (e: any) {
            const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to save profile';
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    };

    // ── Step 2: Handle ID Upload ──
    const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIdFile(file);
        setIdPreview(URL.createObjectURL(file));
    };

    const handleSelfieUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelfieFile(file);
        setSelfiePreview(URL.createObjectURL(file));
    };

    const handleVerifyDocuments = async () => {
        if (!idFile || !selfieFile) return toast.error('Please upload both your ID and selfie');
        setVerifying(true);
        try {
            const { data } = await api.post('/auth/kyc-verify', {
                id_document: true,
                selfie: true,
                idType,
                documentCountry,
                name: `${firstName} ${lastName}`
            });
            if (data.reference) {
                setShuftiResponseData(data);
                if (data.event === 'verification.accepted') {
                    setVerified(true);
                    toast.success('Identity verified! ✅');
                } else {
                    toast.error('Identity declined. Check details.');
                }
            }
        } catch (e: any) {
            const msg = e.response?.data?.message || e.response?.data?.error || 'Verification error';
            toast.error(msg);
        } finally {
            setVerifying(false);
        }
    };

    const handleSkipVerification = () => {
        toast('You can verify later from your profile.', { icon: 'ℹ️' });
        setStep('terms');
    };

    const handleProceedAfterDocs = () => {
        setStep('terms');
    };

    const handleAcceptTerms = async () => {
        if (!termsAccepted) return toast.error('Please accept the Terms & Conditions');
        setBusy(true);
        try {
            await api.post('/auth/accept-terms', {});
            await refresh();
            toast.success('Welcome to SafariPay! 🎉');
            nav('/');
        } catch (e: any) {
            const msg = e.response?.data?.message || e.response?.data?.error || 'Activation failed';
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    };

    const steps = ['Personal Info', 'Verification', 'Terms'];
    const stepIndex = step === 'personal' ? 0 : step === 'document' ? 1 : 2;

    return (
        <div style={{ minHeight: '100vh', padding: '32px 20px', paddingBottom: 60, position: 'relative' }} className="animate-fade">
            <style>{`
                @keyframes scan-line {
                    0% { top: 0%; transform: scaleX(1); opacity: 0.5; }
                    50% { top: 100%; transform: scaleX(1.1); opacity: 1; }
                    100% { top: 0%; transform: scaleX(1); opacity: 0.5; }
                }
                .scanner-line {
                    position: absolute; width: 100%; height: 3px; background: #10b981;
                    box-shadow: 0 0 15px #10b981; animation: scan-line 3s linear infinite; z-index: 5;
                }
                .selfie-frame {
                    width: 160px; height: 160px; border-radius: 50%; border: 4px solid #6366f1;
                    overflow: hidden; position: relative; box-shadow: 0 0 30px rgba(99, 102, 241, 0.2);
                    margin: 0 auto;
                }
                .selfie-frame img { width: 100%; height: 100%; object-fit: cover; }
            `}</style>

            {isVerifyMode && (
                <button onClick={() => nav('/')} style={{ position: 'absolute', top: 20, left: 20, width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
                    <X size={20} />
                </button>
            )}

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #3b82f6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 12px' }}>
                    <ShieldCheck size={28} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>{isVerifyMode ? 'Identity Verification' : 'Welcome to SafariPay'}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Secure your account in minutes</p>
            </div>

            {!isVerifyMode && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
                    {steps.map((s, i) => (
                        <div key={i} style={{ flex: 1 }}>
                            <div style={{ height: 4, borderRadius: 2, background: i <= stepIndex ? '#3b82f6' : 'rgba(255,255,255,0.1)', marginBottom: 8 }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: i <= stepIndex ? 'white' : 'var(--text-dim)' }}>{s}</span>
                        </div>
                    ))}
                </div>
            )}

            {step === 'personal' && (
                <div className="card-glow" style={{ padding: 24, borderRadius: 24 }}>
                    <div style={{ marginBottom: 20 }}>
                        <label className="label">First Name</label>
                        <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} placeholder="John" />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label className="label">Last Name</label>
                        <input value={lastName} onChange={e => setLastName(e.target.value)} style={inputStyle} placeholder="Doe" />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label className="label">Email Address</label>
                        <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="john@example.com" />
                    </div>
                    <div style={{ marginBottom: 20 }}>
                        <label className="label">Date of Birth</label>
                        <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={{ ...inputStyle, colorScheme: 'dark' }} />
                    </div>
                    <div style={{ marginBottom: 32 }}>
                        <label className="label">Your Country</label>
                        <button onClick={() => setShowCountryPicker(true)} style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontSize: 20 }}>{selectedCountry.flag}</span>
                            <span style={{ flex: 1 }}>{selectedCountry.name}</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <button onClick={handleSavePersonal} disabled={busy} className="btn-primary" style={{ width: '100%', height: 56 }}>
                        {busy ? <Loader2 className="animate-spin" /> : 'Continue'}
                    </button>
                </div>
            )}

            {step === 'document' && (
                <div className="card-glow" style={{ padding: 24, borderRadius: 24 }}>
                    {verifying ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <Loader2 size={48} className="animate-spin" style={{ color: '#3b82f6', margin: '0 auto 20px' }} />
                            <h3 style={{ color: 'white' }}>Verifying Identity...</h3>
                        </div>
                    ) : verified ? (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <CheckCircle2 size={60} color="#10b981" style={{ margin: '0 auto 20px' }} />
                            <h3 style={{ color: 'white', marginBottom: 24 }}>Identity Verified!</h3>
                            <button onClick={handleProceedAfterDocs} className="btn-primary" style={{ width: '100%', height: 56 }}>Continue</button>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
                                <button onClick={() => setShowCountryPicker(true)} style={{ ...inputStyle, flex: 0.8, padding: '12px' }}>
                                    {selectedDocumentCountry.flag} {selectedDocumentCountry.code}
                                </button>
                                <select value={idType} onChange={e => setIdType(e.target.value)} style={{ ...inputStyle, flex: 1.2 }}>
                                    <option value="National ID">National ID</option>
                                    <option value="Passport">Passport</option>
                                    <option value="Driving License">Driving License</option>
                                </select>
                            </div>
                            <div style={{ border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 20, height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
                                {idPreview ? (
                                    <>
                                        <div className="scanner-line" />
                                        <img src={idPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </>
                                ) : (
                                    <label style={{ cursor: 'pointer', textAlign: 'center' }}>
                                        <CreditCard size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                                        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>Upload {idType}</p>
                                        <input type="file" onChange={handleIdUpload} hidden accept="image/*" />
                                    </label>
                                )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
                                <div className={selfiePreview ? "selfie-frame" : ""} style={!selfiePreview ? { width: 140, height: 140, border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}>
                                    {selfiePreview ? <img src={selfiePreview} /> : (
                                        <label style={{ cursor: 'pointer', textAlign: 'center' }}>
                                            <Camera size={24} style={{ opacity: 0.4, marginBottom: 4 }} />
                                            <p style={{ fontSize: 11, color: 'var(--text-dim)' }}>Selfie</p>
                                            <input type="file" onChange={handleSelfieUpload} hidden accept="image/*" capture="user" />
                                        </label>
                                    )}
                                </div>
                            </div>
                            <button onClick={handleVerifyDocuments} disabled={!idFile || !selfieFile} className="btn-primary" style={{ width: '100%', height: 56, marginBottom: 16 }}>
                                Verify Identity
                            </button>
                            {!isVerifyMode && <button onClick={handleSkipVerification} style={{ width: '100%', color: 'var(--text-dim)', fontSize: 13, background: 'none', border: 'none' }}>Skip for now</button>}
                        </>
                    )}
                </div>
            )}

            {step === 'terms' && (
                <div className="card-glow" style={{ padding: 24, borderRadius: 24 }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 16, marginBottom: 24, maxHeight: 200, overflowY: 'auto' }}>
                        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6 }}>By using SafariPay, you agree to our non-custodial terms. We do not store your private keys...</p>
                    </div>
                    <label style={{ display: 'flex', gap: 12, cursor: 'pointer', marginBottom: 32 }}>
                        <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ width: 20, height: 20 }} />
                        <span style={{ fontSize: 13, color: 'white' }}>I accept the Terms & Conditions</span>
                    </label>
                    <button onClick={handleAcceptTerms} disabled={!termsAccepted || busy} className="btn-primary" style={{ width: '100%', height: 56 }}>
                        {busy ? <Loader2 className="animate-spin" /> : 'Finish Setup'}
                    </button>
                </div>
            )}

            {showCountryPicker && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div className="card-glow" style={{ width: '100%', maxWidth: 400, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between' }}>
                            <h3 style={{ color: 'white' }}>Select Country</h3>
                            <button onClick={() => setShowCountryPicker(false)} style={{ color: 'white' }}><X /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 20px' }}>
                            {ALL_COUNTRIES.map(c => (
                                <button key={c.code} onClick={() => {
                                    if (step === 'document') setDocumentCountry(c.code);
                                    else setCountry(c.code);
                                    setShowCountryPicker(false);
                                }} style={{ width: '100%', padding: 16, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', color: 'white' }}>
                                    <span style={{ fontSize: 24 }}>{c.flag}</span>
                                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

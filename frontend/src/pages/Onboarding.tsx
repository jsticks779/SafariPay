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

        const age = new Date().getFullYear() - new Date(dob).getFullYear();
        if (age < 18) return toast.error('You must be at least 18 years old');

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
                documentCountry
            });
            if (data.verified) {
                setShuftiResponseData(data.shuftiResponse);
                setVerified(true);
                toast.success('Identity verified! ✅');
                await refresh();
            } else {
                toast.error('Verification failed. You can try again later.');
            }
        } catch (e: any) {
            const msg = e.response?.data?.message || e.response?.data?.error || 'Verification error';
            toast.error(msg);
        } finally {
            setVerifying(false);
        }
    };

    const handleSkipVerification = async () => {
        try {
            await api.post('/auth/kyc-verify', { skip: true });
            toast('You can verify later from your profile.', { icon: 'ℹ️' });
            setStep('terms');
        } catch (e: any) {
            const msg = e.response?.data?.message || e.response?.data?.error || 'Failed to skip';
            toast.error(msg);
        }
    };

    const handleProceedAfterDocs = () => {
        setStep('terms');
    };

    // ── Step 3: Accept Terms ──
    const handleAcceptTerms = async () => {
        if (!termsAccepted) return toast.error('Please accept the Terms & Conditions');
        setBusy(true);
        try {
            await api.post('/auth/accept-terms', {});
            await refresh();
            toast.success('Welcome to SafariPay! 🎉', { duration: 4000 });
            nav('/');
        } catch (e: any) {
            const msg = e.response?.data?.message || e.response?.data?.error || e.message || 'Activation failed';
            toast.error(msg);
        } finally {
            setBusy(false);
        }
    };

    // ── Progress Bar ──
    const steps = ['Personal Info', 'Verification', 'Terms'];
    const stepIndex = step === 'personal' ? 0 : step === 'document' ? 1 : 2;

    return (
        <div style={{ minHeight: '100vh', padding: '32px 20px', paddingBottom: 60, position: 'relative' }} className="animate-fade">
            <style>{`
                @keyframes scan-line {
                    0% { top: 0%; box-shadow: 0 0 10px 2px rgba(16, 185, 129, 0.5); }
                    50% { top: 100%; box-shadow: 0 0 10px 2px rgba(16, 185, 129, 0.5); }
                    100% { top: 0%; box-shadow: 0 0 10px 2px rgba(16, 185, 129, 0.5); }
                }
                .scanner-line {
                    position: absolute;
                    width: 100%;
                    height: 2px;
                    background: #10b981;
                    animation: scan-line 3s ease-in-out infinite;
                    z-index: 10;
                }
                .selfie-frame {
                    width: 160px;
                    height: 160px;
                    border-radius: 50%;
                    border: 4px solid #6366f1;
                    overflow: hidden;
                    position: relative;
                    box-shadow: 0 0 30px rgba(99, 102, 241, 0.2);
                    margin: 0 auto;
                }
                .selfie-frame img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
            `}</style>
            
            {/* Close Button (Verify Mode) */}
            {isVerifyMode && (
                <button 
                  onClick={() => nav('/')}
                  style={{
                    position: 'absolute', top: 20, left: 20, width: 44, height: 44,
                    borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
                  }}
                >
                    <X size={20} />
                </button>
            )}

            <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #3b82f6, #10b981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', margin: '0 auto 12px', boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
                    <ShieldCheck size={28} />
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 4 }}>
                    {isVerifyMode ? 'Identity Verification' : 'Complete Your Profile'}
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                    {isVerifyMode ? 'Secure your account & unlock full limits' : 'Just a few more steps to secure your wealth'}
                </p>
            </div>

            {/* Step Indicator - HIDDEN in Verify Mode */}
            {!isVerifyMode && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 36 }}>
                    {steps.map((s, i) => (
                        <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ height: 4, borderRadius: 2, background: i <= stepIndex ? '#3b82f6' : 'rgba(255,255,255,0.08)', marginBottom: 8, transition: 'all 0.4s' }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: i <= stepIndex ? 'white' : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ════════════ STEP 1: PERSONAL INFO ════════════ */}
            {step === 'personal' && (
                <div className="animate-up" style={{ maxWidth: 420, margin: '0 auto' }}>
                    <div className="card-glow" style={{ padding: 28, borderRadius: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                                <User size={22} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Personal Details</h2>
                                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Use the name on your government ID</p>
                            </div>
                        </div>

                        {/* First Name */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Legal First Name</label>
                        <div style={{ position: 'relative', marginBottom: 20 }}>
                            <User size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="As seen on ID"
                                style={{ ...inputStyle, paddingLeft: 44 }}
                                onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                        </div>

                        {/* Last Name */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Legal Last Name</label>
                        <div style={{ position: 'relative', marginBottom: 20 }}>
                            <User size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="As seen on ID"
                                style={{ ...inputStyle, paddingLeft: 44 }}
                                onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                        </div>

                        {/* Email */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Email Address</label>
                        <div style={{ position: 'relative', marginBottom: 20 }}>
                            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="hello@safaripay.com"
                                style={{ ...inputStyle, paddingLeft: 18 }}
                                onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                        </div>

                        {/* Date of Birth */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Date of Birth</label>
                        <div style={{ position: 'relative', marginBottom: 20 }}>
                            <input type="date" value={dob} onChange={e => setDob(e.target.value)} max={new Date().toISOString().split('T')[0]}
                                style={{ ...inputStyle, paddingLeft: 18, colorScheme: 'dark' }}
                                onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                        </div>

                        {/* Country */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Country</label>
                        <button onClick={() => setShowCountryPicker(true)} style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', marginBottom: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Globe size={16} color="var(--text-dim)" />
                            <span style={{ fontSize: 20 }}>{selectedCountry.flag}</span>
                            <span style={{ flex: 1, fontWeight: 600 }}>{selectedCountry.name}</span>
                            <ChevronRight size={16} color="var(--text-dim)" />
                        </button>

                        {/* Phone (Confirmed from Registration) */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Phone Number</label>
                        <div style={{ position: 'relative', marginBottom: 20 }}>
                            <Phone size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input value={user?.phone || ''} readOnly
                                style={{ ...inputStyle, paddingLeft: 44, opacity: 0.6, cursor: 'not-allowed', background: 'rgba(255,255,255,0.02)' }} />
                        </div>

                        {/* Address */}
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 8 }}>Residential Address</label>
                        <div style={{ position: 'relative', marginBottom: 32 }}>
                            <MapPin size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, State"
                                style={{ ...inputStyle, paddingLeft: 44 }}
                                onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }} />
                        </div>

                        <button onClick={handleSavePersonal} disabled={busy}
                            style={{ width: '100%', height: 60, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', borderRadius: 18, color: 'white', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 30px rgba(59,130,246,0.3)', opacity: busy ? 0.6 : 1 }}>
                            {busy ? <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> : <><span>Continue</span> <ChevronRight size={20} /></>}
                        </button>
                    </div>
                </div>
            )}

            {/* ════════════ STEP 2: DOCUMENT VERIFICATION ════════════ */}
            {step === 'document' && (
                <div className="animate-up" style={{ maxWidth: 420, margin: '0 auto' }}>
                    {verifying ? (
                        <div style={{ textAlign: 'center', paddingTop: 60 }}>
                            <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 40px' }}>
                                <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(255,255,255,0.06)', borderRadius: '50%' }} />
                                <div style={{ position: 'absolute', inset: 0, border: '4px solid #3b82f6', borderRadius: '50%', borderTopColor: 'transparent', animation: 'spin 1.5s linear infinite' }} />
                                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#3b82f6' }}>
                                    <ShieldCheck size={48} />
                                </div>
                            </div>
                            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 12 }}>Verifying...</h2>
                            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Our AI is checking your documents</p>
                        </div>
                    ) : verified ? (
                        <div style={{ textAlign: 'center', paddingTop: 40 }}>
                            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', margin: '0 auto 28px', boxShadow: '0 0 50px rgba(16,185,129,0.15)' }}>
                                <CheckCircle2 size={50} />
                            </div>
                            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 8 }}>Verified! ✅</h2>
                            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>Your identity has been confirmed. You have full access to all SafariPay features.</p>
                            
                            {/* Shufti Pro Receipt */}
                            {shuftiResponseData && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, marginBottom: 36, textAlign: 'left' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 10, marginBottom: 10 }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Reference ID</span>
                                        <span style={{ fontSize: 13, color: 'white', fontFamily: 'monospace' }}>{shuftiResponseData.reference}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 10, marginBottom: 10 }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>AML Status</span>
                                        <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>{shuftiResponseData.aml_result}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Document Match</span>
                                        <span style={{ fontSize: 13, color: 'white' }}>{shuftiResponseData.verification_data?.document?.name}</span>
                                    </div>
                                </div>
                            )}

                            <button onClick={handleProceedAfterDocs}
                                style={{ width: '100%', height: 60, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: 18, color: 'white', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font)', cursor: 'pointer', boxShadow: '0 8px 30px rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                Continue <ChevronRight size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="card-glow" style={{ padding: 28, borderRadius: 28 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                                    <ShieldCheck size={22} />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>ID Verification</h2>
                                    <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Upload government ID & selfie</p>
                                </div>
                            </div>

                            {/* Optional Skip Notice */}
                            <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)', borderRadius: 16, marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} />
                                <p style={{ fontSize: 12, color: 'rgba(245,158,11,0.9)', lineHeight: 1.6, margin: 0 }}>
                                    This step is <b>optional</b>. However, you <b>won't be able to take loans or send coins</b> until you complete verification.
                                </p>
                            </div>

                            {/* Global Doc Check */}
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>Global Support (230+ Countries)</label>
                            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                                <button onClick={() => setShowCountryPicker(true)} style={{ ...inputStyle, flex: 0.8, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '16px 14px' }}>
                                    <span style={{ fontSize: 20 }}>{selectedDocumentCountry.flag}</span>
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>{selectedDocumentCountry.code}</span>
                                    <ChevronRight size={14} color="var(--text-dim)" style={{ marginLeft: 'auto' }} />
                                </button>
                                <div style={{ flex: 1.2, position: 'relative' }}>
                                    <select value={idType} onChange={e => setIdType(e.target.value)} style={{ ...inputStyle, appearance: 'none', paddingRight: 40, cursor: 'pointer' }}>
                                        <option value="National ID">National ID</option>
                                        <option value="Passport">Passport</option>
                                        <option value="Driving License">Driving License</option>
                                    </select>
                                    <ChevronRight size={16} color="var(--text-dim)" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%) rotate(90deg)' }} />
                                </div>
                            </div>

                            {/* ID Upload */}
                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10 }}>{idType} (Front)</label>
                            <div style={{ position: 'relative', height: idPreview ? 'auto' : 160, border: `2px dashed ${idPreview ? '#10b981' : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', overflow: 'hidden', marginBottom: 20, transition: 'all 0.3s' }}>
                                {idPreview ? (
                                    <>
                                        <div className="scanner-line"></div>
                                        <img src={idPreview} alt="ID" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 18, filter: 'brightness(1.1) contrast(1.1)' }} />
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={36} style={{ opacity: 0.15, marginBottom: 12 }} />
                                        <label style={{ background: '#3b82f6', color: 'white', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Upload size={16} /> Upload ID
                                            <input type="file" accept="image/*" capture="environment" onChange={handleIdUpload} hidden />
                                        </label>
                                    </>
                                )}
                            </div>

                            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 10, textAlign: 'center' }}>Liveness Check (Selfie)</label>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
                                <div className={selfiePreview ? "selfie-frame" : ""} style={!selfiePreview ? { height: 160, width: '100%', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', transition: 'all 0.3s' } : {}}>
                                    {selfiePreview ? (
                                        <img src={selfiePreview} alt="Selfie" />
                                    ) : (
                                    <>
                                        <Camera size={36} style={{ opacity: 0.15, marginBottom: 12 }} />
                                        <label style={{ background: '#6366f1', color: 'white', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Camera size={16} /> Take Selfie
                                            <input type="file" accept="image/*" capture="user" onChange={handleSelfieUpload} hidden />
                                        </label>
                                    </>
                                )}
                                </div>
                            </div>

                            {/* Verify Button */}
                            <button 
                                onClick={handleVerifyDocuments} 
                                disabled={!idFile || !selfieFile || verifying}
                                style={{ 
                                    width: '100%', height: 56, 
                                    background: (!idFile || !selfieFile) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #3b82f6, #2563eb)', 
                                    border: 'none', borderRadius: 18, color: 'white', fontWeight: 700, fontSize: 15, 
                                    fontFamily: 'var(--font)', cursor: (!idFile || !selfieFile) ? 'not-allowed' : 'pointer', 
                                    marginBottom: 16, boxShadow: (!idFile || !selfieFile) ? 'none' : '0 8px 24px rgba(59,130,246,0.3)', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                    opacity: (!idFile || !selfieFile) ? 0.5 : 1,
                                    transition: 'all 0.3s'
                                }}
                            >
                                <ShieldCheck size={18} /> 
                                {verifying ? 'Verifying...' : 'Verify My Identity'}
                            </button>

                            {/* Skip Button */}
                            {!isVerifyMode && (
                                <button onClick={handleSkipVerification}
                                    style={{ width: '100%', padding: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
                                    Skip for now — I'll verify later
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════ STEP 3: TERMS & CONDITIONS ════════════ */}
            {step === 'terms' && (
                <div className="animate-up" style={{ maxWidth: 420, margin: '0 auto' }}>
                    <div className="card-glow" style={{ padding: 28, borderRadius: 28 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                <FileText size={22} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Terms & Conditions</h2>
                                <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Please review before accessing SafariPay</p>
                            </div>
                        </div>

                        {/* Terms Content */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: 20, marginBottom: 24, maxHeight: 300, overflowY: 'auto' }}>
                            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 12 }}>SafariPay User Agreement</h4>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                                <p style={{ marginBottom: 12 }}><b style={{ color: 'white' }}>1. Account Responsibility</b><br />
                                    You are solely responsible for maintaining the security of your account credentials, including your PIN and recovery phrases.</p>
                                <p style={{ marginBottom: 12 }}><b style={{ color: 'white' }}>2. Non-Custodial Wallet</b><br />
                                    SafariPay is a non-custodial platform. Your private keys are encrypted locally and SafariPay does not have access to your funds.</p>
                                <p style={{ marginBottom: 12 }}><b style={{ color: 'white' }}>3. KYC Compliance</b><br />
                                    To access full platform features including loans and international transfers, identity verification (KYC) is required by local regulations.</p>
                                <p style={{ marginBottom: 12 }}><b style={{ color: 'white' }}>4. Transaction Fees</b><br />
                                    A 0.5% fee applies to all transfers. Fees are transparently displayed before each transaction confirmation.</p>
                                <p style={{ marginBottom: 12 }}><b style={{ color: 'white' }}>5. Privacy Policy</b><br />
                                    We collect minimal personal data and never share your financial information with third parties without your explicit consent.</p>
                                <p style={{ marginBottom: 0 }}><b style={{ color: 'white' }}>6. Risk Disclaimer</b><br />
                                    Cryptocurrency values may fluctuate. SafariPay is not responsible for market-driven changes in your asset portfolio value.</p>
                            </div>
                        </div>

                        {/* Accept Checkbox */}
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 14, cursor: 'pointer', marginBottom: 28, padding: '16px', background: termsAccepted ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${termsAccepted ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 16, transition: 'all 0.3s' }}>
                            <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${termsAccepted ? '#10b981' : 'rgba(255,255,255,0.15)'}`, background: termsAccepted ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, transition: 'all 0.2s' }}>
                                {termsAccepted && <CheckCircle2 size={16} color="white" />}
                            </div>
                            <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} hidden />
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                I have read and agree to the <b style={{ color: 'white' }}>SafariPay Terms of Service</b> and <b style={{ color: 'white' }}>Privacy Policy</b>.
                            </span>
                        </label>

                        <button onClick={handleAcceptTerms} disabled={!termsAccepted || busy}
                            style={{ width: '100%', height: 60, background: termsAccepted ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 18, color: 'white', fontWeight: 700, fontSize: 16, fontFamily: 'var(--font)', cursor: termsAccepted ? 'pointer' : 'not-allowed', boxShadow: termsAccepted ? '0 8px 30px rgba(16,185,129,0.3)' : 'none', opacity: termsAccepted ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, transition: 'all 0.3s' }}>
                            {busy ? <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /> : <><span>Finish & Enter SafariPay</span> <ChevronRight size={18} /></>}
                        </button>
                    </div>
                </div>
            )}

            {/* Country Picker Modal */}
            {showCountryPicker && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div className="card-glow" style={{ width: '100%', maxWidth: 400, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: 28 }}>
                        <div style={{ padding: '20px 20px 16px' }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white', marginBottom: 16 }}>Select Country</h3>
                            <input className="input" placeholder="Search..." autoFocus
                                onChange={e => {
                                    const q = e.target.value.toLowerCase();
                                    const el = document.getElementById('onb-country-list');
                                    if (el) {
                                        const items = el.getElementsByTagName('button');
                                        for (let i = 0; i < items.length; i++) {
                                            (items[i] as HTMLElement).style.display = items[i].innerText.toLowerCase().includes(q) ? 'flex' : 'none';
                                        }
                                    }
                                }} />
                        </div>
                        <div id="onb-country-list" style={{ overflowY: 'auto', flex: 1, padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {ALL_COUNTRIES.map(c => (
                                <button key={c.code} onClick={() => { 
                                    if (step === 'document') {
                                        setDocumentCountry(c.code);
                                    } else {
                                        setCountry(c.code); 
                                    }
                                    setShowCountryPicker(false); 
                                }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: (step==='document' ? documentCountry : country) === c.code ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)', border: (step==='document' ? documentCountry : country) === c.code ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent', borderRadius: 12, color: 'white', cursor: 'pointer', textAlign: 'left' }}>
                                    <span style={{ fontSize: 22 }}>{c.flag}</span>
                                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{c.name}</span>
                                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{c.code}</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ padding: '0 20px 20px' }}>
                            <button onClick={() => setShowCountryPicker(false)} style={{ width: '100%', padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, color: 'white', fontWeight: 700, cursor: 'pointer' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

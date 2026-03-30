import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, ChevronRight } from 'lucide-react';

/**
 * KYC Verification Banner
 * Shows a persistent warning on every page for unverified users.
 * Clicking "Verify Now" navigates to the KYC verification page.
 */
export default function KycBanner() {
    const { user } = useAuth();
    const nav = useNavigate();

    // Don't show if user is verified or if no user
    if (!user) return null;
    if (user.trust_level === 'HIGH' || user.verification_status === 'verified') return null;

    return (
        <div
            onClick={() => nav('/onboarding?mode=verify')}
            style={{
                margin: '12px 20px 0',
                padding: '14px 18px',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04))',
                border: '1px solid rgba(245,158,11,0.18)',
                borderRadius: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
                animation: 'slideUp 0.4s ease both',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.18)'; e.currentTarget.style.transform = 'none'; }}
        >
            <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: 'rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#f59e0b', flexShrink: 0
            }}>
                <AlertCircle size={20} />
            </div>
            <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                    KYC Verification Required
                </p>
                <p style={{ fontSize: 11, color: 'rgba(245,158,11,0.7)', margin: 0, marginTop: 2 }}>
                    Complete verification to withdraw, send & get loans
                </p>
            </div>
            <div style={{
                background: 'rgba(245,158,11,0.15)', padding: '8px 14px', borderRadius: 10,
                fontSize: 11, fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0
            }}>
                Verify Now <ChevronRight size={12} />
            </div>
        </div>
    );
}

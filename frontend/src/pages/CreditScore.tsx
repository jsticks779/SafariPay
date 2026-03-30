import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { fmt, scoreColor } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  AlertCircle,
  CheckCircle2,
  Info,
  ChevronRight,
  Award
} from 'lucide-react';

export default function CreditScore() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const nav = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('users/score')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load credit insights'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ padding: 20 }}>
      {[250, 120, 100, 100].map((h, i) => (
        <div key={i} className="skeleton" style={{ height: h, marginBottom: 16, borderRadius: 24 }} />
      ))}
    </div>
  );

  const score = data?.score || 300;
  const grade = data?.grade || 'Building';
  const color = scoreColor(score);

  // Calculate percentage for gauge (300-850 range)
  const percentage = ((score - 300) / (850 - 300)) * 100;

  const getGradeDesc = (g: string) => {
    switch (g) {
      case 'Excellent': return 'You have exceptional credit health. You qualify for the highest limits and lowest interest rates.';
      case 'Very Good': return 'A very strong score. You are a trusted borrower with great perks.';
      case 'Good': return 'Good standing. Regular usage will help you reach the next tier.';
      case 'Fair': return 'Stable. Increase your transaction frequency to boost your score.';
      case 'Poor': return 'Below average. Make more successful transfers and pay loans on time to improve.';
      default: return 'Start building your credit history by making your first transfer or loan repayment.';
    }
  };

  return (
    <div style={{ padding: '24px 20px', paddingBottom: 120 }} className="animate-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={() => nav('/')} style={{
          width: 44, height: 44, borderRadius: 14,
          background: 'var(--glass)', border: '1px solid var(--glass-border-hi)',
          color: 'var(--white)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--white)' }}>Credit Insights</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 500 }}>SafariPay ML Trust Scoring</p>
        </div>
      </div>

      {/* Credit Gauge Card */}
      <div className="card-glow" style={{ padding: '40px 24px', textAlign: 'center', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 200, height: 200,
          background: color, filter: 'blur(100px)', opacity: 0.1, pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', width: 200, height: 120, margin: '0 auto 24px' }}>
          {/* Simplified Gauge Background */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, width: '100%', height: 100,
            border: '12px solid rgba(255,255,255,0.05)', borderRadius: '100px 100px 0 0',
            borderBottom: 'none'
          }} />
          {/* Active Gauge Arc */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, width: '100%', height: 100,
            border: `12px solid ${color}`, borderRadius: '100px 100px 0 0',
            borderBottom: 'none',
            clipPath: `inset(0 ${100 - percentage}% 0 0)`,
            transition: 'all 1s ease-out'
          }} />

          <div style={{ position: 'absolute', bottom: -10, left: 0, right: 0 }}>
            <h2 style={{ fontSize: 48, fontWeight: 800, color: 'var(--white)', letterSpacing: '-0.02em', marginBottom: 0 }}>{score}</h2>
            <p style={{ fontSize: 13, fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{grade}</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', color: 'var(--text-dim)', fontSize: 11, fontWeight: 600 }}>
          <span>300 (MIN)</span>
          <span>850 (MAX)</span>
        </div>

        <div style={{ marginTop: 32, padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)' }}>
          <p style={{ fontSize: 14, color: 'var(--white)', lineHeight: 1.5 }}>
            {getGradeDesc(grade)}
          </p>
        </div>
      </div>



      {/* Scoring Factors */}
      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)', marginBottom: 16, paddingLeft: 4 }}>How you measure up</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {data.factors.map((f: any, i: number) => (
          <div key={i} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.03)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: f.score === 'Excellent' || f.score === 'Good' ? 'var(--success)' : 'var(--warning)'
            }}>
              {f.score === 'Excellent' || f.score === 'Good' ? <CheckCircle2 size={20} /> : <Activity size={20} />}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--white)', marginBottom: 2 }}>{f.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weight: {f.weight}%</span>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--text-dim)' }} />
                <span style={{ fontSize: 11, color: f.score === 'Excellent' || f.score === 'Good' ? 'var(--success)' : 'var(--primary)', fontWeight: 600 }}>{f.score}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* History Signals */}
      <div className="row-between" style={{ marginBottom: 16, paddingLeft: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>Score History</h3>
        <Award size={20} color="var(--primary)" opacity={0.6} />
      </div>
      <div style={{ padding: '0 8px' }}>
        {data.signals.map((s: any, i: number) => (
          <div key={i} style={{
            position: 'relative', paddingLeft: 24, paddingBottom: 24,
            borderLeft: i === data.signals.length - 1 ? 'none' : '1px solid var(--glass-border)'
          }}>
            <div style={{
              position: 'absolute', left: -6.5, top: 0, width: 12, height: 12,
              borderRadius: '50%', background: 'var(--primary)', border: '2px solid var(--bg-main)'
            }} />
            <div className="row-between" style={{ marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--white)' }}>
                {s.value > 0 ? '+' : ''}{s.value} Points
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(s.recorded_at).toLocaleDateString()}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{s.description}</p>
          </div>
        ))}
      </div>

      {/* Improvement Tips */}
      <div style={{ marginTop: 20, padding: 24, background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', borderRadius: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <ShieldCheck size={24} color="var(--primary)" />
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--white)' }}>Improve your score</h3>
        </div>
        <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <li style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Use SafariPay for your daily transactions to build a consistent "Trust Signal" with our ML engine.</p>
          </li>
          <li style={{ display: 'flex', gap: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--primary)', marginTop: 6, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Repay your microloans on or before the due date to unlock higher ranks instantly.</p>
          </li>
        </ul>
        <button className="btn btn-blue" style={{ marginTop: 24 }} onClick={() => nav('/loans')}>Review Microloans</button>
      </div>
    </div>
  );
}

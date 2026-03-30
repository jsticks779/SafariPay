import React from 'react';
import axios from 'axios';
import { Smartphone, MessageSquare, Trash2, RefreshCw, Clock, Mail, ShieldCheck, ExternalLink } from 'lucide-react';

interface SmsLog {
    id: string;
    to: string;
    message: string;
    type: 'OTP' | 'TRANSACTION' | 'SYSTEM' | 'SECURITY';
    channel: 'SMS' | 'EMAIL';
    timestamp: string;
    previewUrl?: string;
}

export default function SmsDashboard() {
    const [logs, setLogs] = React.useState<SmsLog[]>([]);
    const [loading, setLoading] = React.useState(true);

    const fetchLogs = async () => {
        try {
            const { data } = await axios.get('/api/v1/system/sms-logs');
            setLogs(data);
        } catch (e) {
            console.error('Failed to fetch messages');
        } finally {
            setLoading(false);
        }
    };

    const clearLogs = async () => {
        if (!window.confirm('Clear all logs?')) return;
        try {
            await axios.delete('/api/v1/system/sms-logs');
            setLogs([]);
        } catch (e) {
            alert('Failed to clear logs');
        }
    };

    React.useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{ padding: '40px 24px', minHeight: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 16,
                            background: 'linear-gradient(135deg, var(--primary), #6366f1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <RefreshCw size={24} color="white" className={loading ? 'animate-spin' : ''} />
                        </div>
                        Messaging Hub
                    </h1>
                    <p style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>Simulated SMS & Email traffic for SafariPay Security</p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={fetchLogs} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                    <button onClick={clearLogs} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '8px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <Trash2 size={16} /> Reset
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
                {logs.length === 0 && !loading && (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#64748b', background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px dashed rgba(255,255,255,0.1)' }}>
                        <MessageSquare size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                        <p>No messages in the buffer. Try a PIN reset or registration!</p>
                    </div>
                )}

                {logs.map((log) => (
                    <div key={log.id} style={{
                        background: 'rgba(30, 41, 59, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: 20,
                        padding: 24,
                        position: 'relative',
                        overflow: 'hidden'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    background: log.channel === 'SMS' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: log.channel === 'SMS' ? '#3b82f6' : '#a855f7'
                                }}>
                                    {log.channel === 'SMS' ? <Smartphone size={20} /> : <Mail size={20} />}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{
                                            fontSize: 9,
                                            fontWeight: 800,
                                            letterSpacing: '0.1em',
                                            textTransform: 'uppercase',
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            background: log.type === 'OTP' ? '#f59e0b' : log.type === 'SECURITY' ? '#ef4444' : log.type === 'TRANSACTION' ? '#10b981' : '#60a5fa',
                                            color: '#fff',
                                        }}>
                                            {log.type}
                                        </span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: log.channel === 'SMS' ? '#3b82f6' : '#a855f7', opacity: 0.8 }}>
                                            {log.channel} CHANNEL
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc' }}>
                                        {log.channel === 'EMAIL' ? 'User Email: ' : 'Phone: '}
                                        <span style={{ color: 'var(--primary)' }}>{log.to}</span>
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 12 }}>
                                <Clock size={14} /> {new Date(log.timestamp).toLocaleTimeString()}
                            </div>
                        </div>

                        <div style={{
                            background: 'rgba(15, 23, 42, 0.4)',
                            padding: 16,
                            borderRadius: 14,
                            color: '#cbd5e1',
                            fontSize: 14,
                            lineHeight: 1.6,
                            border: '1px solid rgba(255,255,255,0.02)',
                            fontFamily: log.type === 'OTP' ? 'monospace' : 'inherit',
                            position: 'relative'
                        }}>
                            {log.message}

                            {log.previewUrl && (
                                <a
                                    href={log.previewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        marginTop: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        color: '#10b981',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        textDecoration: 'none',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        padding: '6px 12px',
                                        borderRadius: 8,
                                        width: 'fit-content',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                                >
                                    <ExternalLink size={14} /> View Real Email Preview
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        .animate-fade { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
        </div>
    );
}

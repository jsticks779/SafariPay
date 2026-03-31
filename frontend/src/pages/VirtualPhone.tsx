import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { 
  Wifi, 
  Battery, 
  MessageCircle, 
  Mail, 
  ChevronLeft, 
  Send,
  MoreVertical,
  Bell,
  CheckCircle2,
  Lock,
  Smartphone,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

interface MessageLog {
    id: string;
    to: string;
    message: string;
    type: 'OTP' | 'TRANSACTION' | 'SYSTEM' | 'SECURITY' | 'STK_PUSH';
    channel: 'SMS' | 'EMAIL' | 'PUSH';
    timestamp: string;
    amount?: number;
    provider?: string;
}

export default function VirtualPhone() {
    const { phone } = useParams();
    const nav = useNavigate();
    const [messages, setMessages] = useState<MessageLog[]>([]);
    const [activeTab, setActiveTab] = useState<'lock' | 'sms' | 'email'>('lock');
    const [showStk, setShowStk] = useState<MessageLog | null>(null);
    const [lastMsgCount, setLastMsgCount] = useState(0);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const { data } = await api.get(`/system/sms-logs/${phone}`);
                setMessages(data);
                
                // 📱 Better simulation: Check ALL new messages for an STK Push
                if (data.length > lastMsgCount) {
                    const newMessages = data.slice(0, data.length - lastMsgCount);
                    const stkMsg = newMessages.find(m => m.type === 'STK_PUSH');
                    
                    if (stkMsg) {
                        setShowStk(stkMsg);
                    } else if (newMessages.some(m => m.channel === 'SMS' || m.channel === 'EMAIL')) {
                        toast(`New Notification Received!`, { icon: '🔔' });
                    }
                    setLastMsgCount(data.length);
                }
            } catch (e) {
                console.error("Failed to fetch logs", e);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 3000);
        return () => clearInterval(interval);
    }, [phone, lastMsgCount]);

    const formatTime = (ts: string) => {
        const d = new Date(ts);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const smsMessages = messages.filter(m => m.channel === 'SMS');
    const emailMessages = messages.filter(m => m.channel === 'EMAIL');

    const getIconColor = (tab: typeof activeTab) => {
        if (activeTab === tab) {
            return tab === 'sms' ? '#22c55e' : '#3b82f6';
        }
        return activeTab === 'lock' ? 'white' : '#64748b';
    };

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: '#04070d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            color: 'white',
            fontFamily: 'Inter, sans-serif'
        }}>

            {/* Phone Frame */}
            <div style={{
                width: 320,
                height: 650,
                background: '#000',
                borderRadius: 50,
                border: '12px solid #222',
                boxShadow: '0 50px 100px -20px rgba(0,0,0,0.5), 0 0 0 2px #444',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Notch */}
                <div style={{ 
                    position: 'absolute', 
                    top: 0, left: '50%', 
                    transform: 'translateX(-50%)',
                    width: 140, height: 25, 
                    background: '#222', 
                    borderBottomLeftRadius: 18, 
                    borderBottomRightRadius: 18,
                    zIndex: 100 
                }} />

                {/* Status Bar */}
                <div style={{ 
                    padding: '14px 24px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    zIndex: 90
                }}>
                    <span>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Wifi size={14} />
                        <Battery size={14} />
                    </div>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    
                    {/* Lock Screen */}
                    {activeTab === 'lock' && (
                        <div className="animate-fade" style={{ 
                            height: '100%', 
                            display: 'flex', 
                            flexDirection: 'column',
                            padding: 20,
                            background: 'url(https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop) center center / cover'
                        }}>
                            <div style={{ textAlign: 'center', marginTop: 40, marginBottom: 'auto' }}>
                                <h2 style={{ fontSize: 64, fontWeight: 300, margin: 0 }}>
                                    {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}).split(' ')[0]}
                                </h2>
                                <p style={{ fontSize: 18, opacity: 0.8 }}>{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric'})}</p>
                            </div>

                            {/* Notifications List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                                {messages.slice(0, 3).map(msg => (
                                    <div key={msg.id} style={{ 
                                        padding: 14, 
                                        background: 'rgba(255,255,255,0.15)', 
                                        backdropFilter: 'blur(20px)',
                                        borderRadius: 18,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        display: 'flex', 
                                        gap: 12 
                                    }}>
                                        <div style={{ 
                                            width: 36, height: 36, borderRadius: 10, 
                                            background: msg.channel === 'SMS' ? '#22c55e' : '#3b82f6',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            {msg.channel === 'SMS' ? <MessageCircle size={20} /> : <Mail size={20} />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700 }}>{msg.channel === 'SMS' ? 'Messenger' : 'Mail'}</span>
                                                <span style={{ fontSize: 10, opacity: 0.6 }}>now</span>
                                            </div>
                                            <p style={{ fontSize: 12, margin: 0, opacity: 0.9, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {msg.message}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginTop: 'auto', textAlign: 'center', paddingBottom: 20 }}>
                                <div style={{ 
                                    width: 50, height: 50, borderRadius: '50%', 
                                    background: 'rgba(255,255,255,0.2)', 
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: 10
                                }}>
                                    <Lock size={20} />
                                </div>
                                <p style={{ fontSize: 12, opacity: 0.6 }}>Swipe up to open</p>
                                <div style={{ width: 120, height: 5, background: 'white', borderRadius: 10, margin: '10px auto 0', opacity: 0.5 }} />
                            </div>
                        </div>
                    )}

                    {/* App: SMS */}
                    {activeTab === 'sms' && (
                        <div className="animate-fade" style={{ height: '100%', background: '#f8fafc', color: '#1e293b', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '40px 20px 15px', background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 15 }}>
                                <ChevronLeft size={24} onClick={() => setActiveTab('lock')} style={{ cursor: 'pointer' }} />
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: 0, fontSize: 16 }}>SafariPay Service</h3>
                                    <span style={{ fontSize: 11, color: '#64748b' }}>Official Channel</span>
                                </div>
                                <MoreVertical size={20} color="#64748b" />
                            </div>
                            
                            <div style={{ flex: 1, padding: 15, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', gap: 15 }}>
                                {[...smsMessages].reverse().map(msg => (
                                    <div key={msg.id} style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                                        <div style={{ 
                                            background: '#e2e8f0', 
                                            padding: '10px 14px', 
                                            borderRadius: '18px 18px 18px 4px',
                                            fontSize: 13,
                                            lineHeight: 1.4
                                        }}>
                                            {msg.message}
                                        </div>
                                        <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, display: 'block' }}>{formatTime(msg.timestamp)}</span>
                                    </div>
                                ))}
                                <div style={{ textAlign: 'center', margin: '20px 0' }}>
                                    <span style={{ fontSize: 11, background: '#f1f5f9', padding: '4px 10px', borderRadius: 10, color: '#64748b' }}>
                                        Encryption Active
                                    </span>
                                </div>
                            </div>

                            <div style={{ padding: 15, background: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 10 }}>
                                <div style={{ flex: 1, height: 40, background: '#f1f5f9', borderRadius: 20, padding: '0 15px', display: 'flex', alignItems: 'center', fontSize: 13, color: '#94a3b8' }}>
                                    Text Message
                                </div>
                                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                    <Send size={18} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* App: Email */}
                    {activeTab === 'email' && (
                        <div className="animate-fade" style={{ height: '100%', background: '#fff', color: '#1e293b', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '40px 20px 15px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 15 }}>
                                <ChevronLeft size={24} onClick={() => setActiveTab('lock')} />
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Inbox</h3>
                                <div style={{ flex: 1 }} />
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>J</div>
                            </div>

                            <div style={{ flex: 1, padding: 15, overflowY: 'auto' }}>
                                {emailMessages.map(msg => (
                                    <div key={msg.id} style={{ 
                                        padding: '15px 0', 
                                        borderBottom: '1px solid #f8fafc',
                                        display: 'flex', gap: 12
                                    }}>
                                        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fef2f2', border: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                          <Smartphone size={20} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                                <span style={{ fontSize: 14, fontWeight: 700 }}>SafariPay Security</span>
                                                <span style={{ fontSize: 11, opacity: 0.5 }}>{formatTime(msg.timestamp)}</span>
                                            </div>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: '#334155', margin: '0 0 2px' }}>Security Alert: Transaction</p>
                                            <p style={{ fontSize: 12, color: '#64748b', margin: 0, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {msg.message}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STK Push Overlay */}
                    {showStk && (
                        <div style={{ 
                            position: 'absolute', 
                            top: 0, left: 0, right: 0, bottom: 0, 
                            background: 'rgba(0,0,0,0.85)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            padding: 20,
                            zIndex: 200,
                            backdropFilter: 'blur(10px)'
                        }}>
                             <div className="animate-up" style={{ 
                                 width: '100%', 
                                 background: '#f8fafc', 
                                 borderRadius: 24, 
                                 padding: 24, 
                                 color: '#1e293b',
                                 boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                                 textAlign: 'center'
                             }}>
                                 <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fef3c7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <Bell size={30} color="#d97706" />
                                 </div>
                                 <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Payment Request</h3>
                                 <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5 }}>
                                     <b>{showStk.message.includes('M-Pesa') ? 'Vodacom' : showStk.message.includes('Tigo') ? 'Tigo' : 'Network'}</b> is requesting <b>{showStk.amount?.toLocaleString()} TZS</b> for your SafariPay deposit.
                                 </p>
                                 
                                 <div style={{ margin: '24px 0' }}>
                                     <input autoFocus type="password" placeholder="ENTER SIM PIN" style={{ 
                                         width: '100%', 
                                         height: 50, 
                                         borderRadius: 14, 
                                         border: '2px solid #e2e8f0', 
                                         textAlign: 'center',
                                         fontSize: 18,
                                         letterSpacing: 8,
                                         outline: 'none'
                                     }} />
                                 </div>

                                 <div style={{ display: 'flex', gap: 10 }}>
                                     <button onClick={() => setShowStk(null)} style={{ flex: 1, height: 50, borderRadius: 14, border: '1px solid #e2e8f0', background: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                                     <button 
                                        onClick={async () => {
                                          if (!showStk) return;
                                          try {
                                              const btn = document.activeElement as HTMLButtonElement;
                                              if (btn) btn.innerText = 'Verifying...';
                                              
                                              // Link to backend confirmation logic (using provider column as txHash store)
                                              await api.post(`/system/confirm-payment/${showStk.provider}`);
                                              
                                              setTimeout(() => {
                                                  setShowStk(null);
                                                  toast.success("STK push payment successful!", { duration: 4000 });
                                              }, 1000);
                                          } catch (err) {
                                              console.error(err);
                                              toast.error("PIN Verification Failed");
                                              setShowStk(null);
                                          }
                                        }} 
                                        style={{ flex: 2, height: 50, borderRadius: 14, border: 'none', background: '#22c55e', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                                      >
                                          Pay Now
                                      </button>
                                 </div>
                             </div>
                        </div>
                    )}

                </div>

                {/* Bottom Navigation */}
                <div style={{ 
                    height: 70, 
                    background: activeTab === 'lock' ? 'transparent' : 'white', 
                    borderTop: activeTab === 'lock' ? 'none' : '1px solid #eee',
                    display: 'flex', 
                    justifyContent: 'space-around', 
                    alignItems: 'center',
                    paddingBottom: 15
                }}>
                    <button onClick={() => setActiveTab('lock')} style={{ background: 'none', border: 'none', color: getIconColor('lock') }}>
                        <Lock size={20} />
                    </button>
                    <button onClick={() => setActiveTab('sms')} style={{ background: 'none', border: 'none', color: getIconColor('sms') }}>
                        <MessageCircle size={20} />
                    </button>
                    <button onClick={() => setActiveTab('email')} style={{ background: 'none', border: 'none', color: getIconColor('email') }}>
                        <Mail size={20} />
                    </button>
                </div>

                <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 100, height: 4, background: activeTab === 'lock' ? 'white' : '#e2e8f0', borderRadius: 10, opacity: 0.5 }} />
            </div>
        </div>
    );
}

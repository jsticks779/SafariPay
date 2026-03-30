import React, { useState } from 'react';
import { ChevronDown, CheckCircle2 } from 'lucide-react';

interface Option {
    id: string;
    label: string;
}

interface SelectProps {
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    style?: React.CSSProperties;
}

export default function Select({ value, options, onChange, placeholder, style }: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selected = options.find(o => o.label === value || o.id === value);

    return (
        <div style={{ position: 'relative', width: '100%', ...style }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                type="button"
                style={{
                    width: '100%',
                    height: 52,
                    padding: '0 18px',
                    background: 'var(--glass)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                    color: value ? 'var(--white)' : 'var(--text-dim)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 15,
                    fontWeight: 500,
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--glass-border-hi)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
            >
                <span>{selected ? selected.label : (placeholder || 'Select...')}</span>
                <ChevronDown
                    size={18}
                    style={{
                        transition: 'transform 0.3s',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                        opacity: 0.5
                    }}
                />
            </button>

            {isOpen && (
                <>
                    <div
                        onClick={() => setIsOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                    />
                    <div
                        className="card-glow animate-up"
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            left: 0,
                            right: 0,
                            zIndex: 101,
                            padding: 8,
                            maxHeight: 300,
                            overflowY: 'auto',
                            background: '#0f172a', /* More solid background to prevent interference */
                            border: '1px solid var(--glass-border-hi)',
                            boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                        }}
                    >
                        {options.map(opt => {
                            const isActive = selected?.id === opt.id || selected?.label === opt.label;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => {
                                        onChange(opt.label);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px 16px',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                        color: isActive ? 'var(--primary)' : 'var(--white)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        fontSize: 14,
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        marginBottom: 4
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                    onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent'}
                                >
                                    {opt.label}
                                    {isActive && <CheckCircle2 size={16} />}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

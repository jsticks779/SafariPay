import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Send, ClipboardList, Wallet, User } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';

export default function BottomNav() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();

  const ITEMS = [
    { icon: Home, label: t('home') || 'Home', path: '/' },
    { icon: Send, label: t('send'), path: '/send' },
    { icon: ClipboardList, label: t('transactions'), path: '/transactions' },
    { icon: Wallet, label: t('loans'), path: '/loans' },
    { icon: User, label: t('profile'), path: '/profile' },
  ];
  return (
    <nav className="nav-bar">
      {ITEMS.map(item => {
        const active = pathname === item.path;
        const Icon = item.icon;
        return (
          <button key={item.path} className={`nav-item${active ? ' active' : ''}`} onClick={() => nav(item.path)}>
            <span className="nav-icon">
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

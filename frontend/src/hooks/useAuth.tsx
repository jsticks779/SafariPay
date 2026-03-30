import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';
import {
  startRegistration,
  startAuthentication
} from '@simplewebauthn/browser';

export interface User {
  id: string; phone: string; name: string; email: string;
  balance: number; reward_balance: number; credit_score: number;
  did: string; country: string; currency: string;
  trust_level: string; account_type: string;
  verification_status?: string;
  wallet_address?: string; nida_number?: string;
  fx_rate?: number;
  is_phone_verified: boolean;
  is_active: boolean;
}

interface Ctx {
  user: User | null; token: string | null;
  login: (phone: string, pin?: string) => Promise<any>;
  register: (phone: string, name: string) => Promise<any>;
  verifyOtp: (phone: string, code: string) => Promise<any>;
  setupPin: (phone: string, pin: string, name?: string, country?: string, currency?: string) => Promise<any>;
  registerBiometric: () => Promise<void>;
  loginWithBiometric: (phone: string) => Promise<void>;
  offlineLogin: (phone: string, pin: string) => Promise<boolean>;
  provision: (u: User) => void;
  forgotPin: (phone: string, newPin?: string, otp?: string) => Promise<any>;
  restoreWallet: (phone: string, mnemonic: string, newPin: string) => Promise<any>;
  requestDecentralizedRecovery: (phone: string, nida: string, otp: string, newDeviceAddress: string) => Promise<any>;
  logout: () => void;
  refresh: () => Promise<void>;
  loading: boolean;
  isOfflineMode: boolean;
}

const AuthCtx = createContext<Ctx>({} as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  const hashPin = async (pin: string) => {
    const msgUint8 = new TextEncoder().encode(pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const save = async (u: User, t: string, pin?: string) => {
    setUser(u); setToken(t);
    localStorage.setItem('sp_token', t);
    localStorage.setItem('sp_user', JSON.stringify(u));
    if (pin) {
      const hash = await hashPin(pin);
      localStorage.setItem(`sp_pin_hash_${u.phone}`, hash);
    }
  };

  const provision = (u: User) => {
    setUser(u);
    setIsOfflineMode(true);
    localStorage.setItem('sp_user', JSON.stringify(u));
  };

  const logout = () => {
    setUser(null); setToken(null);
    localStorage.removeItem('sp_token');
    localStorage.removeItem('sp_user');
  };

  const refresh = async () => {
    try {
      const res = await api.get('auth/me');
      const userData = res.data.data;
      setUser(userData);
      localStorage.setItem('sp_user', JSON.stringify(userData));
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 404) {
        logout();
      }
    }
  };

  useEffect(() => {
    const t = localStorage.getItem('sp_token');
    const u = localStorage.getItem('sp_user');
    if (t && u) {
      setToken(t);
      setUser(JSON.parse(u));
      setLoading(false); // Immediate UX for cached users
      refresh(); // Background sync
    }
    else setLoading(false);
  }, []);

  const login = async (phone: string, pin?: string) => {
    const res = await api.post('auth/login', { phone, pin });
    if (res.data.data?.token) {
      await save(res.data.data.user, res.data.data.token);
      setIsOfflineMode(false);
    }
    return res.data;
  };

  const verifyOtp = async (phone: string, code: string) => {
    const res = await api.post('auth/verify-otp', {
      phone, code,
      device_id: localStorage.getItem('sp_device_id') || 'web_client_' + Date.now()
    });
    const { phone: verifiedPhone, needs_pin_setup } = res.data.data;
    // NOTE: For improved security, we no longer save the token here.
    // Full session is only granted after the PIN verification step.
    return res.data.data;
  };

  const setupPin = async (phone: string, pin: string, name?: string, country?: string, currency?: string) => {
    const res = await api.post('auth/setup-pin', { phone, pin, name, country, currency });
    if (res.data.data?.token) {
      await save(res.data.data.user, res.data.data.token);
      setIsOfflineMode(false);
    }
    return res.data;
  };

  const registerBiometric = async () => {
    if (!user) throw new Error('User must be logged in');

    // Step 1: Get Challenge
    const res = await api.post('auth/biometric/register-challenge');
    const options = res.data.data;

    // Step 2: Invoke Browser Biometric UI
    const attResp = await startRegistration(options);

    // Step 3: Finish Registration
    await api.post('auth/biometric/register-finish', attResp);
    await refresh();
  };

  const loginWithBiometric = async (phone: string) => {
    // Step 1: Get Challenge
    const res = await api.post('auth/biometric/login-challenge', { phone });
    const { userId, ...options } = res.data.data;

    // Step 2: Biometric verification
    const attResp = await startAuthentication(options);

    // Step 3: Finish Login
    const loginRes = await api.post('auth/biometric/login-finish', {
      userId,
      body: attResp
    });

    const { user, token } = loginRes.data.data;
    await save(user, token);
    setIsOfflineMode(false);
  };

  const offlineLogin = async (phone: string, pin: string): Promise<boolean> => {
    const cachedHash = localStorage.getItem(`sp_pin_hash_${phone}`);
    if (!cachedHash) return false;

    const enteredHash = await hashPin(pin);
    if (enteredHash === cachedHash) {
      const u = localStorage.getItem('sp_user');
      if (u) {
        setUser(JSON.parse(u));
        setIsOfflineMode(true);
        return true;
      }
    }
    return false;
  };

  const register = async (phone: string, name: string) => {
    const res = await api.post('auth/register', { phone, name });
    return res.data;
  };

  const forgotPin = async (phone: string, newPin?: string, otp?: string) => {
    const res = await api.post('auth/forgot-pin', { phone, newPin, otp });
    return res.data;
  };

  const restoreWallet = async (phone: string, mnemonic: string, newPin: string) => {
    const res = await api.post('auth/restore', { phone, mnemonic, newPin });
    return res.data;
  };

  const requestDecentralizedRecovery = async (phone: string, nida: string, otp: string, newDeviceAddress: string) => {
    const res = await api.post('auth/decentralized-recovery', { phone, nida, otp, newDeviceAddress });
    return res.data;
  };


  return (
    <AuthCtx.Provider value={{
      user, token, login, register, verifyOtp, setupPin, registerBiometric, loginWithBiometric,
      offlineLogin, provision, forgotPin, restoreWallet, requestDecentralizedRecovery, logout, refresh, loading, isOfflineMode
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

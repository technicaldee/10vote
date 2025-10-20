import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type SelfVerificationResult = {
  isHumanVerified: boolean;
  ageOver18?: boolean;
  ageOver21?: boolean;
  residencyAllowed?: boolean;
  nationality?: string;
  proofToken?: string; // opaque token or JWT from Self
  source?: 'self';
  verifiedAt?: number;
};

export type SelfContextValue = {
  verification: SelfVerificationResult | null;
  verifyWithProof: (proofToken: string, meta?: Partial<SelfVerificationResult>) => void;
  logoutSelf: () => void;
};

const STORAGE_KEY = 'self_verification';

const SelfContext = createContext<SelfContextValue | null>(null);

export function SelfVerificationProvider({ children }: { children: React.ReactNode }) {
  const [verification, setVerification] = useState<SelfVerificationResult | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setVerification(parsed as SelfVerificationResult);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (verification) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(verification));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, [verification]);

  const verifyWithProof = (proofToken: string, meta?: Partial<SelfVerificationResult>) => {
    const now = Date.now();
    const base: SelfVerificationResult = {
      isHumanVerified: true,
      proofToken,
      source: 'self',
      verifiedAt: now,
      ageOver18: meta?.ageOver18 ?? true,
      ageOver21: meta?.ageOver21 ?? false,
      residencyAllowed: meta?.residencyAllowed ?? true,
      nationality: meta?.nationality,
    };
    setVerification(base);
  };

  // Auto-capture proof tokens passed via URL params
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      const params = url.searchParams;
      const token = params.get('self_jwt') || params.get('self_token') || params.get('proof') || params.get('jwt');
      if (token && !verification?.proofToken) {
        verifyWithProof(token);
        ['self_jwt', 'self_token', 'proof', 'jwt'].forEach((k) => params.delete(k));
        window.history.replaceState({}, document.title, url.toString());
      }
    } catch {}
  }, [verification?.proofToken]);

  const logoutSelf = () => setVerification(null);

  const value = useMemo<SelfContextValue>(() => ({ verification, verifyWithProof, logoutSelf }), [verification]);

  return <SelfContext.Provider value={value}>{children}</SelfContext.Provider>;
}

export function useSelf() {
  const ctx = useContext(SelfContext);
  if (!ctx) throw new Error('useSelf must be used within SelfVerificationProvider');
  return ctx;
}
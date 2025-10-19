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
  verifyDemo: (opts?: Partial<SelfVerificationResult>) => void;
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

  const verifyDemo = (opts?: Partial<SelfVerificationResult>) => {
    const now = Date.now();
    setVerification({
      isHumanVerified: true,
      source: 'self',
      verifiedAt: now,
      ageOver18: opts?.ageOver18 ?? true,
      ageOver21: opts?.ageOver21 ?? true,
      residencyAllowed: opts?.residencyAllowed ?? true,
      nationality: opts?.nationality ?? 'ZZ',
    });
  };

  const logoutSelf = () => setVerification(null);

  const value = useMemo<SelfContextValue>(() => ({ verification, verifyWithProof, verifyDemo, logoutSelf }), [verification]);

  return <SelfContext.Provider value={value}>{children}</SelfContext.Provider>;
}

export function useSelf() {
  const ctx = useContext(SelfContext);
  if (!ctx) throw new Error('useSelf must be used within SelfVerificationProvider');
  return ctx;
}
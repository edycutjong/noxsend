'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from './ConnectButton';

const NAV = [
  { href: '/', label: 'Send' },
  { href: '/claim', label: 'Claim' },
  { href: '/verify', label: 'Verify' },
];

export function TopBar() {
  const path = usePathname();
  return (
    <header className="flex items-center justify-between gap-4 py-5">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <LockPlane />
          <span className="font-display text-xl font-bold tracking-tight brand-gradient">NoxSend</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map((n) => {
            const active = path === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${active ? 'bg-white/10 text-hi' : 'text-mid hover:text-hi'}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <ConnectButton />
    </header>
  );
}

function LockPlane() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <path d="M3 11l18-7-7 18-2.5-7.5L3 11z" stroke="url(#g)" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="9.4" y="10.2" width="5.2" height="4" rx="1" stroke="url(#g)" strokeWidth="1.2" />
      <path d="M10.6 10.2v-1a1.4 1.4 0 012.8 0v1" stroke="url(#g)" strokeWidth="1.2" />
    </svg>
  );
}

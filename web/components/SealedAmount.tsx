'use client';

export function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="10.5" width="16" height="10.5" rx="2" fill="currentColor" opacity="0.85" />
      <path d="M7.5 10.5V8a4.5 4.5 0 019 0v2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function SealedAmount({
  value,
  loading,
  symbol = 'cUSD',
  format,
}: {
  value: bigint | null;
  loading?: boolean;
  symbol?: string;
  format: (v: bigint) => string;
}) {
  if (loading) {
    return (
      <span className="pill-sealed animate-shimmer">
        <LockIcon /> decrypting…
      </span>
    );
  }
  if (value === null) {
    return (
      <span className="pill-sealed animate-shimmer">
        <LockIcon /> •••• {symbol}
      </span>
    );
  }
  return (
    <span className="animate-unseal font-mono text-2xl font-semibold text-hi tabular-nums">
      {format(value)}
    </span>
  );
}

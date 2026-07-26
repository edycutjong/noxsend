import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#07060F',
        panel: '#0B1220',
        primary: { DEFAULT: '#14B8A6', bright: '#5EEAD4', deep: '#0D9488' },
        accent: { DEFAULT: '#8B5CF6', bright: '#A78BFA' },
        cyan: { edge: '#22D3EE' },
        hi: '#F8FAFC',
        mid: '#94A3B8',
        low: '#475569',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(20,184,166,0.35), 0 0 80px rgba(0,0,0,0.5)',
        'glow-violet': '0 0 40px rgba(139,92,246,0.35)',
      },
      keyframes: {
        shimmer: { '0%,100%': { opacity: '0.55' }, '50%': { opacity: '1' } },
        unseal: { '0%': { filter: 'blur(6px)', opacity: '0.3' }, '100%': { filter: 'blur(0)', opacity: '1' } },
      },
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
        unseal: 'unseal 400ms ease-out',
      },
    },
  },
  plugins: [],
};
export default config;

import type { Metadata } from 'next';
import { Space_Grotesk, Manrope } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { TopBar } from '@/components/TopBar';

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-display', display: 'swap' });
const body = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });

const TITLE = 'NoxSend — private send for the wallet you already have';
const DESCRIPTION =
  'Send tokens from your existing MetaMask with the amount encrypted end-to-end via iExec Nox (ERC-7984, Intel TDX). Live on Sepolia.';

export const metadata: Metadata = {
  metadataBase: new URL('https://noxsend.edycu.dev'),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: 'https://noxsend.edycu.dev',
    siteName: 'NoxSend',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'NoxSend' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 sm:px-6">
            <TopBar />
            <main className="flex-1 py-6">{children}</main>
            <footer className="border-t border-white/10 py-6 text-center text-xs text-mid">
              NoxSend · amount-privacy only (addresses public) · beta SDK · live on Ethereum Sepolia ·
              wallet &amp; USDC unmodified · v{process.env.NEXT_PUBLIC_APP_VERSION}
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}

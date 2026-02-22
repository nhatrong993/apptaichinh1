import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
    subsets: ['latin', 'vietnamese'],
    variable: '--font-inter',
    display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Crypto Trend Hunter — AI Agent Dashboard 2026',
    description: 'Real-time AI-Agent driven crypto trend scanner. Track trending coins from DexScreener, Google Trends, Twitter/X and Binance with cyberpunk UI.',
    keywords: ['crypto', 'trend', 'AI agent', 'DexScreener', 'Binance', 'trading'],
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#000000',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="vi" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
            <body className={`${inter.className} antialiased`}>{children}</body>
        </html>
    );
}

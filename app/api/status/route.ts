import { NextResponse } from 'next/server';
import { isTwitterAvailable } from '@/lib/services/twitter';

export const dynamic = 'force-dynamic';

/**
 * API Health Check — kiểm tra trạng thái kết nối của tất cả services
 * GET /api/status
 */
export async function GET() {
    const status: Record<string, any> = {
        timestamp: new Date().toISOString(),
        services: {},
    };

    // 1. CoinGecko
    try {
        const cgKey = process.env.COINGECKO_API_KEY;
        const cgBaseUrl = cgKey
            ? 'https://pro-api.coingecko.com/api/v3'
            : 'https://api.coingecko.com/api/v3';

        const headers: Record<string, string> = { Accept: 'application/json' };
        if (cgKey) headers['x-cg-demo-api-key'] = cgKey;

        const res = await fetch(`${cgBaseUrl}/ping`, { headers });
        const data = await res.json();

        status.services.coingecko = {
            status: res.ok ? 'connected' : 'error',
            hasApiKey: !!cgKey,
            response: data,
        };
    } catch (error) {
        status.services.coingecko = {
            status: 'unreachable',
            error: error instanceof Error ? error.message : 'Unknown',
        };
    }

    // 2. Google Trends
    try {
        let googleTrends = null;
        try {
            googleTrends = require('google-trends-api');
        } catch { /* not installed */ }

        status.services.googleTrends = {
            status: googleTrends ? 'available' : 'not_installed',
            note: googleTrends
                ? 'Package google-trends-api detected — no API key needed'
                : 'Chạy: npm install google-trends-api',
        };
    } catch {
        status.services.googleTrends = { status: 'error' };
    }

    // 3. Twitter/X
    status.services.twitter = {
        status: isTwitterAvailable() ? 'configured' : 'not_configured',
        hasBearerToken: isTwitterAvailable(),
        note: isTwitterAvailable()
            ? 'Bearer Token configured'
            : 'Set TWITTER_BEARER_TOKEN in .env.local (requires Basic tier $200/month)',
    };

    return NextResponse.json(status, {
        headers: { 'Cache-Control': 'no-store' },
    });
}

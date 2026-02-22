import { NextResponse } from 'next/server';
import { getBinanceAlphaTokens, getAlphaTokensWithMarketData } from '@/lib/services/binance-alpha';
import { CryptoCoin } from '@/types/crypto';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 600; // 10 phút

/**
 * Chuyển đổi AlphaTokenWithMarket → CryptoCoin format
 */
function alphaTokenToCryptoCoin(token: any, idx: number): CryptoCoin {
    const change = token.change24h || 0;
    const aiSentiment = change > 10 ? 'Bullish' as const
        : change < -10 ? 'Bearish' as const
            : 'Neutral' as const;

    return {
        id: token.contractAddress || `alpha-${idx}`,
        name: token.name,
        symbol: token.symbol,
        price: token.price || 0,
        change4h: parseFloat(change.toFixed(2)),
        trendSource: ['Binance'],
        trendScore: Math.max(50, 90 - idx * 3),
        sparklineData: token.sparklineData?.length > 0
            ? token.sparklineData
            : Array.from({ length: 9 }, () => (token.price || 0.001) * (0.9 + Math.random() * 0.2)),
        summary: `🔶 Binance Alpha Token\n${token.name} (${token.symbol}) — Chain: ${token.chain || 'BSC'}\nContract: ${token.contractAddress?.slice(0, 10)}...${token.contractAddress?.slice(-6) || ''}\n${token.price > 0 ? `Giá: $${token.price < 0.01 ? token.price.toFixed(8) : token.price.toFixed(4)}` : 'Chưa có data giá'}`,
        exchange: `Alpha (${token.chain || 'BSC'})`,
        aiSentiment,
        newsType: 'Rumor',
        hasWhaleAlert: token.volume24h > 500_000,
        marketCapSize: token.marketCap > 100_000_000 ? 7
            : token.marketCap > 10_000_000 ? 5
                : token.marketCap > 1_000_000 ? 3
                    : 1,
    };
}

export async function GET() {
    try {
        // Thử lấy full data (Binance Alpha + CoinGecko enrichment)
        const alphaTokens = await getAlphaTokensWithMarketData();

        if (alphaTokens.length > 0) {
            const coins = alphaTokens.map(alphaTokenToCryptoCoin);

            // Cache vào file
            const cachePath = path.join(process.cwd(), 'data', 'alpha_binance.json');
            await fs.writeFile(cachePath, JSON.stringify(coins, null, 2), 'utf-8').catch(() => { });

            return NextResponse.json(coins, {
                headers: {
                    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
                    'X-Data-Source': 'live-binance-alpha',
                    'X-Token-Count': String(coins.length),
                },
            });
        }

        // Fallback 1: Chỉ lấy token list (không có market data)
        const basicTokens = await getBinanceAlphaTokens();
        if (basicTokens.length > 0) {
            const coins = basicTokens.slice(0, 15).map((t, i) => alphaTokenToCryptoCoin({ ...t, price: 0, change24h: 0, sparklineData: [], marketCap: 0, volume24h: 0 }, i));

            return NextResponse.json(coins, {
                headers: {
                    'X-Data-Source': 'binance-alpha-basic',
                },
            });
        }

        // Fallback 2: cached file
        try {
            const cachePath = path.join(process.cwd(), 'data', 'alpha_binance.json');
            const content = await fs.readFile(cachePath, 'utf-8');
            return NextResponse.json(JSON.parse(content), {
                headers: { 'X-Data-Source': 'cached-file' },
            });
        } catch {
            return NextResponse.json([], { status: 200 });
        }
    } catch (error) {
        console.error('[API /alpha-binance] Error:', error);
        return NextResponse.json([], { status: 200 });
    }
}

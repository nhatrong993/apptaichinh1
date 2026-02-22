import { NextResponse } from 'next/server';
import { getAggregatedTrendingCoins } from '@/lib/services/aggregator';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Revalidate mỗi 5 phút

export async function GET() {
    try {
        // Thử lấy data real-time từ aggregator (CoinGecko + Google Trends + Twitter)
        const coins = await getAggregatedTrendingCoins();

        if (coins.length > 0) {
            return NextResponse.json(coins, {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                    'X-Data-Source': 'live-api',
                },
            });
        }

        // Fallback: đọc từ static cache file
        console.warn('[API /trending] Live data empty — using cached file');
        const filePath = path.join(process.cwd(), 'data', 'coins.json');
        const fileContent = await fs.readFile(filePath, 'utf-8').catch(() => '[]');
        const cachedCoins = JSON.parse(fileContent);

        return NextResponse.json(Array.isArray(cachedCoins) ? cachedCoins : [], {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
                'X-Data-Source': 'cached-file',
            },
        });
    } catch (error) {
        console.error('[API /trending] Error:', error);

        // Ultimate fallback: trả về static data
        try {
            const filePath = path.join(process.cwd(), 'data', 'coins.json');
            const content = await fs.readFile(filePath, 'utf-8');
            return NextResponse.json(JSON.parse(content), {
                headers: { 'X-Data-Source': 'fallback-file' },
            });
        } catch {
            return NextResponse.json([], { status: 200 });
        }
    }
}

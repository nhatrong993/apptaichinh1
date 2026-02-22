import { NextResponse } from 'next/server';
import { getBreakingNews } from '@/lib/services/aggregator';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 phút

export async function GET() {
    try {
        const news = await getBreakingNews();

        return NextResponse.json(news, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                'X-Data-Source': news.length > 0 ? 'live-api' : 'empty',
            },
        });
    } catch (error) {
        console.error('[API /breaking-news] Error:', error);
        return NextResponse.json([], { status: 200 });
    }
}

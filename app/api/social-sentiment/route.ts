import { NextResponse } from 'next/server';
import { getAggregatedSocialSentiment } from '@/lib/services/aggregator';

export const dynamic = 'force-dynamic';
export const revalidate = 600; // 10 phút

export async function GET() {
    try {
        const sentiment = await getAggregatedSocialSentiment();

        if (sentiment.length > 0) {
            return NextResponse.json(sentiment, {
                headers: {
                    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
                    'X-Data-Source': 'live-api',
                },
            });
        }

        // Fallback: hardcoded defaults
        return NextResponse.json([
            { hashtag: '#Bitcoin', mentions: 0, sentiment: 'Neutral' },
            { hashtag: '#Ethereum', mentions: 0, sentiment: 'Neutral' },
            { hashtag: '#Solana', mentions: 0, sentiment: 'Neutral' },
        ], {
            headers: { 'X-Data-Source': 'fallback' },
        });
    } catch (error) {
        console.error('[API /social-sentiment] Error:', error);
        return NextResponse.json([], { status: 200 });
    }
}

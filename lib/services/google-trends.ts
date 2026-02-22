/**
 * Google Trends Service
 *
 * Sử dụng package `google-trends-api` (npm install google-trends-api)
 * Không cần API key — package này truy vấn trực tiếp Google Trends
 *
 * Chức năng:
 *   - dailyTrends: Lấy xu hướng tìm kiếm hot nhất mỗi ngày
 *   - interestOverTime: Mức độ quan tâm theo thời gian cho keyword
 *   - relatedQueries: Các từ khoá liên quan
 */

// google-trends-api không có TypeScript declarations, dùng require
// eslint-disable-next-line @typescript-eslint/no-var-requires
let googleTrends: any = null;

try {
    googleTrends = require('google-trends-api');
} catch {
    console.warn('[GoogleTrends] Package google-trends-api chưa được cài đặt. Chạy: npm install google-trends-api');
}

export interface TrendingSearch {
    title: string;
    formattedTraffic: string; // e.g. "500K+"
    relatedQueries: string[];
    source: string;
    timeAgo: string;
}

export interface InterestDataPoint {
    time: string;
    value: number;
    formattedTime: string;
}

export interface CryptoTrendData {
    keyword: string;
    interestScore: number; // 0-100 (Google Trends score)
    isRising: boolean;
    relatedTopics: string[];
}

/**
 * Lấy Daily Trending Searches (xu hướng tìm kiếm phổ biến nhất trong ngày)
 * Có thể filter theo geo (quốc gia)
 */
export async function getDailyTrends(geo = 'US'): Promise<TrendingSearch[]> {
    if (!googleTrends) {
        console.warn('[GoogleTrends] Service unavailable — package not installed');
        return [];
    }

    try {
        const results = await googleTrends.dailyTrends({
            trendDate: new Date(),
            geo: geo,
        });

        const parsed = JSON.parse(results);

        if (!parsed?.default?.trendingSearchesDays?.[0]?.trendingSearches) {
            return [];
        }

        const searches = parsed.default.trendingSearchesDays[0].trendingSearches;

        return searches.slice(0, 20).map((search: any) => ({
            title: search.title?.query || 'Unknown',
            formattedTraffic: search.formattedTraffic || '0',
            relatedQueries: (search.relatedQueries || []).map((q: any) => q.query || ''),
            source: search.articles?.[0]?.source || 'Google',
            timeAgo: search.articles?.[0]?.timeAgo || '',
        }));
    } catch (error) {
        console.error('[GoogleTrends] Error fetching daily trends:', error);
        return [];
    }
}

/**
 * Lấy mức độ quan tâm (interest over time) cho danh sách crypto keywords
 * Trả về score 0-100 cho mỗi keyword
 */
export async function getCryptoInterest(
    keywords: string[],
    timeRange = 'now 7-d'
): Promise<CryptoTrendData[]> {
    if (!googleTrends) {
        console.warn('[GoogleTrends] Service unavailable — package not installed');
        return [];
    }

    // Google Trends chỉ cho phép tối đa 5 keywords cùng lúc
    const batch = keywords.slice(0, 5);

    try {
        const results = await googleTrends.interestOverTime({
            keyword: batch,
            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 ngày trước
            endTime: new Date(),
            geo: '', // worldwide
        });

        const parsed = JSON.parse(results);

        if (!parsed?.default?.timelineData) {
            return batch.map(kw => ({
                keyword: kw,
                interestScore: 0,
                isRising: false,
                relatedTopics: [],
            }));
        }

        const timeline = parsed.default.timelineData;

        // Lấy điểm trung bình và trend direction cho mỗi keyword
        return batch.map((keyword, kwIdx) => {
            const values = timeline.map((point: any) => {
                const val = point.value?.[kwIdx];
                return typeof val === 'number' ? val : 0;
            });

            const avgScore = values.length > 0
                ? Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length)
                : 0;

            // So sánh nửa đầu vs nửa cuối để xác định trending up/down
            const mid = Math.floor(values.length / 2);
            const firstHalf = values.slice(0, mid);
            const secondHalf = values.slice(mid);
            const firstAvg = firstHalf.length > 0
                ? firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length
                : 0;
            const secondAvg = secondHalf.length > 0
                ? secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length
                : 0;

            return {
                keyword,
                interestScore: avgScore,
                isRising: secondAvg > firstAvg,
                relatedTopics: [],
            };
        });
    } catch (error) {
        console.error('[GoogleTrends] Error fetching interest data:', error);
        return batch.map(kw => ({
            keyword: kw,
            interestScore: 0,
            isRising: false,
            relatedTopics: [],
        }));
    }
}

/**
 * Lấy related queries cho một keyword crypto
 * Useful để biết người dùng đang search gì liên quan
 */
export async function getRelatedQueries(keyword: string): Promise<string[]> {
    if (!googleTrends) return [];

    try {
        const results = await googleTrends.relatedQueries({
            keyword: keyword,
            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endTime: new Date(),
        });

        const parsed = JSON.parse(results);
        const rising = parsed?.default?.rankedList?.[1]?.rankedKeyword || [];

        return rising.slice(0, 10).map((item: any) => item.query || '');
    } catch (error) {
        console.error('[GoogleTrends] Error fetching related queries:', error);
        return [];
    }
}

/**
 * Kiểm tra xem một crypto keyword có đang trending trên Google không
 * Trả về combined score từ interestOverTime
 */
export async function isCryptoTrending(symbol: string): Promise<{
    isTrending: boolean;
    score: number;
}> {
    const searchTerms = [`${symbol} crypto`, `${symbol} coin`];

    try {
        const results = await getCryptoInterest(searchTerms);
        const maxScore = Math.max(...results.map(r => r.interestScore), 0);

        return {
            isTrending: maxScore > 50,
            score: maxScore,
        };
    } catch {
        return { isTrending: false, score: 0 };
    }
}

/**
 * Lấy danh sách crypto-related daily trends
 * Filter từ daily trends chỉ giữ lại những mục liên quan đến crypto
 */
export async function getCryptoDailyTrends(): Promise<TrendingSearch[]> {
    const cryptoKeywords = [
        'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol',
        'binance', 'coinbase', 'defi', 'nft', 'blockchain', 'token',
        'altcoin', 'memecoin', 'airdrop', 'whale', 'dex', 'cex',
        'staking', 'mining', 'web3', 'metaverse', 'ai agent',
    ];

    try {
        const trends = await getDailyTrends('US');

        // Filter: giữ lại trend nào có chứa crypto keywords
        const cryptoTrends = trends.filter(trend => {
            const titleLower = trend.title.toLowerCase();
            const queriesLower = trend.relatedQueries.map(q => q.toLowerCase());
            const allText = [titleLower, ...queriesLower].join(' ');

            return cryptoKeywords.some(kw => allText.includes(kw));
        });

        return cryptoTrends;
    } catch (error) {
        console.error('[GoogleTrends] Error fetching crypto daily trends:', error);
        return [];
    }
}

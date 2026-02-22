/**
 * Twitter/X API v2 Service
 *
 * Yêu cầu: TWITTER_BEARER_TOKEN trong .env.local
 * Free tier: ~100 reads/tháng (gần như vô dụng)
 * Basic tier: $200/tháng — unlimited reads, search recent tweets (7 ngày)
 *
 * Nếu không có Bearer Token, service sẽ gracefully return empty arrays.
 *
 * Endpoints:
 *   - /2/tweets/search/recent — Search tweets gần đây (7 ngày)
 *   - /2/tweets/counts/recent — Đếm số tweets matching query
 */

const TWITTER_API_BASE = 'https://api.twitter.com';

export interface TwitterMention {
    hashtag: string;
    mentions: number;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    recentTweets: {
        id: string;
        text: string;
        authorUsername: string;
        createdAt: string;
        likeCount: number;
        retweetCount: number;
    }[];
}

export interface TwitterTrendingTopic {
    query: string;
    tweetCount: number;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
}

/**
 * Kiểm tra xem Twitter API có available không
 */
function getBearer(): string | null {
    const token = process.env.TWITTER_BEARER_TOKEN;
    if (!token || token.trim() === '') {
        return null;
    }
    return token.trim();
}

/**
 * Fetch wrapper cho Twitter API
 */
async function twitterFetch(endpoint: string): Promise<Response | null> {
    const bearer = getBearer();
    if (!bearer) {
        console.warn('[Twitter] No Bearer Token configured — skipping Twitter API call');
        return null;
    }

    try {
        const response = await fetch(`${TWITTER_API_BASE}${endpoint}`, {
            headers: {
                'Authorization': `Bearer ${bearer}`,
                'Content-Type': 'application/json',
            },
            next: { revalidate: 600 }, // Cache 10 phút
        });

        if (response.status === 401) {
            console.error('[Twitter] Invalid Bearer Token');
            return null;
        }

        if (response.status === 429) {
            console.warn('[Twitter] Rate limited');
            return null;
        }

        if (!response.ok) {
            console.error(`[Twitter] API Error: ${response.status} ${response.statusText}`);
            return null;
        }

        return response;
    } catch (error) {
        console.error('[Twitter] Network error:', error);
        return null;
    }
}

/**
 * Heuristic phân tích sentiment đơn giản từ text
 * (Trong thực tế nên dùng NLP/LLM — đây là phiên bản cơ bản)
 */
function analyzeSentiment(text: string): 'Bullish' | 'Bearish' | 'Neutral' {
    const lowerText = text.toLowerCase();

    const bullishWords = [
        'moon', 'pump', 'bullish', 'buy', 'long', 'rocket', '🚀', '💎',
        'ath', 'all time high', 'breakout', 'going up', 'to the moon',
        'gem', 'alpha', 'undervalued', 'accumulate', 'hold', 'hodl',
        'lên', 'tăng', 'mua', 'bùng nổ',
    ];

    const bearishWords = [
        'dump', 'crash', 'bearish', 'sell', 'short', 'rugpull', 'rug',
        'scam', 'ponzi', 'red', 'drop', 'falling', 'liquidation',
        'fud', 'overvalued', 'bubble', 'dead', 'rip',
        'giảm', 'bán', 'sụp', 'lừa đảo',
    ];

    let bullishScore = 0;
    let bearishScore = 0;

    for (const word of bullishWords) {
        if (lowerText.includes(word)) bullishScore++;
    }
    for (const word of bearishWords) {
        if (lowerText.includes(word)) bearishScore++;
    }

    if (bullishScore > bearishScore) return 'Bullish';
    if (bearishScore > bullishScore) return 'Bearish';
    return 'Neutral';
}

/**
 * Search recent tweets cho một crypto hashtag/keyword
 * Trả về số lượng mentions và sample tweets
 */
export async function searchCryptoMentions(
    query: string,
    maxResults = 10
): Promise<TwitterMention | null> {
    // Build search query — filter retweets, chỉ lấy English
    const searchQuery = `${query} crypto -is:retweet lang:en`;

    const params = new URLSearchParams({
        query: searchQuery,
        max_results: String(Math.min(maxResults, 100)),
        'tweet.fields': 'created_at,public_metrics,text',
        'user.fields': 'username',
        expansions: 'author_id',
    });

    const response = await twitterFetch(`/2/tweets/search/recent?${params.toString()}`);
    if (!response) return null;

    try {
        const data = await response.json();

        if (!data?.data || !Array.isArray(data.data)) {
            return {
                hashtag: query,
                mentions: 0,
                sentiment: 'Neutral',
                recentTweets: [],
            };
        }

        // Map author IDs to usernames
        const users = new Map<string, string>();
        if (data.includes?.users) {
            for (const user of data.includes.users) {
                users.set(user.id, user.username);
            }
        }

        const tweets = data.data.map((tweet: any) => ({
            id: tweet.id,
            text: tweet.text,
            authorUsername: users.get(tweet.author_id) || 'unknown',
            createdAt: tweet.created_at,
            likeCount: tweet.public_metrics?.like_count || 0,
            retweetCount: tweet.public_metrics?.retweet_count || 0,
        }));

        // Analyze overall sentiment từ tất cả tweets
        const allText = tweets.map((t: any) => t.text).join(' ');
        const sentiment = analyzeSentiment(allText);

        return {
            hashtag: query,
            mentions: data.meta?.result_count || tweets.length,
            sentiment,
            recentTweets: tweets,
        };
    } catch (error) {
        console.error('[Twitter] Error parsing response:', error);
        return null;
    }
}

/**
 * Đếm số tweets về một crypto topic trong 7 ngày qua
 * (Cần Basic tier $200/mo trở lên)
 */
export async function countTweets(query: string): Promise<number> {
    const searchQuery = `${query} crypto -is:retweet`;

    const params = new URLSearchParams({
        query: searchQuery,
        granularity: 'day',
    });

    const response = await twitterFetch(`/2/tweets/counts/recent?${params.toString()}`);
    if (!response) return 0;

    try {
        const data = await response.json();

        if (!data?.data || !Array.isArray(data.data)) return 0;

        return data.data.reduce((total: number, day: any) => {
            return total + (day.tweet_count || 0);
        }, 0);
    } catch {
        return 0;
    }
}

/**
 * Lấy sentiment data cho nhiều crypto hashtags cùng lúc
 * Gracefully handles missing Twitter API key
 */
export async function getCryptoSocialSentiment(
    hashtags: string[]
): Promise<TwitterMention[]> {
    const bearer = getBearer();
    if (!bearer) {
        console.info('[Twitter] No Bearer Token — returning empty social sentiment');
        return [];
    }

    const results: TwitterMention[] = [];

    for (const hashtag of hashtags.slice(0, 5)) {
        // Rate limit awareness: đợi 1s giữa mỗi request
        if (results.length > 0) {
            await new Promise(r => setTimeout(r, 1000));
        }

        const mention = await searchCryptoMentions(hashtag);
        if (mention) {
            results.push(mention);
        }
    }

    return results;
}

/**
 * Kiểm tra xem Twitter service có khả dụng không
 */
export function isTwitterAvailable(): boolean {
    return getBearer() !== null;
}

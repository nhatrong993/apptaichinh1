/**
 * Crypto Data Aggregator
 *
 * Kết hợp dữ liệu từ 3 nguồn:
 *   1. CoinGecko — Trending coins, Market data, Sparkline
 *   2. Google Trends — Keyword interest, Daily trends
 *   3. Twitter/X — Social mentions, Sentiment
 *
 * Fallback strategy:
 *   - CoinGecko: Primary data source (bắt buộc)
 *   - Google Trends: Enrichment (optional, graceful fallback)
 *   - Twitter: Enrichment (optional, cần API key, graceful fallback)
 *   - Static JSON: Ultimate fallback khi tất cả API đều fail
 */

import { getTrendingCoins, getBinanceTrendingCoins, type CoinGeckoTrendingResult } from './coingecko';
import { getCryptoInterest, getCryptoDailyTrends, type TrendingSearch } from './google-trends';
import { getCryptoSocialSentiment, isTwitterAvailable, type TwitterMention } from './twitter';
import { CryptoCoin, SocialSentiment } from '@/types/crypto';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Đọc static fallback data từ JSON file
 */
async function readFallbackData(filename: string): Promise<CryptoCoin[]> {
    try {
        const filePath = path.join(process.cwd(), 'data', filename);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/**
 * Ghi data vào cache JSON file
 */
async function writeCacheData(filename: string, data: CryptoCoin[]): Promise<void> {
    try {
        const filePath = path.join(process.cwd(), 'data', filename);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`[Aggregator] Error writing cache ${filename}:`, error);
    }
}

/**
 * Xác định trend source dựa trên data
 */
function determineTrendSources(
    cgData: CoinGeckoTrendingResult,
    googleScore: number,
    twitterMentions: number
): CryptoCoin['trendSource'] {
    const sources: CryptoCoin['trendSource'] = [];

    // CoinGecko trending = DexScreener equivalent (on-chain data)
    sources.push('DexScreener');

    if (googleScore > 30) sources.push('Google');
    if (twitterMentions > 0) sources.push('X');

    return sources.length > 0 ? sources : ['DexScreener'];
}

/**
 * Xác định AI sentiment dựa trên nhiều tín hiệu
 */
function determineAISentiment(
    priceChange: number,
    googleTrending: boolean,
    twitterSentiment?: 'Bullish' | 'Bearish' | 'Neutral'
): 'Bullish' | 'Bearish' | 'Neutral' {
    let score = 0;

    // Price change weight
    if (priceChange > 10) score += 2;
    else if (priceChange > 3) score += 1;
    else if (priceChange < -10) score -= 2;
    else if (priceChange < -3) score -= 1;

    // Google trending bonus
    if (googleTrending) score += 1;

    // Twitter sentiment
    if (twitterSentiment === 'Bullish') score += 1;
    else if (twitterSentiment === 'Bearish') score -= 1;

    if (score >= 2) return 'Bullish';
    if (score <= -2) return 'Bearish';
    return 'Neutral';
}

/**
 * Xác định news type heuristic
 */
function determineNewsType(
    trendScore: number,
    googleScore: number,
    priceChange: number
): 'Verified' | 'Rumor' | 'FUD' {
    // Nếu có cả Google Trends high + price action mạnh = Verified
    if (googleScore > 60 && Math.abs(priceChange) > 5) return 'Verified';

    // Price giảm mạnh + trending = có thể là FUD
    if (priceChange < -10) return 'FUD';

    // Mặc định — chưa xác minh
    return 'Rumor';
}

/**
 * Tính market cap size (1-10) dựa trên market cap actual
 */
function calculateMarketCapSize(marketCap: number): number {
    if (marketCap > 50_000_000_000) return 10; // >$50B
    if (marketCap > 10_000_000_000) return 9;
    if (marketCap > 5_000_000_000) return 8;
    if (marketCap > 1_000_000_000) return 7;
    if (marketCap > 500_000_000) return 6;
    if (marketCap > 100_000_000) return 5;
    if (marketCap > 50_000_000) return 4;
    if (marketCap > 10_000_000) return 3;
    if (marketCap > 1_000_000) return 2;
    return 1;
}

/**
 * MAIN: Lấy trending coins với data aggregated từ tất cả sources
 */
export async function getAggregatedTrendingCoins(): Promise<CryptoCoin[]> {
    console.log('[Aggregator] Fetching trending coins from all sources...');

    // Parallel fetch từ CoinGecko + Google Trends
    const [cgTrending, googleTrends] = await Promise.allSettled([
        getTrendingCoins(),
        getCryptoDailyTrends(),
    ]);

    const coins: CoinGeckoTrendingResult[] =
        cgTrending.status === 'fulfilled' ? cgTrending.value : [];

    const gTrends: TrendingSearch[] =
        googleTrends.status === 'fulfilled' ? googleTrends.value : [];

    // Nếu CoinGecko thất bại hoàn toàn, dùng fallback data
    if (coins.length === 0) {
        console.warn('[Aggregator] CoinGecko returned empty — using fallback data');
        return readFallbackData('coins.json');
    }

    // Lấy Google Trends interest cho các trending coins
    const coinSymbols = coins.slice(0, 5).map(c => c.symbol);
    const googleInterest = await getCryptoInterest(coinSymbols).catch(() => []);

    const googleInterestMap = new Map(
        googleInterest.map(g => [g.keyword.toUpperCase(), g])
    );

    // Lấy Twitter sentiment (nếu available)
    let twitterData: TwitterMention[] = [];
    if (isTwitterAvailable()) {
        try {
            twitterData = await getCryptoSocialSentiment(
                coins.slice(0, 5).map(c => `$${c.symbol}`)
            );
        } catch {
            console.warn('[Aggregator] Twitter data fetch failed');
        }
    }

    const twitterMap = new Map(
        twitterData.map(t => [t.hashtag.replace('$', '').toUpperCase(), t])
    );

    // Combine tất cả data thành CryptoCoin[]
    const aggregatedCoins: CryptoCoin[] = coins.map((coin, idx) => {
        const symbolUpper = coin.symbol.toUpperCase();
        const gInterest = googleInterestMap.get(symbolUpper);
        const tMention = twitterMap.get(symbolUpper);

        const googleScore = gInterest?.interestScore || 0;
        const twitterMentions = tMention?.mentions || 0;
        const twitterSentiment = tMention?.sentiment;

        const trendSources = determineTrendSources(coin, googleScore, twitterMentions);
        const aiSentiment = determineAISentiment(
            coin.change24h,
            gInterest?.isRising || false,
            twitterSentiment
        );
        const newsType = determineNewsType(coin.trendScore, googleScore, coin.change24h);
        const marketCapSize = calculateMarketCapSize(coin.marketCap);

        // Build summary text
        const summaryParts = [
            `${coin.name} (${coin.symbol}) đang #${idx + 1} Top Trending trên CoinGecko.`,
        ];

        if (googleScore > 50) {
            summaryParts.push(`Đang hot trên Google Trends (score: ${googleScore}/100).`);
        }
        if (twitterMentions > 0) {
            summaryParts.push(`${twitterMentions} mentions gần đây trên X/Twitter.`);
        }
        if (Math.abs(coin.change24h) > 5) {
            summaryParts.push(
                `Giá ${coin.change24h > 0 ? 'tăng' : 'giảm'} ${Math.abs(coin.change24h).toFixed(1)}% trong 24h.`
            );
        }

        return {
            id: coin.id,
            name: coin.name,
            symbol: coin.symbol,
            price: coin.price,
            change4h: parseFloat(coin.change24h.toFixed(2)), // Dùng 24h vì CoinGecko không có 4h
            trendSource: trendSources,
            trendScore: coin.trendScore,
            sparklineData: coin.sparklineData.length > 0
                ? coin.sparklineData
                : Array.from({ length: 9 }, () => coin.price * (0.95 + Math.random() * 0.1)),
            summary: summaryParts.join('\n'),
            exchange: coin.marketCapRank && coin.marketCapRank <= 100 ? 'Binance' : 'DEX',
            aiSentiment,
            newsType,
            hasWhaleAlert: coin.volume > 1_000_000_000, // Volume > $1B = whale activity
            marketCapSize,
        };
    });

    // Cache kết quả vào file JSON (để API route đọc được)
    await writeCacheData('coins.json', aggregatedCoins);

    console.log(`[Aggregator] ✅ Aggregated ${aggregatedCoins.length} trending coins`);
    return aggregatedCoins;
}

/**
 * MAIN: Lấy Binance-focused trending coins
 */
export async function getAggregatedBinanceCoins(): Promise<CryptoCoin[]> {
    console.log('[Aggregator] Fetching Binance trending coins...');

    const coins = await getBinanceTrendingCoins();

    if (coins.length === 0) {
        console.warn('[Aggregator] CoinGecko Binance data empty — using fallback');
        return readFallbackData('binance_fomo.json');
    }

    const aggregatedCoins: CryptoCoin[] = coins.map((coin, idx) => {
        const marketCapSize = calculateMarketCapSize(coin.marketCap);
        const aiSentiment = determineAISentiment(coin.change24h, false);
        const newsType = determineNewsType(coin.trendScore, 0, coin.change24h);

        return {
            id: coin.id,
            name: coin.name,
            symbol: coin.symbol,
            price: coin.price,
            change4h: parseFloat(coin.change24h.toFixed(2)),
            trendSource: ['Binance' as const],
            trendScore: coin.trendScore,
            sparklineData: coin.sparklineData.length > 0
                ? coin.sparklineData
                : Array.from({ length: 9 }, () => coin.price * (0.95 + Math.random() * 0.1)),
            summary: `${coin.name} (${coin.symbol}) — Top ${idx + 1} theo volume trên thị trường.\nMarket Cap Rank: #${coin.marketCapRank || 'N/A'}\nGiá ${coin.change24h > 0 ? 'tăng' : 'giảm'} ${Math.abs(coin.change24h).toFixed(1)}% trong 24h.`,
            exchange: 'Binance',
            aiSentiment,
            newsType,
            hasWhaleAlert: coin.volume > 2_000_000_000,
            marketCapSize,
        };
    });

    await writeCacheData('binance_fomo.json', aggregatedCoins);

    console.log(`[Aggregator] ✅ Aggregated ${aggregatedCoins.length} Binance coins`);
    return aggregatedCoins;
}

/**
 * Lấy social sentiment data cho dashboard
 */
export async function getAggregatedSocialSentiment(): Promise<SocialSentiment[]> {
    const defaultHashtags = ['#Bitcoin', '#Ethereum', '#Solana', '#BNB', '#Memecoin'];

    // Thử Twitter trước
    if (isTwitterAvailable()) {
        try {
            const mentions = await getCryptoSocialSentiment(defaultHashtags);
            if (mentions.length > 0) {
                return mentions.map(m => ({
                    hashtag: m.hashtag,
                    mentions: m.mentions,
                    sentiment: m.sentiment,
                }));
            }
        } catch {
            console.warn('[Aggregator] Twitter sentiment failed, falling back to Google Trends');
        }
    }

    // Fallback: dùng Google Trends interest scores
    try {
        const keywords = ['Bitcoin', 'Ethereum', 'Solana', 'BNB', 'Memecoin'];
        const interests = await getCryptoInterest(keywords);

        return interests.map(i => ({
            hashtag: `#${i.keyword}`,
            mentions: i.interestScore * 100, // Scale to match UI
            sentiment: i.isRising ? 'Bullish' as const : 'Neutral' as const,
        }));
    } catch {
        return [];
    }
}

/**
 * Lấy breaking news focus LOWCAP từ Google Trends, Binance Alpha, CoinGecko, và Twitter
 *
 * Strategy (lowcap-focused):
 *   1. getCryptoDailyTrends() — filter daily trends có keyword crypto
 *   2. Binance Alpha tokens mới → tạo news
 *   3. Google Trends Interest cho lowcap keywords (memecoin, defi, ai agent...)
 *   4. CoinGecko trending — chỉ lấy lowcap coins (rank > 100 hoặc no rank)
 *   5. Twitter/X — nếu có Bearer Token
 */
export async function getBreakingNews(): Promise<{
    id: string;
    source: 'Twitter' | 'Google';
    title: string;
    impact: string;
    agentRecommendation: string;
    time: string;
}[]> {
    const news: any[] = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    // === STRATEGY 1: Google Trends Daily Trends (crypto filter) ===
    try {
        const gTrends = await getCryptoDailyTrends();
        for (const trend of gTrends.slice(0, 2)) {
            news.push({
                id: `gd-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                source: 'Google' as const,
                title: trend.title,
                impact: `${trend.formattedTraffic} searches trên Google. Liên quan: ${trend.relatedQueries.slice(0, 3).join(', ') || 'N/A'}`,
                agentRecommendation: 'Đang hot trên Google Search — khả năng tác động đến các đồng lowcap liên quan.',
                time: trend.timeAgo || timeStr,
            });
        }
    } catch {
        console.warn('[Aggregator] Google daily trends fetch failed');
    }

    // === STRATEGY 2: Binance Alpha tokens mới ===
    if (news.length < 5) {
        try {
            const { getBinanceAlphaTokens } = await import('./binance-alpha');
            const alphaTokens = await getBinanceAlphaTokens();

            // Lấy 3 token mới nhất (cuối danh sách = gần đây nhất)
            const recentTokens = alphaTokens.slice(-3).reverse();

            for (const token of recentTokens.slice(0, Math.max(0, 5 - news.length))) {
                news.push({
                    id: `alpha-${token.contractAddress}-${Date.now()}`,
                    source: 'Google' as const, // Hiển thị chung
                    title: `🔶 ${token.name} (${token.symbol}) — mới được thêm vào Binance Alpha trên ${token.chain || 'BSC'}`,
                    impact: `Chain: ${token.chain} | Contract: ${token.contractAddress?.slice(0, 8)}...${token.contractAddress?.slice(-6)}. Token lowcap giai đoạn đầu, có tiềm năng list Binance chính thức.`,
                    agentRecommendation: 'Token Alpha giai đoạn sớm — rủi ro cao/lãi cao. DYOR, chỉ đặt vốn chấp nhận mất.',
                    time: timeStr,
                });
            }
        } catch {
            console.warn('[Aggregator] Binance Alpha news fetch failed');
        }
    }

    // === STRATEGY 3: Google Trends Interest cho LOWCAP keywords ===
    if (news.length < 5) {
        try {
            // Focus lowcap keywords thay vì BTC/ETH
            const lowcapKeywords = ['memecoin', 'AI agent crypto', 'DePIN', 'RWA crypto', 'Binance Alpha'];
            const interests = await getCryptoInterest(lowcapKeywords);

            const significant = interests
                .filter(i => i.interestScore > 0)
                .sort((a, b) => b.interestScore - a.interestScore);

            for (const item of significant.slice(0, Math.max(0, 5 - news.length))) {
                const trend = item.isRising ? '📈 Đang tăng mạnh' : '📉 Đang giảm nhiệt';
                const sentiment = item.isRising ? 'Bullish' : 'Neutral';

                news.push({
                    id: `gi-${item.keyword}-${Date.now()}`,
                    source: 'Google' as const,
                    title: `Google Trends: "${item.keyword}" đạt interest score ${item.interestScore}/100 trong 7 ngày qua`,
                    impact: `${trend}. Narrative "${item.keyword}" ${item.isRising ? 'đang được nhắc đến nhiều' : 'ổn định'} — ảnh hưởng trực tiếp đến các đồng lowcap trong nhóm này.`,
                    agentRecommendation: `Sentiment: ${sentiment}. ${item.isRising
                        ? 'Narrative đang nóng — tìm lowcap gems trong nhóm này trước khi FOMO.'
                        : 'Narrative đang cooling — chờ confirmation trước khi entry.'
                        }`,
                    time: timeStr,
                });
            }
        } catch {
            console.warn('[Aggregator] Google interest query failed');
        }
    }

    // === STRATEGY 4: CoinGecko trending — chỉ lowcap (rank > 100 hoặc null) ===
    if (news.length < 5) {
        try {
            const trendingCoins = await getTrendingCoins();
            // Filter chỉ giữ lowcap coins
            const lowcapCoins = trendingCoins.filter(c =>
                !c.marketCapRank || c.marketCapRank > 100
            );

            for (const coin of lowcapCoins.slice(0, Math.max(0, 5 - news.length))) {
                const direction = coin.change24h >= 0 ? 'tăng' : 'giảm';
                const emoji = coin.change24h >= 0 ? '🚀' : '⚠️';

                news.push({
                    id: `cg-${coin.id}-${Date.now()}`,
                    source: 'Google' as const,
                    title: `${emoji} Lowcap Alert: ${coin.name} (${coin.symbol}) đang Top Trending — giá ${direction} ${Math.abs(coin.change24h).toFixed(1)}% (24h)`,
                    impact: `Market Cap Rank: #${coin.marketCapRank || 'Unranked'}. Đồng lowcap lọt top trending — tín hiệu có thể bị pump hoặc narrative mới.`,
                    agentRecommendation: coin.change24h > 15
                        ? 'Pump mạnh — cẩn trọng FOMO. Kiểm tra on-chain data trước khi entry.'
                        : coin.change24h < -10
                            ? 'Dump mạnh nhưng vẫn trending — có thể là cơ hội hoặc rug. DYOR!'
                            : 'Đang accumulate — theo dõi volume để xác nhận trend.',
                    time: timeStr,
                });
            }
        } catch {
            console.warn('[Aggregator] CoinGecko lowcap trending news failed');
        }
    }

    // === STRATEGY 5: Twitter/X (nếu có Bearer Token) ===
    if (isTwitterAvailable()) {
        try {
            // Search lowcap-related tweets
            const tMentions = await getCryptoSocialSentiment(['lowcap gem', 'binance alpha', 'memecoin pump']);
            for (const m of tMentions.slice(0, 2)) {
                if (m.recentTweets.length > 0) {
                    const topTweet = m.recentTweets[0];
                    news.push({
                        id: `t-${topTweet.id}`,
                        source: 'Twitter' as const,
                        title: topTweet.text.slice(0, 150),
                        impact: `${topTweet.likeCount} likes, ${topTweet.retweetCount} retweets — @${topTweet.authorUsername}`,
                        agentRecommendation: `Sentiment X/Twitter: ${m.sentiment}. ${m.mentions} lowcap mentions tìm thấy.`,
                        time: new Date(topTweet.createdAt).toLocaleTimeString('vi-VN'),
                    });
                }
            }
        } catch {
            console.warn('[Aggregator] Twitter news fetch failed');
        }
    }

    return news;
}


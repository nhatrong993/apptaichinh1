/**
 * Data Fetcher — Kết hợp Binance + CoinGecko cho client-side
 * Ưu tiên: Binance (giá real-time) + CoinGecko (trending, market data)
 */

import { getBinance24hTickers, getBinanceTopByVolume, getBinanceKlines, type BinanceTicker } from './binance';
import { getTopCoins, getTrendingCoins } from './coingecko';
import type { CryptoCoin, SocialSentiment } from '@/types/crypto';

// Map symbol Binance -> CoinGecko ID (các coin phổ biến)
const SYMBOL_TO_ID: Record<string, string> = {
    BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana',
    XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2',
    DOT: 'polkadot', LINK: 'chainlink', MATIC: 'matic-network', UNI: 'uniswap',
    ATOM: 'cosmos', FIL: 'filecoin', LTC: 'litecoin', NEAR: 'near',
    APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', INJ: 'injective-protocol',
    SUI: 'sui', SEI: 'sei-network', TIA: 'celestia', JUP: 'jupiter-exchange-solana',
    PEPE: 'pepe', WIF: 'dogwifcoin', BONK: 'bonk', SHIB: 'shiba-inu',
    FET: 'fetch-ai', RENDER: 'render-token', TAO: 'bittensor', AAVE: 'aave',
    IMX: 'immutable-x', STX: 'stacks', ALGO: 'algorand', MANA: 'decentraland',
};

function cleanSymbol(symbol: string): string {
    return symbol.replace('USDT', '').replace('BUSD', '').toUpperCase();
}

function getSentiment(change: number): 'Bullish' | 'Bearish' | 'Neutral' {
    if (change > 3) return 'Bullish';
    if (change < -3) return 'Bearish';
    return 'Neutral';
}

function getMarketCapSize(volume: number): number {
    if (volume > 1_000_000_000) return 10;
    if (volume > 500_000_000) return 9;
    if (volume > 100_000_000) return 8;
    if (volume > 50_000_000) return 7;
    if (volume > 10_000_000) return 6;
    if (volume > 5_000_000) return 5;
    if (volume > 1_000_000) return 4;
    return 3;
}

function getTrendScore(change: number, volume: number): number {
    const changeFactor = Math.min(Math.abs(change) * 3, 50);
    const volumeFactor = Math.min(Math.log10(volume + 1) * 5, 50);
    return Math.round(Math.min(changeFactor + volumeFactor, 100));
}

/**
 * Lấy Binance FOMO data (top volume + gainers)
 */
export async function fetchBinanceFomoData(): Promise<CryptoCoin[]> {
    try {
        const topVolume = await getBinanceTopByVolume(25);
        if (topVolume.length === 0) return [];

        // Lấy sparkline song song cho top 15 coins
        const top15 = topVolume.slice(0, 15);
        const sparklinePromises = top15.map(t =>
            getBinanceKlines(cleanSymbol(t.symbol), '1h', 24).catch(() => [])
        );
        const sparklines = await Promise.all(sparklinePromises);

        return topVolume.map((ticker, idx): CryptoCoin => {
            const sym = cleanSymbol(ticker.symbol);
            const change = parseFloat(ticker.priceChangePercent);
            const volume = parseFloat(ticker.quoteVolume);
            const price = parseFloat(ticker.lastPrice);

            return {
                id: SYMBOL_TO_ID[sym] || sym.toLowerCase(),
                name: sym,
                symbol: sym,
                price,
                change4h: change,
                trendSource: ['Binance'],
                trendScore: getTrendScore(change, volume),
                sparklineData: idx < 15 ? (sparklines[idx] || []) : [],
                summary: `${sym} | Vol 24h: $${(volume / 1_000_000).toFixed(1)}M | ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
                exchange: 'Binance',
                aiSentiment: getSentiment(change),
                newsType: Math.abs(change) > 10 ? 'Verified' : 'Rumor',
                hasWhaleAlert: volume > 500_000_000,
                marketCapSize: getMarketCapSize(volume),
            };
        });
    } catch (err) {
        console.error('[DataFetcher] Binance FOMO error:', err);
        return [];
    }
}

/**
 * Lấy trending coins từ CoinGecko + enrich with Binance price
 */
export async function fetchTrendingCoins(): Promise<CryptoCoin[]> {
    try {
        // Fetch cả 2 API cùng lúc
        const [trendingCoins, topCoins] = await Promise.all([
            getTrendingCoins(),
            getTopCoins(30),
        ]);

        const coins: CryptoCoin[] = [];

        // Priority 1: CoinGecko top market coins (có sparkline data)
        for (const coin of topCoins.slice(0, 15)) {
            const change = coin.price_change_percentage_1h_in_currency || coin.price_change_percentage_24h || 0;
            coins.push({
                id: coin.id,
                name: coin.name,
                symbol: coin.symbol.toUpperCase(),
                price: coin.current_price || 0,
                change4h: change,
                trendSource: ['DexScreener'],
                trendScore: getTrendScore(change, coin.total_volume || 0),
                sparklineData: coin.sparkline_in_7d?.price?.slice(-24) || [],
                summary: `${coin.name} | Rank #${coin.market_cap_rank} | MCap: $${(coin.market_cap / 1e9).toFixed(1)}B`,
                exchange: 'CoinGecko',
                aiSentiment: getSentiment(change),
                newsType: 'Verified',
                hasWhaleAlert: (coin.total_volume || 0) > 500_000_000,
                marketCapSize: Math.min(10, Math.max(1, Math.round(10 - Math.log10(coin.market_cap_rank || 1) * 3))),
            });
        }

        // Priority 2: Trending coins (thêm vào nếu chưa có)
        const existingIds = new Set(coins.map(c => c.id));
        for (const tc of trendingCoins.slice(0, 10)) {
            if (existingIds.has(tc.item.id)) continue;
            const priceData = tc.item.data;
            const change = priceData?.price_change_percentage_24h?.usd || 0;

            coins.push({
                id: tc.item.id,
                name: tc.item.name,
                symbol: tc.item.symbol.toUpperCase(),
                price: priceData?.price || 0,
                change4h: change,
                trendSource: ['DexScreener'],
                trendScore: Math.max(60, 100 - tc.item.score * 10),
                sparklineData: [],
                summary: `🔥 Trending #${tc.item.score + 1} on CoinGecko`,
                exchange: 'CoinGecko',
                aiSentiment: getSentiment(change),
                newsType: 'Rumor',
                hasWhaleAlert: false,
                marketCapSize: Math.min(8, Math.max(2, 10 - (tc.item.market_cap_rank ? Math.round(Math.log10(tc.item.market_cap_rank) * 3) : 5))),
            });
        }

        return coins;
    } catch (err) {
        console.error('[DataFetcher] Trending error:', err);
        return [];
    }
}

/**
 * Lấy alpha/lowcap tokens từ Binance (volume thấp hơn, thay đổi giá lớn)
 */
export async function fetchAlphaTokens(): Promise<CryptoCoin[]> {
    try {
        const tickers = await getBinance24hTickers();
        if (tickers.length === 0) return [];

        // Filter: exclude stablecoins, low volume; focus on lowcap
        const stablecoins = ['USDCUSDT', 'BUSDUSDT', 'TUSDUSDT', 'DAIUSDT', 'FDUSDUSDT', 'EURUSDT'];
        const filtered = tickers
            .filter(t =>
                !stablecoins.includes(t.symbol) &&
                parseFloat(t.quoteVolume) > 100_000 &&       // Min $100K volume
                parseFloat(t.quoteVolume) < 50_000_000 &&    // Max $50M (lowcap)
                Math.abs(parseFloat(t.priceChangePercent)) > 2 // Min 2% change
            )
            .sort((a, b) => Math.abs(parseFloat(b.priceChangePercent)) - Math.abs(parseFloat(a.priceChangePercent)))
            .slice(0, 20);

        // Lấy sparkline cho top 10
        const sparklinePromises = filtered.slice(0, 10).map(t =>
            getBinanceKlines(cleanSymbol(t.symbol), '1h', 24).catch(() => [])
        );
        const sparklines = await Promise.all(sparklinePromises);

        return filtered.map((ticker, idx): CryptoCoin => {
            const sym = cleanSymbol(ticker.symbol);
            const change = parseFloat(ticker.priceChangePercent);
            const volume = parseFloat(ticker.quoteVolume);
            const price = parseFloat(ticker.lastPrice);

            return {
                id: SYMBOL_TO_ID[sym] || sym.toLowerCase(),
                name: sym,
                symbol: sym,
                price,
                change4h: change,
                trendSource: ['Binance'],
                trendScore: getTrendScore(change, volume),
                sparklineData: idx < 10 ? (sparklines[idx] || []) : [],
                summary: `Alpha | Vol: $${(volume / 1_000).toFixed(0)}K | ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
                exchange: 'Alpha (Binance)',
                aiSentiment: getSentiment(change),
                newsType: Math.abs(change) > 15 ? 'Verified' : change < -10 ? 'FUD' : 'Rumor',
                hasWhaleAlert: false,
                marketCapSize: getMarketCapSize(volume),
            };
        });
    } catch (err) {
        console.error('[DataFetcher] Alpha tokens error:', err);
        return [];
    }
}

/**
 * Tạo Social Sentiment data dựa trên Binance volume + CoinGecko trending
 */
export async function fetchSocialSentiment(): Promise<SocialSentiment[]> {
    try {
        const [topVolume, trending] = await Promise.all([
            getBinanceTopByVolume(10),
            getTrendingCoins(),
        ]);

        const sentiments: SocialSentiment[] = [];

        // Top volume coins
        for (const t of topVolume.slice(0, 5)) {
            const sym = cleanSymbol(t.symbol);
            const change = parseFloat(t.priceChangePercent);
            const volume = parseFloat(t.quoteVolume);
            sentiments.push({
                hashtag: `#${sym}`,
                mentions: Math.round(volume / 10_000), // Estimate mentions from volume
                sentiment: getSentiment(change),
            });
        }

        // Trending coins
        for (const tc of trending.slice(0, 5)) {
            const change = tc.item.data?.price_change_percentage_24h?.usd || 0;
            sentiments.push({
                hashtag: `#${tc.item.symbol.toUpperCase()}`,
                mentions: Math.round((tc.item.score + 1) * 5000),
                sentiment: getSentiment(change),
            });
        }

        // De-duplicate by hashtag
        const seen = new Set<string>();
        return sentiments.filter(s => {
            if (seen.has(s.hashtag)) return false;
            seen.add(s.hashtag);
            return true;
        }).slice(0, 8);
    } catch (err) {
        console.error('[DataFetcher] Social sentiment error:', err);
        return [];
    }
}

/**
 * Tạo Breaking News dựa trên big movers và trending
 */
export async function fetchBreakingNews() {
    try {
        const [tickers, trending] = await Promise.all([
            getBinance24hTickers(),
            getTrendingCoins(),
        ]);

        const news: Array<{
            id: string;
            source: 'Twitter' | 'Google';
            title: string;
            impact: string;
            agentRecommendation: string;
            time: string;
        }> = [];

        // Big movers from Binance
        const bigMovers = tickers
            .filter(t => Math.abs(parseFloat(t.priceChangePercent)) > 8 && parseFloat(t.quoteVolume) > 5_000_000)
            .sort((a, b) => Math.abs(parseFloat(b.priceChangePercent)) - Math.abs(parseFloat(a.priceChangePercent)))
            .slice(0, 4);

        for (const mover of bigMovers) {
            const sym = cleanSymbol(mover.symbol);
            const change = parseFloat(mover.priceChangePercent);
            const volume = parseFloat(mover.quoteVolume);
            const isUp = change > 0;

            news.push({
                id: `binance-${sym}`,
                source: 'Google',
                title: `${isUp ? '🚀' : '📉'} ${sym} ${isUp ? 'tăng' : 'giảm'} ${Math.abs(change).toFixed(1)}% trong 24h — Volume $${(volume / 1_000_000).toFixed(1)}M`,
                impact: isUp
                    ? `${sym} đang pump mạnh, volume tăng đáng kể. Khả năng có tin tức tích cực.`
                    : `${sym} giảm sâu, cần theo dõi support level. Có thể FUD hoặc chốt lời.`,
                agentRecommendation: isUp
                    ? `Canh mua pullback nếu ${sym} vẫn giữ trên MA20. Volume xác nhận xu hướng.`
                    : `Chờ đợi, đừng bắt dao rơi. Theo dõi volume sell-off có giảm không.`,
                time: 'Binance 24H',
            });
        }

        // Trending from CoinGecko
        for (const tc of trending.slice(0, 3)) {
            const change = tc.item.data?.price_change_percentage_24h?.usd || 0;
            news.push({
                id: `trending-${tc.item.id}`,
                source: 'Twitter',
                title: `🔥 ${tc.item.name} (${tc.item.symbol.toUpperCase()}) đang Trending #${tc.item.score + 1} trên CoinGecko`,
                impact: `Được tìm kiếm nhiều, trending score cao. ${change > 0 ? 'Giá tăng' : 'Giá giảm'} ${Math.abs(change).toFixed(1)}% 24h.`,
                agentRecommendation: `Coin đang viral. ${change > 0 ? 'Momentum mạnh nhưng cẩn thận FOMO.' : 'Theo dõi thêm trước khi vào lệnh.'}`,
                time: 'CoinGecko Live',
            });
        }

        return news;
    } catch (err) {
        console.error('[DataFetcher] Breaking news error:', err);
        return [];
    }
}

/**
 * Lấy ticker text cho LiveTrendTicker
 */
export async function fetchTickerItems(): Promise<string[]> {
    try {
        const tickers = await getBinanceTopByVolume(10);
        if (tickers.length === 0) return [];

        return tickers.map(t => {
            const sym = cleanSymbol(t.symbol);
            const price = parseFloat(t.lastPrice);
            const change = parseFloat(t.priceChangePercent);
            const emoji = change >= 0 ? '🚀' : '📉';
            const priceStr = price < 0.01 ? price.toFixed(6) : price < 1 ? price.toFixed(4) : price.toFixed(2);
            const changeStr = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
            return `${emoji} $${sym} $${priceStr} (${changeStr})`;
        });
    } catch {
        return [];
    }
}

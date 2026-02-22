/**
 * CoinGecko Public API Client (CORS-enabled)
 * Free tier: 10-30 calls/min (no key needed)
 * Docs: https://docs.coingecko.com/reference/introduction
 */

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

interface CoinGeckoMarketCoin {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number;
    total_volume: number;
    price_change_percentage_24h: number;
    price_change_percentage_1h_in_currency?: number;
    sparkline_in_7d?: { price: number[] };
    image?: string;
}

interface CoinGeckoTrendingCoin {
    item: {
        id: string;
        coin_id: number;
        name: string;
        symbol: string;
        market_cap_rank: number;
        thumb: string;
        small: string;
        large: string;
        slug: string;
        price_btc: number;
        score: number;
        data?: {
            price: number;
            price_change_percentage_24h?: Record<string, number>;
            sparkline?: string;
        };
    };
}

/**
 * Lấy top coins theo market cap với sparkline data
 */
export async function getTopCoins(limit = 30): Promise<CoinGeckoMarketCoin[]> {
    try {
        const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=1h,24h`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`CoinGecko: ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error('[CoinGecko] Failed to fetch top coins:', err);
        return [];
    }
}

/**
 * Lấy trending coins từ CoinGecko
 */
export async function getTrendingCoins(): Promise<CoinGeckoTrendingCoin[]> {
    try {
        const url = `${COINGECKO_BASE}/search/trending`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`CoinGecko trending: ${res.status}`);
        const data = await res.json();
        return data.coins || [];
    } catch (err) {
        console.error('[CoinGecko] Failed to fetch trending:', err);
        return [];
    }
}

/**
 * Lấy dữ liệu chi tiết 1 coin
 */
export async function getCoinDetail(coinId: string) {
    try {
        const url = `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&sparkline=true`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Lấy global crypto market data (total market cap, volume, BTC dominance)
 */
export async function getGlobalData() {
    try {
        const url = `${COINGECKO_BASE}/global`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        return data.data;
    } catch {
        return null;
    }
}

/**
 * Search coins by query
 */
export async function searchCoins(query: string) {
    try {
        const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return [];
        const data = await res.json();
        return data.coins || [];
    } catch {
        return [];
    }
}

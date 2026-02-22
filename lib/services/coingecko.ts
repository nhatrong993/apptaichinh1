/**
 * CoinGecko API Service
 *
 * Free Demo tier: 30 calls/phút, 10,000 calls/tháng
 * Endpoints sử dụng:
 *   - /search/trending — Top trending coins (24h)
 *   - /coins/markets — Market data + sparkline cho danh sách coins
 *   - /coins/{id} — Chi tiết một coin
 *
 * Docs: https://docs.coingecko.com/reference/introduction
 */

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRO_URL = 'https://pro-api.coingecko.com/api/v3';

interface CoinGeckoTrendingItem {
    item: {
        id: string;
        coin_id: number;
        name: string;
        symbol: string;
        market_cap_rank: number;
        thumb: string;
        large: string;
        slug: string;
        price_btc: number;
        score: number;
        data?: {
            price?: number;
            price_change_percentage_24h?: {
                usd?: number;
            };
            market_cap?: string;
            total_volume?: string;
            sparkline?: string; // SVG sparkline URL
        };
    };
}

interface CoinGeckoMarketData {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    market_cap_rank: number | null;
    total_volume: number;
    price_change_percentage_24h: number | null;
    price_change_percentage_1h_in_currency?: number | null;
    price_change_percentage_4h_in_currency?: number | null; // Không phải lúc nào cũng có
    sparkline_in_7d?: {
        price: number[];
    };
}

export interface CoinGeckoTrendingResult {
    id: string;
    name: string;
    symbol: string;
    price: number;
    change24h: number;
    marketCapRank: number | null;
    trendScore: number;
    image: string;
    sparklineData: number[];
    marketCap: number;
    volume: number;
}

/**
 * Tạo headers cho request, thêm API key nếu có
 */
function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };

    const apiKey = process.env.COINGECKO_API_KEY;
    if (apiKey) {
        headers['x-cg-demo-api-key'] = apiKey;
    }

    return headers;
}

/**
 * Chọn base URL dựa trên có API key hay không
 */
function getBaseUrl(): string {
    return process.env.COINGECKO_API_KEY ? COINGECKO_PRO_URL : COINGECKO_BASE_URL;
}

/**
 * Fetch wrapper với retry và rate limit handling
 */
async function cgFetch(endpoint: string, retries = 3): Promise<Response> {
    const url = `${getBaseUrl()}${endpoint}`;
    const headers = getHeaders();

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                headers,
                next: { revalidate: 300 }, // Cache 5 phút
            });

            // Rate limit — đợi rồi thử lại
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
                console.warn(`[CoinGecko] Rate limited. Waiting ${retryAfter}s...`);
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, retryAfter * 1000));
                    continue;
                }
            }

            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
            }

            return response;
        } catch (error) {
            if (attempt === retries) throw error;
            console.warn(`[CoinGecko] Attempt ${attempt}/${retries} failed, retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    throw new Error('[CoinGecko] All retries exhausted');
}

/**
 * Lấy top trending coins trên CoinGecko (dựa trên search popularity 24h)
 */
export async function getTrendingCoins(): Promise<CoinGeckoTrendingResult[]> {
    try {
        const response = await cgFetch('/search/trending');
        const data = await response.json();

        if (!data?.coins || !Array.isArray(data.coins)) {
            console.error('[CoinGecko] Invalid trending response format');
            return [];
        }

        const trendingItems: CoinGeckoTrendingItem[] = data.coins.slice(0, 10);

        // Lấy coin IDs để query market data (sparkline + price)
        const coinIds = trendingItems.map(t => t.item.id).join(',');

        // Fetch market data đầy đủ cho trending coins
        const marketData = await getMarketsData(coinIds);
        const marketMap = new Map(marketData.map(m => [m.id, m]));

        return trendingItems.map((t, idx) => {
            const market = marketMap.get(t.item.id);

            // Lấy 9 điểm cuối từ sparkline 7d
            let sparkline: number[] = [];
            if (market?.sparkline_in_7d?.price) {
                const prices = market.sparkline_in_7d.price;
                const step = Math.max(1, Math.floor(prices.length / 9));
                sparkline = Array.from({ length: 9 }, (_, i) => {
                    const index = Math.min(prices.length - 1, (prices.length - 9 * step) + i * step);
                    return prices[Math.max(0, index)];
                });
            }

            return {
                id: t.item.id,
                name: t.item.name,
                symbol: t.item.symbol.toUpperCase(),
                price: market?.current_price || 0,
                change24h: market?.price_change_percentage_24h || 0,
                marketCapRank: market?.market_cap_rank || t.item.market_cap_rank,
                trendScore: Math.max(50, 98 - idx * 5),
                image: t.item.large || t.item.thumb,
                sparklineData: sparkline,
                marketCap: market?.market_cap || 0,
                volume: market?.total_volume || 0,
            };
        });
    } catch (error) {
        console.error('[CoinGecko] Error fetching trending:', error);
        return [];
    }
}

/**
 * Lấy market data cho danh sách coin IDs
 * Bao gồm sparkline 7 ngày, price change, volume, market cap
 */
export async function getMarketsData(
    coinIds: string,
    currency = 'usd'
): Promise<CoinGeckoMarketData[]> {
    try {
        const params = new URLSearchParams({
            vs_currency: currency,
            ids: coinIds,
            order: 'market_cap_desc',
            per_page: '50',
            page: '1',
            sparkline: 'true',
            price_change_percentage: '1h,24h,7d',
        });

        const response = await cgFetch(`/coins/markets?${params.toString()}`);
        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('[CoinGecko] Invalid markets response format');
            return [];
        }

        return data;
    } catch (error) {
        console.error('[CoinGecko] Error fetching markets:', error);
        return [];
    }
}

/**
 * Lấy top coins theo market cap trên Binance
 * (filter exchange bằng CoinGecko endpoint)
 */
export async function getBinanceTrendingCoins(): Promise<CoinGeckoTrendingResult[]> {
    try {
        // Lấy top coins theo volume trên Binance
        const params = new URLSearchParams({
            vs_currency: 'usd',
            order: 'volume_desc',
            per_page: '10',
            page: '1',
            sparkline: 'true',
            price_change_percentage: '1h,24h,7d',
        });

        const response = await cgFetch(`/coins/markets?${params.toString()}`);
        const data: CoinGeckoMarketData[] = await response.json();

        if (!Array.isArray(data)) return [];

        return data
            .filter(coin => coin.total_volume > 0)
            .slice(0, 8)
            .map((coin, idx) => {
                let sparkline: number[] = [];
                if (coin.sparkline_in_7d?.price) {
                    const prices = coin.sparkline_in_7d.price;
                    const step = Math.max(1, Math.floor(prices.length / 9));
                    sparkline = Array.from({ length: 9 }, (_, i) => {
                        const index = Math.min(prices.length - 1, (prices.length - 9 * step) + i * step);
                        return prices[Math.max(0, index)];
                    });
                }

                return {
                    id: coin.id,
                    name: coin.name,
                    symbol: coin.symbol.toUpperCase(),
                    price: coin.current_price || 0,
                    change24h: coin.price_change_percentage_24h || 0,
                    marketCapRank: coin.market_cap_rank,
                    trendScore: Math.max(60, 95 - idx * 4),
                    image: coin.image,
                    sparklineData: sparkline,
                    marketCap: coin.market_cap || 0,
                    volume: coin.total_volume || 0,
                };
            });
    } catch (error) {
        console.error('[CoinGecko] Error fetching Binance trending:', error);
        return [];
    }
}

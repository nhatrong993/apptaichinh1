/**
 * Binance Alpha Service
 *
 * Binance Alpha là nền tảng showcase tokens lowcap giai đoạn đầu,
 * có tiềm năng được list trên sàn Binance chính thức.
 *
 * API Public (không cần auth):
 *   GET https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list
 *   → Trả về tất cả Alpha tokens (symbol, chainId, contractAddress, ...)
 *
 * Kết hợp với CoinGecko để lấy thêm price/market data cho các token.
 */

export interface BinanceAlphaToken {
    alphaId: string;       // e.g. "ALPHA_175"
    symbol: string;        // e.g. "gorilla"
    name: string;          // e.g. "gorilla"
    chainId: string;       // e.g. "56" (BSC), "1" (ETH), "501" (SOL)
    contractAddress: string;
    chain?: string;        // Human readable: BSC, ETH, SOL, etc.
}

export interface AlphaTokenWithMarket extends BinanceAlphaToken {
    price: number;
    change24h: number;
    marketCap: number;
    volume24h: number;
    sparklineData: number[];
    image?: string;
}

const BINANCE_ALPHA_API = 'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list';

// Chain ID → human readable name
const CHAIN_MAP: Record<string, string> = {
    '56': 'BSC',
    '1': 'Ethereum',
    '501': 'Solana',
    '137': 'Polygon',
    '42161': 'Arbitrum',
    '8453': 'Base',
    '10': 'Optimism',
    '43114': 'Avalanche',
};

/**
 * Lấy danh sách tất cả Binance Alpha tokens
 */
export async function getBinanceAlphaTokens(): Promise<BinanceAlphaToken[]> {
    try {
        console.log('[BinanceAlpha] Fetching Alpha token list...');

        const response = await fetch(BINANCE_ALPHA_API, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            next: { revalidate: 600 }, // Cache 10 phút
        });

        if (!response.ok) {
            throw new Error(`Binance Alpha API error: ${response.status}`);
        }

        const result = await response.json();

        if (!result?.data || !Array.isArray(result.data)) {
            console.warn('[BinanceAlpha] Unexpected response format');
            return [];
        }

        const tokens: BinanceAlphaToken[] = result.data.map((token: any) => ({
            alphaId: token.alphaId || '',
            symbol: (token.symbol || '').toUpperCase(),
            name: token.name || token.symbol || 'Unknown',
            chainId: String(token.chainId || ''),
            contractAddress: token.contractAddress || '',
            chain: CHAIN_MAP[String(token.chainId)] || `Chain ${token.chainId}`,
        }));

        console.log(`[BinanceAlpha] ✅ Fetched ${tokens.length} Alpha tokens`);
        return tokens;
    } catch (error) {
        console.error('[BinanceAlpha] Error fetching token list:', error);
        return [];
    }
}

/**
 * Lấy Alpha tokens kèm market data từ CoinGecko
 * Kết hợp: Binance Alpha list + CoinGecko market data
 */
export async function getAlphaTokensWithMarketData(): Promise<AlphaTokenWithMarket[]> {
    try {
        const alphaTokens = await getBinanceAlphaTokens();

        if (alphaTokens.length === 0) return [];

        // Lấy symbols để query CoinGecko
        const symbols = alphaTokens.slice(0, 30).map(t => t.symbol.toLowerCase());

        // Query CoinGecko markets bằng symbols
        const cgApiKey = process.env.COINGECKO_API_KEY;
        const cgBaseUrl = cgApiKey
            ? 'https://pro-api.coingecko.com/api/v3'
            : 'https://api.coingecko.com/api/v3';

        const headers: Record<string, string> = { Accept: 'application/json' };
        if (cgApiKey) headers['x-cg-demo-api-key'] = cgApiKey;

        // Tìm CoinGecko IDs cho các symbols
        // Dùng search endpoint cho từng symbol (batch)
        const tokenResults: AlphaTokenWithMarket[] = [];

        // Fetch market data cho các coins phổ biến hơn bằng /coins/markets
        // Sử dụng category filter hoặc search
        for (const token of alphaTokens.slice(0, 15)) {
            try {
                // Search CoinGecko cho mỗi token
                const searchRes = await fetch(
                    `${cgBaseUrl}/search?query=${encodeURIComponent(token.symbol)}`,
                    { headers, next: { revalidate: 3600 } } // cache 1 giờ
                );

                if (!searchRes.ok) continue;

                const searchData = await searchRes.json();
                const matchedCoin = searchData?.coins?.find(
                    (c: any) => c.symbol?.toUpperCase() === token.symbol.toUpperCase()
                );

                if (!matchedCoin) {
                    // Token chưa có trên CoinGecko — vẫn thêm với data cơ bản
                    tokenResults.push({
                        ...token,
                        price: 0,
                        change24h: 0,
                        marketCap: 0,
                        volume24h: 0,
                        sparklineData: [],
                        image: matchedCoin?.thumb,
                    });
                    continue;
                }

                // Lấy market data chi tiết
                const marketRes = await fetch(
                    `${cgBaseUrl}/coins/${matchedCoin.id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true`,
                    { headers, next: { revalidate: 600 } }
                );

                if (marketRes.ok) {
                    const coinData = await marketRes.json();
                    const marketData = coinData?.market_data;

                    let sparkline: number[] = [];
                    if (coinData?.market_data?.sparkline_7d?.price) {
                        const prices = coinData.market_data.sparkline_7d.price;
                        const step = Math.max(1, Math.floor(prices.length / 9));
                        sparkline = Array.from({ length: 9 }, (_, i) => {
                            const index = Math.min(prices.length - 1, Math.max(0, prices.length - 9 * step + i * step));
                            return prices[index];
                        });
                    }

                    tokenResults.push({
                        ...token,
                        price: marketData?.current_price?.usd || 0,
                        change24h: marketData?.price_change_percentage_24h || 0,
                        marketCap: marketData?.market_cap?.usd || 0,
                        volume24h: marketData?.total_volume?.usd || 0,
                        sparklineData: sparkline,
                        image: coinData?.image?.small || matchedCoin?.thumb,
                    });
                } else {
                    tokenResults.push({
                        ...token,
                        price: 0,
                        change24h: 0,
                        marketCap: 0,
                        volume24h: 0,
                        sparklineData: [],
                        image: matchedCoin?.thumb,
                    });
                }

                // Rate limit: đợi 2s giữa mỗi request (free tier)
                await new Promise(r => setTimeout(r, 2200));

            } catch (err) {
                console.warn(`[BinanceAlpha] Error fetching data for ${token.symbol}:`, err);
                tokenResults.push({
                    ...token,
                    price: 0,
                    change24h: 0,
                    marketCap: 0,
                    volume24h: 0,
                    sparklineData: [],
                });
            }
        }

        console.log(`[BinanceAlpha] ✅ Got market data for ${tokenResults.filter(t => t.price > 0).length}/${tokenResults.length} tokens`);
        return tokenResults;

    } catch (error) {
        console.error('[BinanceAlpha] Error in getAlphaTokensWithMarketData:', error);
        return [];
    }
}

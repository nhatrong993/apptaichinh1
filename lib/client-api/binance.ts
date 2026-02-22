/**
 * Binance Public API Client (CORS-enabled, no API key needed)
 * Docs: https://binance-docs.github.io/apidocs/spot/en/
 */

const BINANCE_BASE = 'https://api.binance.com/api/v3';

export interface BinanceTicker {
    symbol: string;
    priceChange: string;
    priceChangePercent: string;
    lastPrice: string;
    volume: string;
    quoteVolume: string;
    highPrice: string;
    lowPrice: string;
    openPrice: string;
}

export interface BinanceKline {
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
}

/**
 * Lấy 24h ticker cho tất cả cặp USDT
 */
export async function getBinance24hTickers(symbols?: string[]): Promise<BinanceTicker[]> {
    try {
        let url = `${BINANCE_BASE}/ticker/24hr`;

        if (symbols && symbols.length > 0) {
            const formatted = symbols.map(s => `"${s.toUpperCase()}USDT"`);
            url += `?symbols=[${formatted.join(',')}]`;
        }

        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`Binance API: ${res.status}`);

        const data = await res.json();
        const tickers: BinanceTicker[] = Array.isArray(data) ? data : [data];

        // Chỉ lấy các cặp USDT
        return tickers.filter((t: any) => t.symbol?.endsWith('USDT'));
    } catch (err) {
        console.error('[Binance] Failed to fetch 24h tickers:', err);
        return [];
    }
}

/**
 * Lấy top coins theo volume trên Binance
 */
export async function getBinanceTopByVolume(limit = 20): Promise<BinanceTicker[]> {
    const tickers = await getBinance24hTickers();
    return tickers
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, limit);
}

/**
 * Lấy top gainers (tăng giá mạnh nhất 24h)
 */
export async function getBinanceTopGainers(limit = 20): Promise<BinanceTicker[]> {
    const tickers = await getBinance24hTickers();
    return tickers
        .filter(t => parseFloat(t.quoteVolume) > 1_000_000) // Chỉ coin có volume > $1M
        .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, limit);
}

/**
 * Lấy Kline (candlestick) data cho sparkline chart
 */
export async function getBinanceKlines(
    symbol: string,
    interval = '1h',
    limit = 24
): Promise<number[]> {
    try {
        const url = `${BINANCE_BASE}/klines?symbol=${symbol.toUpperCase()}USDT&interval=${interval}&limit=${limit}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return [];

        const data = await res.json();
        // Kline format: [openTime, open, high, low, close, volume, ...]
        return data.map((k: any[]) => parseFloat(k[4])); // close prices
    } catch {
        return [];
    }
}

/**
 * Lấy giá hiện tại của 1 symbol
 */
export async function getBinancePrice(symbol: string): Promise<number> {
    try {
        const url = `${BINANCE_BASE}/ticker/price?symbol=${symbol.toUpperCase()}USDT`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return 0;
        const data = await res.json();
        return parseFloat(data.price) || 0;
    } catch {
        return 0;
    }
}

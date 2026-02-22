"use client";

import { useState, useEffect, useCallback } from "react";
import { Flame } from "lucide-react";

// Fallback items khi API chưa sẵn sàng
const fallbackItems = [
    "🔥 Đang kết nối CoinGecko...",
    "📡 Chờ dữ liệu trending coins thời gian thực",
    "💎 Setup API key trong .env.local để xem data thật",
];

export function LiveTrendTicker() {
    const [trendItems, setTrendItems] = useState<string[]>(fallbackItems);

    const fetchTicker = useCallback(async () => {
        try {
            const res = await fetch('/api/trending', { cache: 'no-store' });
            if (res.ok) {
                const coins = await res.json();
                if (Array.isArray(coins) && coins.length > 0) {
                    const items = coins.slice(0, 8).map((coin: any) => {
                        const emoji = coin.change4h >= 0 ? '🚀' : '📉';
                        const changeStr = coin.change4h >= 0
                            ? `+${coin.change4h.toFixed(1)}%`
                            : `${coin.change4h.toFixed(1)}%`;
                        return `${emoji} $${coin.symbol} $${coin.price < 0.01 ? coin.price.toFixed(6) : coin.price.toFixed(2)} (${changeStr})`;
                    });
                    setTrendItems(items);
                }
            }
        } catch (err) {
            console.error("Error fetching ticker data:", err);
        }
    }, []);

    useEffect(() => {
        fetchTicker();
        const interval = setInterval(fetchTicker, 60_000);
        return () => clearInterval(interval);
    }, [fetchTicker]);

    return (
        <div className="flex items-center bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-hidden whitespace-nowrap relative">
            <div className="flex items-center text-green-400 font-bold mr-4 z-10 bg-gray-900 pr-2 flex-shrink-0">
                <Flame className="w-5 h-5 mr-2 animate-pulse" />
                LIVE_TICKER //
            </div>
            <div className="flex space-x-12 animate-marquee">
                {trendItems.map((item, idx) => (
                    <span key={idx} className="text-gray-300 font-mono text-sm tracking-wide">
                        {item}
                    </span>
                ))}
                {/* Duplicate for seamless infinite scrolling */}
                {trendItems.map((item, idx) => (
                    <span key={`dup-${idx}`} className="text-gray-300 font-mono text-sm tracking-wide">
                        {item}
                    </span>
                ))}
            </div>
        </div>
    );
}

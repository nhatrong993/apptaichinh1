"use client";

import { useState, useEffect, useCallback } from "react";
import { Flame } from "lucide-react";
import { fetchTickerItems } from "@/lib/client-api/data-fetcher";

// Fallback items khi API chưa sẵn sàng
const fallbackItems = [
    "🔥 Đang kết nối Binance + CoinGecko...",
    "📡 Chờ dữ liệu trending coins thời gian thực",
    "💎 Dữ liệu live từ Binance API",
];

export function LiveTrendTicker() {
    const [trendItems, setTrendItems] = useState<string[]>(fallbackItems);

    const fetchTicker = useCallback(async () => {
        try {
            const items = await fetchTickerItems();
            if (items.length > 0) {
                setTrendItems(items);
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

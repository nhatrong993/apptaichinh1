"use client";

import { useState, useEffect } from "react";
import { CoinListBoard } from "@/components/CoinListBoard";
import { BinanceFomoBoard } from "@/components/BinanceFomoBoard";
import { LiveTrendTicker } from "@/components/LiveTrendTicker";
import { SocialSentimentCard } from "@/components/SocialSentimentCard";
import { BreakingNewsSidebar } from "@/components/BreakingNewsSidebar";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { CryptoCoin } from "@/types/crypto";

// Fallback data khi không fetch được
import coinsJson from "@/data/coins.json";

export default function Home() {
    const [coinsData, setCoinsData] = useState<CryptoCoin[]>([]);

    useEffect(() => {
        async function loadData() {
            try {
                // Thử fetch từ CoinGecko trực tiếp (client-side)
                const res = await fetch(
                    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=true&price_change_percentage=1h",
                    { signal: AbortSignal.timeout(8000) }
                );
                if (res.ok) {
                    const data = await res.json();
                    const mapped: CryptoCoin[] = data.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        symbol: c.symbol?.toUpperCase(),
                        price: c.current_price || 0,
                        change4h: c.price_change_percentage_1h_in_currency || c.price_change_percentage_24h || 0,
                        trendScore: Math.min(100, Math.round(Math.random() * 40 + 60)),
                        sparklineData: c.sparkline_in_7d?.price?.slice(-24) || [],
                        exchange: "CoinGecko",
                        aiSentiment: c.price_change_percentage_24h > 0 ? "Bullish" : c.price_change_percentage_24h < -5 ? "Bearish" : "Neutral",
                        newsType: "Verified",
                        hasWhaleAlert: (c.total_volume || 0) > 500_000_000,
                        marketCapSize: c.market_cap > 10_000_000_000 ? "large" : c.market_cap > 1_000_000_000 ? "mid" : "small",
                    }));
                    if (mapped.length > 0) {
                        setCoinsData(mapped);
                        return;
                    }
                }
            } catch (err) {
                console.warn("[Home] Live data unavailable, using fallback:", err);
            }

            // Fallback: dùng static data
            setCoinsData(Array.isArray(coinsJson) ? (coinsJson as CryptoCoin[]) : []);
        }

        loadData();
    }, []);

    return (
        <main className="min-h-screen bg-black text-white p-4 md:p-6 font-sans select-none selection:bg-green-500/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400 tracking-wider">
                    CRYPTO_TREND_HUNTER // 2026 EDITION
                </h1>
                <div className="flex items-center gap-3 mt-2 sm:mt-0">
                    <span className="text-[10px] text-gray-500 font-mono">
                        Data: CoinGecko + Binance Alpha + Google Trends
                    </span>
                    <span className="text-[10px] bg-gray-900 text-green-400 px-2 py-0.5 rounded border border-gray-800 font-mono">
                        ● LIVE
                    </span>
                </div>
            </div>

            {/* Live Trend Ticker */}
            <div className="mb-6">
                <LiveTrendTicker />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Main Content Area - 3 cột */}
                <div className="xl:col-span-3 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SentimentHeatmap coins={coinsData} />
                        <SocialSentimentCard />
                    </div>

                    {/* Alpha Binance — lowcap tokens từ Binance Alpha */}
                    <CoinListBoard />

                    {/* FOMO Zone — top volume coins */}
                    <BinanceFomoBoard />
                </div>

                {/* Right Sidebar - 1 cột */}
                <div className="xl:col-span-1">
                    <div className="sticky top-6">
                        <BreakingNewsSidebar />
                    </div>
                </div>
            </div>
        </main>
    );
}

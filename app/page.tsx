"use client";

import { useState, useEffect } from "react";
import { CoinListBoard } from "@/components/CoinListBoard";
import { BinanceFomoBoard } from "@/components/BinanceFomoBoard";
import { LiveTrendTicker } from "@/components/LiveTrendTicker";
import { SocialSentimentCard } from "@/components/SocialSentimentCard";
import { BreakingNewsSidebar } from "@/components/BreakingNewsSidebar";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { CryptoCoin } from "@/types/crypto";
import { fetchTrendingCoins } from "@/lib/client-api/data-fetcher";

// Fallback data khi không fetch được
import coinsJson from "@/data/coins.json";

export default function Home() {
    const [coinsData, setCoinsData] = useState<CryptoCoin[]>([]);

    useEffect(() => {
        async function loadData() {
            try {
                const data = await fetchTrendingCoins();
                if (data.length > 0) {
                    setCoinsData(data);
                    return;
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

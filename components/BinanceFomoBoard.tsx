"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CryptoCoin } from "@/types/crypto";
import { DeepDiveSheet } from "@/components/DeepDiveSheet";
import { Sparkline } from "@/components/shared/Sparkline";
import { TrendingUp, TrendingDown, ArrowRight, Smile, Frown, Meh } from "lucide-react";
import { fetchBinanceFomoData } from "@/lib/client-api/data-fetcher";

type FilterType = 'All' | 'Gainer' | 'Hottest';

export function BinanceFomoBoard() {
    const [selectedCoin, setSelectedCoin] = useState<CryptoCoin | null>(null);
    const [coins, setCoins] = useState<CryptoCoin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('All');

    const fetchFomo = useCallback(async () => {
        try {
            setError(null);
            const data = await fetchBinanceFomoData();
            if (data.length > 0) {
                setCoins(data);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            console.error("Error fetching fomo data:", message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFomo();
        const interval = setInterval(fetchFomo, 60000);
        return () => clearInterval(interval);
    }, [fetchFomo]);

    const filteredCoins = useMemo(() => {
        return [...coins].sort((a, b) => {
            if (filter === 'Gainer') return b.change4h - a.change4h;
            if (filter === 'Hottest') return b.trendScore - a.trendScore;
            return 0;
        });
    }, [coins, filter]);

    return (
        <>
            <div className="bg-[#0a0a0c] border border-yellow-500/30 rounded-xl p-5 shadow-[0_0_15px_rgba(234,179,8,0.05)] relative h-full">
                {/* Gold Glow background */}
                <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-yellow-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 z-10 relative">
                    <h2 className="text-xl font-black text-gray-100 uppercase tracking-widest border-l-4 border-yellow-500 pl-3 leading-none flex items-center mb-4 sm:mb-0">
                        <div className="text-yellow-400">BINANCE FOMO ZONE (24H) //</div>
                        {isLoading && <span className="text-xs text-yellow-500 font-mono animate-pulse font-normal border border-yellow-500/30 px-2 py-0.5 rounded ml-3">FETCHING...</span>}
                    </h2>

                    {/* Smart Filter */}
                    <div className="flex bg-gray-900 border border-yellow-500/30 rounded-lg p-1">
                        {(['All', 'Gainer', 'Hottest'] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`text-xs px-3 py-1.5 rounded transition-colors ${filter === f ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-yellow-400'}`}
                            >
                                {f === 'All' ? 'Mới nhất' : f === 'Gainer' ? 'Tăng giá mạnh' : 'Tin nóng nhất'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-mono">
                        ⚠ Lỗi kết nối: {error}. Đang thử lại sau 1 phút...
                    </div>
                )}

                <div className="overflow-x-auto relative z-10">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-gray-400 uppercase tracking-widest border-b border-gray-800">
                                <th className="pb-3 px-2 font-normal">Asset / News Type</th>
                                <th className="pb-3 px-2 font-normal text-center">Sentiment</th>
                                <th className="pb-3 px-2 font-normal">Exchange</th>
                                <th className="pb-3 px-2 font-normal">Price</th>
                                <th className="pb-3 px-2 font-normal text-center">Viral Score</th>
                                <th className="pb-3 px-2 font-normal text-center">24H Chart</th>
                                <th className="pb-3 px-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60">
                            {filteredCoins.map((coin) => {
                                const isPositive = coin.change4h >= 0;
                                const isHot = coin.trendScore >= 80;

                                return (
                                    <tr key={coin.id} className={`transition-colors group ${isHot ? 'hover:bg-yellow-900/10' : 'hover:bg-gray-800/30'}`}>
                                        <td className="py-4 px-2">
                                            <div className="flex items-center gap-3 relative">
                                                <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center font-bold text-yellow-500 relative z-10">
                                                    {coin.symbol[0]}
                                                    {isHot && <div className="absolute inset-0 rounded-full border border-yellow-500 animate-ping opacity-30"></div>}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-100 flex items-center">
                                                        {coin.name}
                                                        {coin.hasWhaleAlert && <span title="Whale Alert ON-CHAIN" className="ml-2 animate-bounce text-sm">🐋</span>}
                                                    </div>
                                                    <div className="text-xs text-yellow-500 font-mono mb-1">{coin.symbol}</div>

                                                    {/* News Type Progress bar */}
                                                    <div className="w-24 h-1 bg-gray-800 rounded-full overflow-hidden flex" title={`News Authenticity: ${coin.newsType || 'Rumor'}`}>
                                                        <div className={`h-full w-full ${coin.newsType === 'Verified' ? 'bg-green-500' :
                                                            coin.newsType === 'FUD' ? 'bg-red-500' :
                                                                'bg-yellow-500'
                                                            }`}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-center">
                                            <div className="flex justify-center items-center">
                                                {coin.aiSentiment === 'Bullish' && <Smile className="w-5 h-5 text-green-400 drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]" />}
                                                {coin.aiSentiment === 'Bearish' && <Frown className="w-5 h-5 text-red-400" />}
                                                {(!coin.aiSentiment || coin.aiSentiment === 'Neutral') && <Meh className="w-5 h-5 text-gray-500" />}
                                            </div>
                                        </td>
                                        <td className="py-4 px-2">
                                            <div className="font-mono text-yellow-500 font-bold text-xs bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded inline-block">
                                                {coin.exchange || 'Binance'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-2">
                                            <div className="font-mono text-gray-200">${coin.price < 0.01 ? coin.price.toFixed(7) : coin.price.toFixed(2)}</div>
                                            <div className={`text-xs flex items-center font-bold ${isPositive ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                {Math.abs(coin.change4h)}%
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-center">
                                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded font-black ${isHot ? 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.3)] pulse-animation-yellow' : 'bg-gray-800 border border-gray-700 text-gray-400'
                                                }`}>
                                                {coin.trendScore}
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 max-w-[120px]">
                                            <div className="flex justify-center">
                                                <Sparkline
                                                    data={coin.sparklineData}
                                                    isPositive={isPositive}
                                                    color={{ up: "#eab308", down: "#f87171" }}
                                                />
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <button
                                                onClick={() => setSelectedCoin(coin)}
                                                className="bg-transparent hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 hover:border-yellow-400 transition-all text-xs font-bold uppercase py-2 px-4 rounded inline-flex items-center group-hover:shadow-[0_0_10px_rgba(234,179,8,0.3)]"
                                            >
                                                Deep Dive
                                                <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {!isLoading && coins.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="text-center py-10 text-gray-500">
                                        Chưa có Data FOMO Binance. Chờ Agent Scraper...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <DeepDiveSheet
                coin={selectedCoin}
                isOpen={!!selectedCoin}
                onClose={() => setSelectedCoin(null)}
            />
        </>
    );
}

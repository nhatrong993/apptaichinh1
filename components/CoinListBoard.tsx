"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { CryptoCoin } from "@/types/crypto";
import { DeepDiveSheet } from "@/components/DeepDiveSheet";
import { Sparkline } from "@/components/shared/Sparkline";
import { TrendingUp, TrendingDown, ArrowRight, Smile, Frown, Meh, ExternalLink, Gem } from "lucide-react";
import { fetchAlphaTokens } from "@/lib/client-api/data-fetcher";

type FilterType = 'All' | 'Gainer' | 'Hottest';

export function CoinListBoard() {
    const [selectedCoin, setSelectedCoin] = useState<CryptoCoin | null>(null);
    const [coins, setCoins] = useState<CryptoCoin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('All');

    const fetchAlpha = useCallback(async () => {
        try {
            setError(null);
            const data = await fetchAlphaTokens();
            if (data.length > 0) {
                setCoins(data);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            console.error("Error fetching Alpha Binance data:", message);
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAlpha();
        // Refresh mỗi 10 phút (Alpha tokens không thay đổi liên tục)
        const interval = setInterval(fetchAlpha, 600_000);
        return () => clearInterval(interval);
    }, [fetchAlpha]);

    const filteredCoins = useMemo(() => {
        return [...coins].sort((a, b) => {
            if (filter === 'Gainer') return b.change4h - a.change4h;
            if (filter === 'Hottest') return b.trendScore - a.trendScore;
            return 0;
        });
    }, [coins, filter]);

    return (
        <>
            <div className="bg-[#0a0a0c] border border-orange-500/30 rounded-xl p-5 shadow-[0_0_15px_rgba(249,115,22,0.05)] relative h-full">
                {/* Orange Glow background */}
                <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 z-10 relative">
                    <div className="flex items-center mb-4 sm:mb-0">
                        <h2 className="text-xl font-black text-gray-100 uppercase tracking-widest border-l-4 border-orange-500 pl-3 leading-none flex items-center">
                            <Gem className="w-5 h-5 mr-2 text-orange-400" />
                            <span className="text-orange-400">ALPHA BINANCE</span>
                            <span className="text-gray-500 text-xs font-normal ml-3">Lowcap • Web3</span>
                            {isLoading && <span className="text-xs text-orange-400 font-mono animate-pulse font-normal border border-orange-500/30 px-2 py-0.5 rounded ml-3">FETCHING...</span>}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Link to Binance Alpha */}
                        <a
                            href="https://www.binance.com/en/alpha"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-orange-400 border border-orange-500/30 px-2 py-1 rounded hover:bg-orange-500/10 transition-colors flex items-center gap-1"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Binance Alpha
                        </a>

                        {/* Smart Filter */}
                        <div className="flex bg-gray-900 border border-orange-500/30 rounded-lg p-1">
                            {(['All', 'Gainer', 'Hottest'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`text-xs px-3 py-1.5 rounded transition-colors ${filter === f ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400 hover:text-orange-400'}`}
                                >
                                    {f === 'All' ? 'Mới nhất' : f === 'Gainer' ? 'Tăng mạnh' : 'FOMO nhất'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs font-mono">
                        ⚠ Lỗi kết nối Binance Alpha: {error}
                    </div>
                )}

                <div className="overflow-x-auto relative z-10">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs text-gray-400 uppercase tracking-widest border-b border-gray-800">
                                <th className="pb-3 px-2 font-normal">Token / Chain</th>
                                <th className="pb-3 px-2 font-normal text-center">Sentiment</th>
                                <th className="pb-3 px-2 font-normal">Platform</th>
                                <th className="pb-3 px-2 font-normal">Price</th>
                                <th className="pb-3 px-2 font-normal text-center">Score</th>
                                <th className="pb-3 px-2 font-normal text-center">Chart</th>
                                <th className="pb-3 px-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/60">
                            {filteredCoins.map((coin) => {
                                const isPositive = coin.change4h >= 0;
                                const isHot = coin.trendScore >= 80;

                                return (
                                    <tr key={coin.id} className={`transition-colors group ${isHot ? 'hover:bg-orange-900/10' : 'hover:bg-gray-800/30'}`}>
                                        <td className="py-4 px-2">
                                            <div className="flex items-center gap-3 relative">
                                                <div className="w-10 h-10 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center font-bold text-orange-400 relative z-10 text-sm">
                                                    {coin.symbol[0]}
                                                    {isHot && <div className="absolute inset-0 rounded-full border border-orange-500 animate-ping opacity-30"></div>}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-100 flex items-center">
                                                        {coin.name}
                                                        {coin.hasWhaleAlert && <span title="High Volume" className="ml-2 text-sm">🐋</span>}
                                                    </div>
                                                    <div className="text-xs text-orange-400 font-mono mb-1">{coin.symbol}</div>
                                                    {/* News Type bar */}
                                                    <div className="w-24 h-1 bg-gray-800 rounded-full overflow-hidden flex" title={`Status: ${coin.newsType || 'New'}`}>
                                                        <div className={`h-full w-full ${coin.newsType === 'Verified' ? 'bg-green-500' :
                                                            coin.newsType === 'FUD' ? 'bg-red-500' :
                                                                'bg-orange-500'
                                                            }`}></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-center">
                                            <div className="flex justify-center items-center">
                                                {coin.aiSentiment === 'Bullish' && <Smile className="w-5 h-5 text-green-400" />}
                                                {coin.aiSentiment === 'Bearish' && <Frown className="w-5 h-5 text-red-400" />}
                                                {(!coin.aiSentiment || coin.aiSentiment === 'Neutral') && <Meh className="w-5 h-5 text-gray-500" />}
                                            </div>
                                        </td>
                                        <td className="py-4 px-2">
                                            <div className="font-mono text-orange-400 font-bold text-xs bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded inline-block">
                                                {coin.exchange || 'Alpha (BSC)'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-2">
                                            {coin.price > 0 ? (
                                                <>
                                                    <div className="font-mono text-gray-200">
                                                        ${coin.price < 0.01 ? coin.price.toFixed(7) : coin.price.toFixed(4)}
                                                    </div>
                                                    <div className={`text-xs flex items-center font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                        {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                        {Math.abs(coin.change4h).toFixed(1)}%
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-xs text-gray-600 font-mono">On-chain only</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-2 text-center">
                                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded font-black ${isHot ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)] pulse-animation-yellow' : 'bg-gray-800 border border-gray-700 text-gray-400'
                                                }`}>
                                                {coin.trendScore}
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 max-w-[120px]">
                                            <div className="flex justify-center">
                                                {coin.sparklineData?.length > 0 && coin.price > 0 ? (
                                                    <Sparkline
                                                        data={coin.sparklineData}
                                                        isPositive={isPositive}
                                                        color={{ up: "#f97316", down: "#f87171" }}
                                                    />
                                                ) : (
                                                    <span className="text-[10px] text-gray-600 font-mono">N/A</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <button
                                                onClick={() => setSelectedCoin(coin)}
                                                className="bg-transparent hover:bg-orange-500/20 text-orange-400 border border-orange-500/50 hover:border-orange-400 transition-all text-xs font-bold uppercase py-2 px-4 rounded inline-flex items-center group-hover:shadow-[0_0_10px_rgba(249,115,22,0.2)]"
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
                                        Đang kết nối Binance Alpha API...
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

"use client";

import { useEffect, useCallback } from "react";
import { CryptoCoin } from "@/types/crypto";
import { X, Activity, BrainCircuit } from "lucide-react";

interface Props {
    coin: CryptoCoin | null;
    isOpen: boolean;
    onClose: () => void;
}

export function DeepDiveSheet({ coin, isOpen, onClose }: Props) {
    // Xử lý phím ESC để đóng sheet
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        },
        [onClose]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            // Lock body scroll khi sheet mở
            document.body.style.overflow = "hidden";
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen || !coin) return null;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
                role="presentation"
            />

            {/* Sheet panel */}
            <div
                className="fixed top-0 right-0 h-full w-full max-w-md bg-[#0a0a0c] border-l border-gray-800 z-50 shadow-2xl shadow-green-900/10 flex flex-col p-6 animate-in slide-in-from-right"
                role="dialog"
                aria-modal="true"
                aria-label={`Chi tiết ${coin.name}`}
            >
                <div className="flex justify-between items-start mb-6 border-b border-gray-800 pb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded uppercase font-bold tracking-widest">
                                AI Agent Insight
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-white">{coin.name} <span className="text-gray-500 font-normal">({coin.symbol})</span></h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Đóng"
                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                            <div className="text-gray-500 text-xs uppercase mb-1 flex items-center">
                                <Activity className="w-3 h-3 mr-1" />
                                Price Action
                            </div>
                            <div className="text-xl font-mono text-white">
                                ${coin.price < 0.01 ? coin.price.toFixed(7) : coin.price.toFixed(2)}
                            </div>
                            <div className={coin.change4h >= 0 ? "text-green-400 text-sm" : "text-red-400 text-sm"}>
                                {coin.change4h >= 0 ? "+" : ""}{coin.change4h}% (4h)
                            </div>
                        </div>

                        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                            <div className="text-gray-500 text-xs uppercase mb-1 flex items-center">
                                <BrainCircuit className="w-3 h-3 mr-1" />
                                Trend Score
                            </div>
                            <div className={`text-xl font-mono font-bold ${coin.trendScore >= 80 ? 'text-green-400' :
                                    coin.trendScore >= 50 ? 'text-yellow-400' :
                                        'text-gray-400'
                                }`}>
                                {coin.trendScore} / 100
                            </div>
                        </div>
                    </div>

                    {/* AI Sentiment Badge */}
                    {coin.aiSentiment && (
                        <div className="mb-6 flex items-center gap-3">
                            <span className="text-xs text-gray-500 uppercase">AI Sentiment:</span>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${coin.aiSentiment === 'Bullish' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                    coin.aiSentiment === 'Bearish' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                        'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                }`}>
                                {coin.aiSentiment}
                            </span>
                            {coin.hasWhaleAlert && (
                                <span className="text-sm" title="Whale Alert">🐋 Whale Activity</span>
                            )}
                        </div>
                    )}

                    {/* AI Summary Section */}
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-cyan-500 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />

                        <div className="relative bg-[#050505] border border-gray-800 rounded-lg p-5">
                            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-3 flex items-center">
                                Tại sao {coin.symbol} đang hot?
                            </h3>
                            <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">
                                {coin.summary || "Chưa có phân tích chi tiết từ AI Agent."}
                            </p>

                            <div className="mt-5 pt-4 border-t border-gray-800/50">
                                <div className="text-xs text-gray-500 mb-2">SCANNER SOURCES:</div>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    {coin.trendSource.map((src, i) => (
                                        <span key={i} className="bg-gray-900 px-2 py-1 rounded text-cyan-400 font-mono">
                                            {src}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

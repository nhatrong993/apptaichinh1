"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, RefreshCcw } from "lucide-react";
import { SocialSentiment } from "@/types/crypto";

// Fallback data khi API chưa sẵn sàng
const fallbackData: SocialSentiment[] = [
    { hashtag: "#Bitcoin", mentions: 45000, sentiment: "Neutral" },
    { hashtag: "#Ethereum", mentions: 23000, sentiment: "Bullish" },
    { hashtag: "#Solana", mentions: 18000, sentiment: "Bullish" },
    { hashtag: "#BNB", mentions: 8400, sentiment: "Neutral" },
    { hashtag: "#Memecoin", mentions: 6200, sentiment: "Bearish" },
];

export function SocialSentimentCard() {
    const [data, setData] = useState<SocialSentiment[]>(fallbackData);
    const [isLive, setIsLive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchSentiment = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/social-sentiment', { cache: 'no-store' });
            if (res.ok) {
                const result = await res.json();
                if (Array.isArray(result) && result.length > 0) {
                    setData(result);
                    setIsLive(true);
                }
            }
        } catch (err) {
            console.error("Error fetching social sentiment:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSentiment();
        // Refresh mỗi 10 phút
        const interval = setInterval(fetchSentiment, 600_000);
        return () => clearInterval(interval);
    }, [fetchSentiment]);

    return (
        <div className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl -mr-10 -mt-10" />

            <h2 className="text-lg font-bold text-gray-100 mb-4 flex items-center justify-between">
                <div className="flex items-center">
                    <MessageCircle className="w-5 h-5 mr-2 text-cyan-400" />
                    SOCIAL_SENTIMENT
                </div>
                <div className="flex items-center gap-2">
                    {isLive && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30 font-mono">
                            LIVE
                        </span>
                    )}
                    <button
                        onClick={fetchSentiment}
                        disabled={isLoading}
                        className="p-1 hover:bg-gray-800 rounded transition-colors"
                        title="Refresh data"
                    >
                        <RefreshCcw className={`w-3.5 h-3.5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </h2>

            <div className="space-y-4">
                {data.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 hover:bg-gray-800/80 transition-colors border border-gray-800/50">
                        <div className="flex items-center gap-3">
                            <div className="text-cyan-400 font-mono text-sm">
                                {item.hashtag}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-gray-400 mb-1">
                                {item.mentions > 0
                                    ? item.mentions.toLocaleString('en-US') + ' mentions'
                                    : 'Đang thu thập...'
                                }
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${item.sentiment === 'Bullish' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                item.sentiment === 'Bearish' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                    'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                }`}>
                                {item.sentiment}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {!isLive && (
                <div className="mt-3 text-[10px] text-gray-600 font-mono text-center">
                    Đang hiển thị dữ liệu mặc định. Cấu hình API keys để xem data thật.
                </div>
            )}
        </div>
    );
}

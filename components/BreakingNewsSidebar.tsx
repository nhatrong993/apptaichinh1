"use client";

import { useState, useEffect, useCallback } from "react";
import { Twitter, AlertCircle, Bot, Globe, RefreshCcw } from "lucide-react";
import { fetchBreakingNews } from "@/lib/client-api/data-fetcher";

interface NewsItem {
    id: string;
    source: 'Twitter' | 'Google';
    title: string;
    impact: string;
    agentRecommendation: string;
    time: string;
}

// Fallback static news khi API chưa sẵn sàng
const fallbackNews: NewsItem[] = [
    {
        id: "fallback-1",
        source: 'Google',
        title: "Đang kết nối với Google Trends để lấy crypto news thực...",
        impact: "Cấu hình API và chạy `npm install google-trends-api` để xem tin tức thật.",
        agentRecommendation: "Hệ thống sẽ tự động hiển thị breaking news khi có kết nối API.",
        time: "Chờ kết nối..."
    },
];

export function BreakingNewsSidebar() {
    const [news, setNews] = useState<NewsItem[]>(fallbackNews);
    const [isLive, setIsLive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchNews = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await fetchBreakingNews();
            if (data.length > 0) {
                setNews(data);
                setIsLive(true);
            }
        } catch (err) {
            console.error("Error fetching breaking news:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews();
        // Refresh mỗi 5 phút
        const interval = setInterval(fetchNews, 300_000);
        return () => clearInterval(interval);
    }, [fetchNews]);

    return (
        <div className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-5 shadow-lg h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-gray-100 uppercase tracking-widest border-l-4 border-red-500 pl-3 leading-none flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-red-500 animate-pulse" />
                    Breaking News
                </h2>
                <div className="flex items-center gap-2">
                    {isLive && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 font-mono animate-pulse">
                            LIVE
                        </span>
                    )}
                    <button
                        onClick={fetchNews}
                        disabled={isLoading}
                        className="p-1 hover:bg-gray-800 rounded transition-colors"
                        title="Refresh news"
                    >
                        <RefreshCcw className={`w-3.5 h-3.5 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
                {news.map((item) => (
                    <div key={item.id} className="bg-gray-900/40 border border-gray-800/80 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center ${item.source === 'Twitter' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}>
                                {item.source === 'Twitter' ? <Twitter className="w-3 h-3 mr-1" /> : <Globe className="w-3 h-3 mr-1" />}
                                SOURCE: {item.source}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">{item.time}</span>
                        </div>

                        <h3 className="text-sm text-gray-200 font-bold mb-3 leading-snug">
                            {item.title}
                        </h3>

                        <div className="bg-black/50 p-3 rounded border border-gray-800/50 mb-3 space-y-1">
                            <p className="text-xs text-red-400"><strong className="text-gray-400">Tác động: </strong>{item.impact}</p>
                        </div>

                        <div className="flex items-start text-green-400 bg-green-900/10 p-3 rounded border border-green-500/20">
                            <Bot className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                            <p className="text-xs leading-relaxed"><strong className="text-gray-300">Agent: </strong>{item.agentRecommendation}</p>
                        </div>
                    </div>
                ))}

                {news.length === 0 && (
                    <div className="text-center py-10 text-gray-500 text-sm">
                        Không có tin tức crypto nóng trong lúc này.
                    </div>
                )}
            </div>
        </div>
    );
}

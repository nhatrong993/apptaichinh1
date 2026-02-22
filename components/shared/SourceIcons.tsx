"use client";

import { Search, Play, Target } from "lucide-react";
import { TrendSource } from "@/types/crypto";
import { ReactNode } from "react";

/**
 * Shared source icon mapping — tránh duplicate giữa CoinListBoard và BinanceFomoBoard.
 * Định nghĩa một lần, import ở nhiều nơi.
 */
export const sourceIconMap: Record<TrendSource, ReactNode> = {
    Google: <Search className="w-3 h-3 text-blue-400" />,
    X: <strong className="text-gray-200 text-xs">𝕏</strong>,
    YouTube: <Play className="w-3 h-3 text-red-500" />,
    DexScreener: <Target className="w-3 h-3 text-green-300" />,
    Binance: <span className="text-yellow-400 font-black text-[10px]">BINANCE</span>,
};

export function SourceBadge({ source }: { source: TrendSource }) {
    return (
        <span className="inline-flex items-center justify-center w-6 h-6" title={source}>
            {sourceIconMap[source] || <span className="text-gray-500 text-[10px]">{source}</span>}
        </span>
    );
}

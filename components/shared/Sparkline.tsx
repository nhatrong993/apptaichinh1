"use client";

import { useMemo } from "react";

interface SparklineProps {
    data: number[];
    isPositive: boolean;
    color?: { up: string; down: string };
    width?: number;
    height?: number;
}

/**
 * Shared Sparkline SVG component — dùng chung cho cả CoinListBoard và BinanceFomoBoard.
 * Sử dụng useMemo để tránh re-calculate points khi parent re-render.
 */
export function Sparkline({
    data,
    isPositive,
    color = { up: "#4ade80", down: "#f87171" },
    width = 100,
    height = 40,
}: SparklineProps) {
    const points = useMemo(() => {
        if (!data || data.length === 0) return "";

        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;

        return data
            .map((val, i) => {
                const x = (i / (data.length - 1)) * width;
                const y = height - ((val - min) / range) * height;
                return `${x},${y}`;
            })
            .join(" ");
    }, [data, width, height]);

    if (!data || data.length === 0) {
        return (
            <svg width={width} height={height}>
                <text x="50%" y="50%" textAnchor="middle" fill="#6b7280" fontSize="10">
                    N/A
                </text>
            </svg>
        );
    }

    const strokeColor = isPositive ? color.up : color.down;

    return (
        <svg
            width={width}
            height={height}
            className="overflow-visible"
            viewBox={`0 -5 ${width} ${height + 10}`}
        >
            <polyline
                points={points}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                className={isPositive ? "sparkline-up" : "sparkline-down"}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

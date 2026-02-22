export type TrendSource = 'Google' | 'X' | 'YouTube' | 'DexScreener' | 'Binance';

export interface CryptoCoin {
    id: string;
    name: string;
    symbol: string;
    price: number;
    change4h: number;
    trendSource: TrendSource[];
    trendScore: number; // 1-100
    sparklineData: number[]; // Dữ liệu cho biểu đồ mini màu xanh/đỏ
    summary?: string; // Tóm tắt lý do hot
    exchange?: string; // Sàn giao dịch
    aiSentiment?: 'Bullish' | 'Bearish' | 'Neutral';
    newsType?: 'Verified' | 'Rumor' | 'FUD';
    hasWhaleAlert?: boolean;
    marketCapSize?: number; // Used for Heatmap sizing (1-10)
}

export interface SocialSentiment {
    hashtag: string;
    mentions: number;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
}

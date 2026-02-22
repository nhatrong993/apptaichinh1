import { CryptoCoin } from "@/types/crypto";

export function SentimentHeatmap({ coins }: { coins: CryptoCoin[] }) {
    return (
        <div className="bg-[#0a0a0c] border border-gray-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
            <h2 className="text-lg font-black text-gray-100 mb-4 uppercase tracking-widest flex items-center justify-between">
                <span>Sentiment Heatmap (24H)</span>
                <span className="text-xs text-gray-500 font-normal">Quy mô Thị trường & Cảm xúc</span>
            </h2>

            {coins.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
                    Chưa có dữ liệu heatmap...
                </div>
            ) : (
                <div className="flex flex-wrap gap-2 justify-center items-end h-40">
                    {coins.map((coin) => {
                        const size = coin.marketCapSize ? `${coin.marketCapSize * 10 + 20}px` : '40px';
                        const sentimentColor =
                            coin.aiSentiment === 'Bullish' ? 'bg-green-500' :
                                coin.aiSentiment === 'Bearish' ? 'bg-red-500' :
                                    'bg-gray-500';
                        const sentimentText =
                            coin.aiSentiment === 'Bullish' ? 'Hưng phấn' :
                                coin.aiSentiment === 'Bearish' ? 'Bán tháo' :
                                    'Trung lập';

                        return (
                            <div
                                key={coin.id}
                                style={{ width: size, height: size }}
                                className={`${sentimentColor} hover:brightness-110 flex items-center justify-center font-bold text-black border border-black/30 transition-transform cursor-crosshair group relative shadow-md rounded-sm`}
                            >
                                <span className="text-[10px] sm:text-xs truncate px-1" title={coin.symbol}>{coin.symbol}</span>

                                {/* Tooltip */}
                                <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-black border border-gray-700 text-white text-xs rounded p-2 z-50 capitalize whitespace-nowrap pointer-events-none -top-12">
                                    <strong className="text-cyan-400">{coin.name}</strong><br />
                                    Tâm lý: <strong>{sentimentText}</strong>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="flex items-center justify-between mt-4 text-[10px] text-gray-400 font-mono">
                <span className="flex items-center"><span className="w-2 h-2 bg-red-500 mr-1 rounded-sm"></span>Sợ hãi/Bearish</span>
                <span className="flex items-center"><span className="w-2 h-2 bg-gray-500 mr-1 rounded-sm"></span>Trung lập</span>
                <span className="flex items-center"><span className="w-2 h-2 bg-green-500 mr-1 rounded-sm"></span>Hưng phấn/Bullish</span>
            </div>
        </div>
    );
}

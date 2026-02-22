# 🚀 Hướng dẫn chạy Crypto Trend Hunter v0.2.0

## Cài đặt nhanh

```bash
# 1. Cài dependencies (BẮT BUỘC — đặc biệt google-trends-api mới thêm)
cd d:\tools\taichinh\crypto-trend-hunter
npm install

# 2. Cấu hình API Keys
copy .env.example .env.local
# Sau đó mở .env.local và điền API keys (xem bên dưới)

# 3. Chạy ứng dụng
npm run dev
```

## Cấu hình API Keys

### CoinGecko (Khuyến nghị — Miễn phí)
1. Đăng ký tại: https://www.coingecko.com/en/api
2. Tạo Demo API Key (FREE — 30 calls/phút, 10K calls/tháng)
3. Paste vào `.env.local`: `COINGECKO_API_KEY=your_key_here`
4. **LƯU Ý:** Không có key vẫn hoạt động, nhưng rate limit chỉ ~5-15 calls/phút

### Google Trends (Tự động — Không cần key)
- Chỉ cần chạy `npm install` là đủ
- Package `google-trends-api` hoạt động tự động
- Không cần API key

### Twitter/X (Tuỳ chọn — $200/tháng)
- Free tier chỉ 100 reads/tháng (gần như vô dụng)
- Basic tier: $200/tháng — unlimited search
- Đăng ký tại: https://developer.x.com/en/portal/dashboard
- Paste Bearer Token vào `.env.local`: `TWITTER_BEARER_TOKEN=your_token`
- **Nếu không có key, hệ thống sẽ tự động bỏ qua Twitter data**

## Kiểm tra API Status

Sau khi chạy `npm run dev`, truy cập:
```
http://localhost:3000/api/status
```

## API Endpoints

| Endpoint | Mô tả |
|----------|-------|
| `/api/trending` | Trending coins (CoinGecko + Google Trends + Twitter) |
| `/api/binance-fomo` | Top coins theo volume (CoinGecko) |
| `/api/social-sentiment` | Social sentiment (Twitter/Google Trends fallback) |
| `/api/breaking-news` | Breaking crypto news (Google Trends + Twitter) |
| `/api/status` | API health check |

## Kiến trúc Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CoinGecko     │    │  Google Trends   │    │   Twitter/X     │
│   (Free API)    │    │  (Free Package)  │    │  (Paid $200/mo) │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                       │
         └──────────┬───────────┴───────────┬───────────┘
                    │                       │
              ┌─────▼───────────────────────▼─────┐
              │        AGGREGATOR SERVICE          │
              │   (lib/services/aggregator.ts)     │
              │                                    │
              │  • Combine data từ 3 nguồn         │
              │  • AI Sentiment scoring            │
              │  • Fallback to cached JSON         │
              └──────────────┬─────────────────────┘
                             │
              ┌──────────────▼─────────────────────┐
              │        NEXT.JS API ROUTES          │
              │  • /api/trending                   │
              │  • /api/binance-fomo               │
              │  • /api/social-sentiment           │
              │  • /api/breaking-news              │
              └──────────────┬─────────────────────┘
                             │
              ┌──────────────▼─────────────────────┐
              │      REACT CLIENT COMPONENTS       │
              │  • CoinListBoard (fetch mỗi 60s)   │
              │  • BinanceFomoBoard                │
              │  • SocialSentimentCard             │
              │  • BreakingNewsSidebar             │
              │  • LiveTrendTicker                 │
              └────────────────────────────────────┘
```

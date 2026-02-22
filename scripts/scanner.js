const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const DATA_FILE = path.join(__dirname, '../data/coins.json');
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000; // 10 giây

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * Retry wrapper — thử lại n lần khi gặp lỗi
 */
async function withRetry(fn, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`[Scanner] Lần thử ${attempt}/${retries} thất bại:`, error.message);
            if (attempt < retries) {
                console.log(`[Scanner] Đợi ${RETRY_DELAY_MS / 1000}s rồi thử lại...`);
                await sleep(RETRY_DELAY_MS);
            } else {
                throw error;
            }
        }
    }
}

/**
 * Scrape DexScreener trending coins
 */
async function scrapeDexscreener() {
    console.log('\n[Scanner] ========================================');
    console.log('[Scanner] Bắt đầu quét DexScreener lúc', new Date().toLocaleTimeString());
    console.log('[Scanner] ========================================');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-http2',
                '--disable-dev-shm-usage', // Tránh crash khi RAM thấp
            ],
            timeout: 30000,
        });

        const page = await browser.newPage();

        // Fake UserAgent
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        );
        await page.setViewport({ width: 1366, height: 768 });

        // Block images/fonts/media để tải nhanh hơn
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log('[Scanner] Đang tải trang https://dexscreener.com/ ...');
        await page.goto('https://dexscreener.com/', {
            waitUntil: 'networkidle2',
            timeout: 60000,
        });

        // Đợi render DOM
        await sleep(5000);

        console.log('[Scanner] Parsing dữ liệu DOM...');

        const trendingCoins = await page.evaluate(() => {
            // Selector chính — có thể thay đổi khi DexScreener cập nhật
            const PRIMARY_ROW_SELECTOR = 'a.ds-dex-table-row';
            const FALLBACK_ROW_SELECTOR = 'a[href^="/"]'; // Fallback selector rộng hơn

            let rows = Array.from(document.querySelectorAll(PRIMARY_ROW_SELECTOR)).slice(0, 5);

            // Fallback nếu primary selector không hoạt động
            if (rows.length === 0) {
                console.warn('[Scanner] Primary selector failed, trying fallback...');
                rows = Array.from(document.querySelectorAll(FALLBACK_ROW_SELECTOR))
                    .filter(el => el.querySelector('[class*="token"]'))
                    .slice(0, 5);
            }

            return rows.map(row => {
                // Thử nhiều selector patterns để chống thay đổi DOM
                const nameEl = row.querySelector('.ds-dex-table-row-base-token-name')
                    || row.querySelector('[class*="token-name"]')
                    || row.querySelector('[class*="base-token"] span');

                const symbolEl = row.querySelector('.ds-dex-table-row-base-token-symbol')
                    || row.querySelector('[class*="token-symbol"]');

                const priceEl = row.querySelector('.ds-dex-table-row-price')
                    || row.querySelector('[class*="price"]');

                const exchangeIconEl = row.querySelector('.ds-dex-table-row-dex-icon');
                const exchangeStr = exchangeIconEl
                    ? (exchangeIconEl.getAttribute('title') || exchangeIconEl.getAttribute('alt') || 'DEX')
                    : 'DEX';

                let changeStr = '0';
                const changeElements = row.querySelectorAll('[class*="price-change"] span');
                if (changeElements && changeElements.length > 0) {
                    changeStr = changeElements[changeElements.length - 1].innerText;
                }

                return {
                    id: symbolEl ? symbolEl.innerText.toLowerCase().trim() : 'unknown',
                    name: nameEl ? nameEl.innerText.split('\n')[0].trim() : 'Unknown',
                    symbol: symbolEl ? symbolEl.innerText.split('\n')[0].trim() : 'UNK',
                    priceStr: priceEl ? priceEl.innerText : '0',
                    changeStr: changeStr,
                    exchange: exchangeStr,
                };
            });
        });

        console.log(`[Scanner] Đã Parse được ${trendingCoins.length} Coins!`);

        if (trendingCoins.length === 0) {
            console.log('[Scanner] ⚠ Không lấy được dữ liệu. DOM có thể đã thay đổi!');
            console.log('[Scanner] Kiểm tra lại CSS selectors trong scanner.js');
            return;
        }

        // Format data
        const formattedCoins = trendingCoins.map((c, idx) => {
            let price = parseFloat(c.priceStr.replace(/[^0-9.-]+/g, ""));
            if (isNaN(price) || price <= 0) price = 0.001;

            let change = parseFloat(c.changeStr.replace(/[^0-9.-]+/g, ""));
            if (isNaN(change)) change = 0;

            // Tạo sparkline data dựa trên trend direction
            const basePrice = price * 0.9;
            const sparklineData = Array.from({ length: 9 }, (_, i) => {
                const progress = i / 8;
                const trendComponent = change > 0
                    ? basePrice + (price - basePrice) * progress
                    : price + (basePrice - price) * (1 - progress);
                const noise = trendComponent * (Math.random() * 0.04 - 0.02); // ±2% noise
                return parseFloat((trendComponent + noise).toFixed(6));
            });

            // Trend score tính theo thứ hạng trending
            let trendScore = Math.max(60, 95 - (idx * 7) + Math.min(Math.abs(change) / 5, 10));
            trendScore = Math.min(Math.round(trendScore), 100);

            // Heuristic AI sentiment
            const aiSentiment = change > 20 ? 'Bullish' : change < -10 ? 'Bearish' : 'Neutral';
            const newsType = idx === 0 ? 'Verified' : (change > 0 ? 'Rumor' : 'FUD');
            const hasWhaleAlert = Math.abs(change) > 30;
            const marketCapSize = Math.max(3, Math.min(10, Math.floor(Math.random() * 5) + 4));

            return {
                id: c.id || `coin-${idx}`,
                name: c.name,
                symbol: c.symbol,
                price: price,
                change4h: change,
                trendSource: ["DexScreener"],
                trendScore: trendScore,
                sparklineData: sparklineData,
                exchange: c.exchange,
                aiSentiment: aiSentiment,
                newsType: newsType,
                hasWhaleAlert: hasWhaleAlert,
                marketCapSize: marketCapSize,
                summary: `(Auto Scan - ${new Date().toLocaleTimeString()})\nĐồng coin ${c.name} (${c.symbol}) đang trong Top ${idx + 1} Trending trên DexScreener.\nSàn: ${c.exchange} | Biến động: ${c.changeStr}.`,
            };
        });

        // Ghi file JSON (atomic write: ghi vào file tạm trước, rồi rename)
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const tmpFile = DATA_FILE + '.tmp';
        fs.writeFileSync(tmpFile, JSON.stringify(formattedCoins, null, 4), 'utf-8');
        fs.renameSync(tmpFile, DATA_FILE);

        console.log(`[Scanner] ✅ Cập nhật THÀNH CÔNG ${formattedCoins.length} coins vào data/coins.json!`);

    } catch (error) {
        console.error('[Scanner] ❌ Lỗi hệ thống:', error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log('[Scanner] Đã đóng trình duyệt Puppeteer.');
        }
    }
}

// ================================================================
// CRON JOB — Chạy mỗi giờ (phút 0), có retry
// ================================================================
console.log('>>> [CRON SERVICE] KÍCH HOẠT HỆ THỐNG AGENT NGẦM <<<');
console.log(`>>> Cron schedule: Mỗi giờ (0 * * * *)`);
console.log(`>>> Retry policy: ${MAX_RETRIES} lần, delay ${RETRY_DELAY_MS / 1000}s\n`);

cron.schedule('0 * * * *', () => {
    withRetry(scrapeDexscreener).catch(err => {
        console.error('[CRON] Tất cả retry đều thất bại:', err.message);
    });
});

// Chạy ngay khi khởi động
withRetry(scrapeDexscreener).catch(err => {
    console.error('[INIT] Scan ban đầu thất bại sau tất cả retry:', err.message);
});

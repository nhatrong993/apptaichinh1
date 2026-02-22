const { spawn } = require('child_process');

console.log('🚀 ĐANG KHỞI ĐỘNG HỆ THỐNG CRYPTO TREND HUNTER 🚀');
console.log('1. Bật máy chủ giao diện Web (Next.js)...');
console.log('2. Bật Bot AI quét dữ liệu ngầm (Agent)...');
console.log('--------------------------------------------------');

// Khởi chạy trình chủ Next 
const nextServer = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
});

// Khởi chạy Bot ngầm
const botScanner = spawn('node', ['scripts/scanner.js'], {
    stdio: 'inherit',
    shell: true
});

nextServer.on('close', (code) => {
    console.log(`[Hệ thống Web] đã tắt (Code: ${code})`);
});

botScanner.on('close', (code) => {
    console.log(`[Bot Quét ngầm] đã tắt (Code: ${code})`);
});

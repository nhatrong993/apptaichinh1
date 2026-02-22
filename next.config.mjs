/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';
const basePath = isProd ? '/apptaichinh1' : '';

const nextConfig = {
    reactStrictMode: true,

    // Static export cho GitHub Pages
    output: 'export',
    basePath: basePath,
    assetPrefix: basePath,

    // Tắt image optimization vì GitHub Pages không hỗ trợ
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'assets.coingecko.com',
            },
            {
                protocol: 'https',
                hostname: 'coin-images.coingecko.com',
            },
        ],
    },

    // Trailing slash cho GitHub Pages routing
    trailingSlash: true,
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // Cho phép fetch external APIs
    experimental: {
        serverActions: {
            allowedOrigins: ['localhost:3000'],
        },
    },

    // Logging cho server-side
    logging: {
        fetches: {
            fullUrl: true,
        },
    },

    // Image domains (nếu cần hiển thị coin icons)
    images: {
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
};

export default nextConfig;

import type { NextConfig } from 'next';
const config: NextConfig = {
  transpilePackages: ['@webshield/core'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE_URL || 'http://127.0.0.1:4000'}/api/:path*`,
      },
    ];
  },
  poweredByHeader: false,
};
export default config;

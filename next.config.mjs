/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/item', destination: '/master/items', permanent: true },
      { source: '/items', destination: '/master/items', permanent: true },
      { source: '/process', destination: '/master/processes', permanent: true },
      { source: '/processes', destination: '/master/processes', permanent: true },
      { source: '/pricefixing', destination: '/master/price-fixing', permanent: true },
      { source: '/price-fixing', destination: '/master/price-fixing', permanent: true }
    ];
  },
  async rewrites() {
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${process.env.BACKEND_URL || 'https://globusengineering-backend.vercel.app'}/api/:path*`, // Proxy to Backend
        },
      ],
    };
  },
};

export default nextConfig;

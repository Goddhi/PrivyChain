/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ["w3s.link", "gateway.pinata.cloud"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          "https://privychain-dot-chainguardai.uc.r.appspot.com/:path*",
      },
    ];
  },
};

module.exports = nextConfig;

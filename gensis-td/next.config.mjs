/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Sertifika PDF yüklemeleri için server action gövde limiti
    serverActions: { bodySizeLimit: "15mb" },
  },
};

export default nextConfig;

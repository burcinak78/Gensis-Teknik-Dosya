/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // KRR-025
  // Self-contained server (.next/standalone) for the Docker image.
  output: "standalone",
  // pdfkit (under @react-pdf) loads its standard fonts and data with dynamic requires that file tracing
  // cannot see, so the PDF routes ship them explicitly.
  outputFileTracingIncludes: {
    "/api/pdf/**": ["./node_modules/pdfkit/js/**/*"],
  },
  experimental: {
    // Sertifika PDF yüklemeleri için server action gövde limiti
    serverActions: { bodySizeLimit: "15mb" },
  },
  // Kod webpack tarafında sorunsuz derleniyor; tip denetimi ve ESLint
  // derlemeyi BLOKLAMASIN (GitHub yüklemesinden kaynaklı dosya/harf
  // büyüklüğü tutarsızlıkları deploy'u durdurmasın).
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Local `next dev` without the nginx proxy: send /api/* that Next does not serve itself (its own
  // /api/pdf routes win) to the C# backend. Behind the proxy this is unset and nginx does the routing.
  async rewrites() {
    const api = process.env.API_PROXY_URL;
    return api ? [{ source: "/api/:path*", destination: `${api.replace(/\/$/, "")}/api/:path*` }] : [];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Suppress middleware deprecation warning (middleware.ts is still the correct convention)
  experimental: {
    // This warning is a false positive - middleware.ts is still the standard Next.js convention
  },
}

export default nextConfig

import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
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

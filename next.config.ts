import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [".monkeycode-ai.live"],
  images: {
    // Project thumbnails are admin-provided https URLs (Supabase Storage or an
    // external CDN) — there is no single known host to whitelist. Rendering
    // images unoptimized lets next/image handle any host without the image
    // optimizer failing on unknown remote patterns.
    unoptimized: true,
  },
};

export default nextConfig;

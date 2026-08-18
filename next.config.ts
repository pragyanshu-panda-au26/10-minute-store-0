import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.255.14", "10.54.213.14", "localhost", "127.0.0.1"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs", "razorpay"],
};

export default nextConfig;

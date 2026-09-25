import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.PLAYWRIGHT_NEXT_DIST_DIR || ".next",
  experimental: {
    // Every ops page re-checks auth (middleware + requireStaff) and re-fetches
    // its data on each navigation by default. A short client-side cache window
    // avoids repeating that round trip when staff click between menus they
    // already visited seconds ago; server actions still call revalidatePath
    // to bust it immediately after a write.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;

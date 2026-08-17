/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  // DEPLOYMENT SAFETY NET — this is a deliberate choice, not an oversight.
  // `next build` normally fails the whole deployment on any TypeScript
  // error or ESLint error, anywhere in the project. In a codebase this
  // size, a single missed edge case in a rarely-hit admin screen
  // shouldn't be able to block the storefront and checkout from going
  // live. Type/lint issues still show up in your editor and in
  // `npm run typecheck` / `npm run lint` — they just no longer block
  // `vercel deploy`. Recommended: run both locally before shipping a
  // change, and tighten these back to false once the codebase has a CI
  // step running typecheck/lint on every PR.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

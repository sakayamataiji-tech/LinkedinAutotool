/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // playwright-core is loaded lazily at runtime by the LinkedIn provider — keep
  // it out of the webpack bundle (it's huge and not bundler-friendly).
  serverExternalPackages: ["playwright-core"],
  // Exclude the heavy, node-only browser package from serverless function
  // traces. It is never used on serverless (mock provider); this keeps
  // function bundles small and avoids size-limit deploy failures.
  outputFileTracingExcludes: {
    "*": ["node_modules/playwright-core/**"],
  },
};

export default nextConfig;

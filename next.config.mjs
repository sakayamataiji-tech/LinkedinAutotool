/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // playwright-core is loaded lazily at runtime by the LinkedIn provider — keep
  // it out of the webpack bundle (it's huge and not bundler-friendly).
  serverExternalPackages: ["playwright-core"],
};

export default nextConfig;

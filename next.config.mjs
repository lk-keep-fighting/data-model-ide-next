/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // `serverActions` must be an object in Next v16+ experimental config.
    // Setting to an empty object enables server actions without using a boolean.
    serverActions: {}
  }
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // training-engine ships as TS source, not a build artifact - see
  // packages/training-engine/package.json and the plan's architecture notes.
  transpilePackages: ["@garmincoach/training-engine"],
};

export default nextConfig;

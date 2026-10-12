import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // AGENTS.md is the project's hand-curated canonical instruction file; keep
  // `next dev` from managing a generated block inside it (Next 16.4 removes an
  // existing block on the next run, see node_modules/next/dist/docs/.
  agentRules: false,
};

export default nextConfig;

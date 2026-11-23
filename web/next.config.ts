import type {NextConfig} from "next";

const config: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{source: "/redesign", destination: "/redesign/index.html"}];
  },
};

export default config;

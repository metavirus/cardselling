import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const config: NextConfig = {
  devIndicators: false,
  turbopack: { root: dirname(fileURLToPath(import.meta.url)) }
};
export default config;

import { fileURLToPath } from "node:url";

const config = {
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
};
export default config;

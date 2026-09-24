import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.jascasekeeper.app",
  appName: "LEXORA",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;

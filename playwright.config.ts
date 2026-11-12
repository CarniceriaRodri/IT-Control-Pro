import { defineConfig } from "@playwright/test";
import { basename } from "node:path";
const url =
  "http://127.0.0.1:4187/" + encodeURIComponent(basename(process.cwd())) + "/";
export default defineConfig({
  testDir: "./tests",
  workers: 2,
  use: {
    baseURL: url,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  webServer: {
    command: "python3 -m http.server 4187 --bind 127.0.0.1 --directory ..",
    url,
    reuseExistingServer: false,
  },
});

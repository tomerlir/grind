import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "Grind: Structured Strength",
        short_name: "Grind",
        description:
          "Structured full-body workouts with built-in variation, fast logging, and less decision fatigue.",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0E1218",
        theme_color: "#0E1218",
        start_url: "./",
        icons: [
          {
            src: "icons/web-app-manifest-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icons/web-app-manifest-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ["**/*.{js,css,html,mp3}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});

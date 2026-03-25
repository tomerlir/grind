import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "Grind: Olympus Workout",
        short_name: "Grind",
        description:
          "Structured full-body workouts with built-in variation. Let the God of Thunder generate your training.",
        display: "standalone",
        orientation: "portrait",
        background_color: "#04091A",
        theme_color: "#04091A",
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

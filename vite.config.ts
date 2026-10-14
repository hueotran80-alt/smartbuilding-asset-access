import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import legacy from "@vitejs/plugin-legacy";

const isNativeAndroidBuild = process.env.CAPACITOR_NATIVE_BUILD === "1";

export default defineConfig({
  // Make native-only app security features deterministic in packaged Android builds.
  define: { __NATIVE_ANDROID_BUILD__: JSON.stringify(isNativeAndroidBuild) },
  // Android WebViews can lag behind desktop Chrome; keep the APK bundle compatible
  // with the Android 7 WebView floor supported by this project. Do not change web builds.
  build: isNativeAndroidBuild ? { target: "chrome55" } : {},
  plugins: [
    react(),
    // Android 7 WebView does not support native ES modules; provide a legacy
    // SystemJS bundle only for APK builds. The web build remains unchanged.
    ...(isNativeAndroidBuild
      ? [legacy({ targets: ["Chrome >= 51"], modernPolyfills: true })]
      : []),
    VitePWA({
      // A packaged Android WebView must not build or register a PWA service worker.
      disable: isNativeAndroidBuild,
      // Do not attach a PWA service worker to the packaged native WebView.
      // It can otherwise keep serving an old UI after an APK is updated.
      injectRegister: isNativeAndroidBuild ? null : "auto",
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Smart Building Access",
        short_name: "Smart Lock",
        description: "Quản lý và điều khiển cửa chính tòa nhà thông minh",
        theme_color: "#172033",
        background_color: "#f5f7fb",
        display: "standalone",
        orientation: "portrait-primary",
        icons: [
          { src: "/pwa-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/pwa-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024
      }
    })
  ],
  server: { host: "0.0.0.0", port: 5173 }
});

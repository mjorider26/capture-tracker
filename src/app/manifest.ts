import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Capture Tracker", short_name: "Capture Tracker", description: "SPENDING TRACKED. BUSINESS GROWN.", start_url: "/app/today", scope: "/", display: "standalone", background_color: "#f4f7f8", theme_color: "#061321", icons: [{ src: "/brand/capture-tracker-icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" }, { src: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] };
}

import type { MetadataRoute } from "next";

// Web app manifest — enables "Add to Home Screen" / installable PWA on mobile.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PawTrack — Find lost dogs together",
    short_name: "PawTrack",
    description:
      "Organize community searches for lost dogs: shared maps, live coverage, sightings, and Telegram coordination.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1f4f2",
    theme_color: "#0e9f6e",
    categories: ["social", "utilities", "lifestyle"],
    icons: [
      { src: "/pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/pwa-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

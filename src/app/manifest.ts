import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gym Tracker",
    short_name: "GymTracker",
    description: "Trainingsplan, Sätze und Fortschritt",
    start_url: "/training",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0F100E",
    theme_color: "#0F100E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

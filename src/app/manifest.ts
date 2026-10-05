import type { MetadataRoute } from "next"
import { cookies } from "next/headers"
import { ACCENTS } from "@/lib/accent"

// icons follow the accent colour the user picked (stored in a cookie by the app)
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const c = (await cookies()).get("gt-accent")?.value
  const accent = ACCENTS.some((a) => a.id === c) ? c! : ACCENTS[0].id
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
      { src: `/app-icon/${accent}?size=192`, sizes: "192x192", type: "image/png" },
      { src: `/app-icon/${accent}?size=512`, sizes: "512x512", type: "image/png" },
      { src: `/app-icon/${accent}?size=512&maskable=1`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
